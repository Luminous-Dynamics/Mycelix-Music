/**
 * Platform Subscription API Routes
 * Backend endpoints for tiered platform subscriptions (5th economic model)
 */

import express, { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { pool } from '../db';

const router = express.Router();

// ============================================================
// MIDDLEWARE
// ============================================================

const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ============================================================
// SUBSCRIPTION TIERS & PRICING
// ============================================================

const SUBSCRIPTION_TIERS = {
  FREE: { id: 0, name: 'Free', price: 0, features: ['Pay-per-stream', 'Ads', '128kbps quality'] },
  BASIC: { id: 1, name: 'Basic', price: 5, features: ['Unlimited plays', 'Standard quality (256kbps)', 'No ads'] },
  PREMIUM: { id: 2, name: 'Premium', price: 10, features: ['High quality (320kbps/FLAC)', 'Offline downloads', 'Ad-free'] },
  ARTIST_SUPPORTER: { id: 3, name: 'Artist Supporter', price: 15, features: ['All Premium features', 'Artist patronage pool', 'Exclusive content'] }
};

// ============================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================

/**
 * GET /api/subscriptions/tiers
 * Get all available subscription tiers
 */
router.get('/tiers', async (req: Request, res: Response) => {
  try {
    res.json({
      tiers: Object.values(SUBSCRIPTION_TIERS)
    });
  } catch (error) {
    console.error('Get tiers error:', error);
    res.status(500).json({ error: 'Failed to fetch tiers' });
  }
});

/**
 * POST /api/subscriptions/subscribe
 * Subscribe user to a tier
 */
router.post(
  '/subscribe',
  [
    body('userAddress').isEthereumAddress(),
    body('tier').isIn(['BASIC', 'PREMIUM', 'ARTIST_SUPPORTER']),
    body('paymentMethod').optional().isString(),
    body('transactionHash').optional().isString()
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { userAddress, tier, paymentMethod, transactionHash, autoRenew = true } = req.body;

      const tierInfo = SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS];

      // Check if user already has subscription
      const existing = await pool.query(
        'SELECT * FROM platform_subscriptions WHERE subscriber_address = $1 AND status = \'active\'',
        [userAddress]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'User already has active subscription' });
      }

      const now = new Date();
      const nextBilling = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      // Create subscription
      const result = await pool.query(
        `INSERT INTO platform_subscriptions (
          subscriber_address, tier, start_date, last_billing_date,
          next_billing_date, status, payment_method, auto_renew
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [userAddress, tier, now, now, nextBilling, 'active', paymentMethod || 'crypto', autoRenew]
      );

      // Record transaction
      if (transactionHash) {
        await pool.query(
          `INSERT INTO subscription_transactions (
            subscription_id, transaction_type, amount, status, transaction_hash
          ) VALUES ($1, $2, $3, $4, $5)`,
          [result.rows[0].id, 'charge', tierInfo.price, 'completed', transactionHash]
        );
      }

      res.json({
        subscription: result.rows[0],
        message: `Successfully subscribed to ${tierInfo.name} tier`
      });
    } catch (error) {
      console.error('Subscribe error:', error);
      res.status(500).json({ error: 'Failed to create subscription' });
    }
  }
);

/**
 * GET /api/subscriptions/:userAddress
 * Get user's subscription details
 */
router.get(
  '/:userAddress',
  param('userAddress').isEthereumAddress(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { userAddress } = req.params;

      const result = await pool.query(
        'SELECT * FROM platform_subscriptions WHERE subscriber_address = $1 ORDER BY created_at DESC LIMIT 1',
        [userAddress]
      );

      if (result.rows.length === 0) {
        return res.json({
          subscription: null,
          tier: 'FREE',
          hasActive: false
        });
      }

      const subscription = result.rows[0];
      const tierInfo = SUBSCRIPTION_TIERS[subscription.tier as keyof typeof SUBSCRIPTION_TIERS];

      // Check if expired (past grace period)
      const gracePeriod = 3 * 24 * 60 * 60 * 1000; // 3 days in ms
      const nextBilling = new Date(subscription.next_billing_date);
      const isExpired = subscription.status === 'active' &&
                       Date.now() > nextBilling.getTime() + gracePeriod;

      if (isExpired) {
        // Auto-expire
        await pool.query(
          'UPDATE platform_subscriptions SET status = \'expired\' WHERE id = $1',
          [subscription.id]
        );
        subscription.status = 'expired';
      }

      res.json({
        subscription,
        tierInfo,
        hasActive: subscription.status === 'active',
        daysUntilRenewal: Math.ceil((nextBilling.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      });
    } catch (error) {
      console.error('Get subscription error:', error);
      res.status(500).json({ error: 'Failed to fetch subscription' });
    }
  }
);

/**
 * POST /api/subscriptions/:userAddress/renew
 * Renew subscription
 */
router.post(
  '/:userAddress/renew',
  [
    param('userAddress').isEthereumAddress(),
    body('transactionHash').optional().isString()
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { userAddress } = req.params;
      const { transactionHash } = req.body;

      const subResult = await pool.query(
        'SELECT * FROM platform_subscriptions WHERE subscriber_address = $1 AND status = \'active\'',
        [userAddress]
      );

      if (subResult.rows.length === 0) {
        return res.status(404).json({ error: 'No active subscription found' });
      }

      const subscription = subResult.rows[0];
      const tierInfo = SUBSCRIPTION_TIERS[subscription.tier as keyof typeof SUBSCRIPTION_TIERS];

      const now = new Date();
      const nextBilling = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Update subscription
      await pool.query(
        `UPDATE platform_subscriptions
         SET last_billing_date = $1, next_billing_date = $2
         WHERE id = $3`,
        [now, nextBilling, subscription.id]
      );

      // Record transaction
      if (transactionHash) {
        await pool.query(
          `INSERT INTO subscription_transactions (
            subscription_id, transaction_type, amount, status, transaction_hash
          ) VALUES ($1, $2, $3, $4, $5)`,
          [subscription.id, 'renewal', tierInfo.price, 'completed', transactionHash]
        );
      }

      res.json({
        success: true,
        message: 'Subscription renewed successfully',
        nextBillingDate: nextBilling
      });
    } catch (error) {
      console.error('Renew error:', error);
      res.status(500).json({ error: 'Failed to renew subscription' });
    }
  }
);

/**
 * POST /api/subscriptions/:userAddress/cancel
 * Cancel subscription
 */
router.post(
  '/:userAddress/cancel',
  param('userAddress').isEthereumAddress(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { userAddress } = req.params;

      const result = await pool.query(
        `UPDATE platform_subscriptions
         SET status = 'cancelled', auto_renew = false
         WHERE subscriber_address = $1 AND status = 'active'
         RETURNING *`,
        [userAddress]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No active subscription found' });
      }

      res.json({
        success: true,
        message: 'Subscription cancelled successfully',
        subscription: result.rows[0]
      });
    } catch (error) {
      console.error('Cancel error:', error);
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  }
);

/**
 * POST /api/subscriptions/:userAddress/upgrade
 * Upgrade subscription tier
 */
router.post(
  '/:userAddress/upgrade',
  [
    param('userAddress').isEthereumAddress(),
    body('newTier').isIn(['BASIC', 'PREMIUM', 'ARTIST_SUPPORTER']),
    body('transactionHash').optional().isString()
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { userAddress } = req.params;
      const { newTier, transactionHash } = req.body;

      const subResult = await pool.query(
        'SELECT * FROM platform_subscriptions WHERE subscriber_address = $1 AND status = \'active\'',
        [userAddress]
      );

      if (subResult.rows.length === 0) {
        return res.status(404).json({ error: 'No active subscription found' });
      }

      const subscription = subResult.rows[0];
      const currentTierInfo = SUBSCRIPTION_TIERS[subscription.tier as keyof typeof SUBSCRIPTION_TIERS];
      const newTierInfo = SUBSCRIPTION_TIERS[newTier as keyof typeof SUBSCRIPTION_TIERS];

      if (newTierInfo.id <= currentTierInfo.id) {
        return res.status(400).json({ error: 'Not an upgrade' });
      }

      // Calculate pro-rated price
      const nextBilling = new Date(subscription.next_billing_date);
      const remainingDays = Math.ceil((nextBilling.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      const priceDiff = ((newTierInfo.price - currentTierInfo.price) * remainingDays) / 30;

      // Update tier
      await pool.query(
        'UPDATE platform_subscriptions SET tier = $1 WHERE id = $2',
        [newTier, subscription.id]
      );

      // Record transaction
      if (transactionHash) {
        await pool.query(
          `INSERT INTO subscription_transactions (
            subscription_id, transaction_type, amount, status, transaction_hash
          ) VALUES ($1, $2, $3, $4, $5)`,
          [subscription.id, 'upgrade', priceDiff, 'completed', transactionHash]
        );
      }

      res.json({
        success: true,
        message: `Upgraded to ${newTierInfo.name} tier`,
        priceDiff,
        newTier: newTierInfo
      });
    } catch (error) {
      console.error('Upgrade error:', error);
      res.status(500).json({ error: 'Failed to upgrade subscription' });
    }
  }
);

/**
 * POST /api/subscriptions/:userAddress/downgrade
 * Downgrade subscription tier (effective next billing)
 */
router.post(
  '/:userAddress/downgrade',
  [
    param('userAddress').isEthereumAddress(),
    body('newTier').isIn(['BASIC', 'PREMIUM'])
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { userAddress } = req.params;
      const { newTier } = req.body;

      const subResult = await pool.query(
        'SELECT * FROM platform_subscriptions WHERE subscriber_address = $1 AND status = \'active\'',
        [userAddress]
      );

      if (subResult.rows.length === 0) {
        return res.status(404).json({ error: 'No active subscription found' });
      }

      const subscription = subResult.rows[0];
      const currentTierInfo = SUBSCRIPTION_TIERS[subscription.tier as keyof typeof SUBSCRIPTION_TIERS];
      const newTierInfo = SUBSCRIPTION_TIERS[newTier as keyof typeof SUBSCRIPTION_TIERS];

      if (newTierInfo.id >= currentTierInfo.id) {
        return res.status(400).json({ error: 'Not a downgrade' });
      }

      // Schedule downgrade for next billing
      await pool.query(
        'UPDATE platform_subscriptions SET tier = $1 WHERE id = $2',
        [newTier, subscription.id]
      );

      res.json({
        success: true,
        message: `Downgrade to ${newTierInfo.name} scheduled for next billing cycle`,
        effectiveDate: subscription.next_billing_date,
        newTier: newTierInfo
      });
    } catch (error) {
      console.error('Downgrade error:', error);
      res.status(500).json({ error: 'Failed to downgrade subscription' });
    }
  }
);

/**
 * PUT /api/subscriptions/:userAddress/auto-renew
 * Toggle auto-renewal
 */
router.put(
  '/:userAddress/auto-renew',
  [
    param('userAddress').isEthereumAddress(),
    body('enabled').isBoolean()
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { userAddress } = req.params;
      const { enabled } = req.body;

      const result = await pool.query(
        `UPDATE platform_subscriptions
         SET auto_renew = $1
         WHERE subscriber_address = $2 AND status = 'active'
         RETURNING *`,
        [enabled, userAddress]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No active subscription found' });
      }

      res.json({
        success: true,
        autoRenew: enabled,
        message: `Auto-renewal ${enabled ? 'enabled' : 'disabled'}`
      });
    } catch (error) {
      console.error('Toggle auto-renew error:', error);
      res.status(500).json({ error: 'Failed to update auto-renew setting' });
    }
  }
);

// ============================================================
// SUBSCRIPTION ANALYTICS & STATS
// ============================================================

/**
 * GET /api/subscriptions/stats/platform
 * Get platform-wide subscription statistics
 */
router.get('/stats/platform', async (req: Request, res: Response) => {
  try {
    // Total subscribers by tier
    const tierStats = await pool.query(
      `SELECT
        tier,
        COUNT(*) as subscriber_count,
        SUM(CASE WHEN tier = 'BASIC' THEN 5
                 WHEN tier = 'PREMIUM' THEN 10
                 WHEN tier = 'ARTIST_SUPPORTER' THEN 15
                 ELSE 0 END) as monthly_revenue
      FROM platform_subscriptions
      WHERE status = 'active'
      GROUP BY tier`
    );

    // Total revenue
    const revenueStats = await pool.query(
      `SELECT
        SUM(amount) as total_revenue,
        COUNT(*) as total_transactions,
        AVG(amount) as avg_transaction
      FROM subscription_transactions
      WHERE status = 'completed'
        AND created_at >= NOW() - INTERVAL '30 days'`
    );

    // Churn rate
    const churnStats = await pool.query(
      `SELECT
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_count,
        COUNT(*) as total_count
      FROM platform_subscriptions
      WHERE created_at >= NOW() - INTERVAL '30 days'`
    );

    const churnData = churnStats.rows[0];
    const churnRate = ((parseFloat(churnData.cancelled_count) + parseFloat(churnData.expired_count)) /
                      parseFloat(churnData.total_count) * 100).toFixed(2);

    res.json({
      tierStats: tierStats.rows,
      revenue: revenueStats.rows[0],
      churnRate: parseFloat(churnRate),
      totalActiveSubscribers: tierStats.rows.reduce((sum, tier) => sum + parseInt(tier.subscriber_count), 0)
    });
  } catch (error) {
    console.error('Get platform stats error:', error);
    res.status(500).json({ error: 'Failed to fetch platform statistics' });
  }
});

/**
 * GET /api/subscriptions/:userAddress/transactions
 * Get user's subscription transaction history
 */
router.get(
  '/:userAddress/transactions',
  param('userAddress').isEthereumAddress(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { userAddress } = req.params;
      const { limit = 20 } = req.query;

      const result = await pool.query(
        `SELECT st.*
        FROM subscription_transactions st
        JOIN platform_subscriptions ps ON st.subscription_id = ps.id
        WHERE ps.subscriber_address = $1
        ORDER BY st.created_at DESC
        LIMIT $2`,
        [userAddress, limit]
      );

      res.json({
        transactions: result.rows
      });
    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  }
);

// ============================================================
// ARTIST REVENUE DISTRIBUTION
// ============================================================

/**
 * POST /api/subscriptions/revenue/record-plays
 * Record plays for revenue distribution (called by backend after plays)
 */
router.post(
  '/revenue/record-plays',
  [
    body('month').isISO8601(),
    body('artistAddress').isEthereumAddress(),
    body('playCount').isInt({ min: 1 })
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { month, artistAddress, playCount } = req.body;

      const monthDate = new Date(month);
      monthDate.setDate(1); // First of month
      monthDate.setHours(0, 0, 0, 0);

      await pool.query(
        `INSERT INTO subscription_revenue_distributions (
          month, artist_address, play_count, total_plays, distributed
        ) VALUES ($1, $2, $3, 0, false)
        ON CONFLICT (month, artist_address)
        DO UPDATE SET play_count = subscription_revenue_distributions.play_count + $3`,
        [monthDate, artistAddress, playCount]
      );

      res.json({ success: true, message: 'Plays recorded' });
    } catch (error) {
      console.error('Record plays error:', error);
      res.status(500).json({ error: 'Failed to record plays' });
    }
  }
);

/**
 * GET /api/subscriptions/revenue/artist/:artistAddress
 * Get artist's earnings from subscriptions
 */
router.get(
  '/revenue/artist/:artistAddress',
  param('artistAddress').isEthereumAddress(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { artistAddress } = req.params;
      const { limit = 12 } = req.query; // Default 12 months

      const result = await pool.query(
        `SELECT * FROM subscription_revenue_distributions
         WHERE artist_address = $1
         ORDER BY month DESC
         LIMIT $2`,
        [artistAddress, limit]
      );

      const totalEarnings = result.rows.reduce((sum, row) =>
        sum + parseFloat(row.earnings || 0), 0
      );

      res.json({
        distributions: result.rows,
        totalEarnings,
        monthCount: result.rows.length
      });
    } catch (error) {
      console.error('Get artist revenue error:', error);
      res.status(500).json({ error: 'Failed to fetch artist revenue' });
    }
  }
);

// ============================================================
// ACCESS CONTROL
// ============================================================

/**
 * GET /api/subscriptions/:userAddress/can-play
 * Check if user can play songs (has active subscription or will pay-per-stream)
 */
router.get(
  '/:userAddress/can-play',
  param('userAddress').isEthereumAddress(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { userAddress } = req.params;

      const result = await pool.query(
        `SELECT * FROM platform_subscriptions
         WHERE subscriber_address = $1
         AND status = 'active'
         AND next_billing_date > NOW() - INTERVAL '3 days'`,
        [userAddress]
      );

      const hasSubscription = result.rows.length > 0;
      const subscription = result.rows[0];

      res.json({
        canPlay: true, // Always true (free users pay-per-stream)
        hasSubscription,
        tier: hasSubscription ? subscription.tier : 'FREE',
        requiresPayment: !hasSubscription, // Pay-per-stream for free users
        features: hasSubscription ?
          SUBSCRIPTION_TIERS[subscription.tier as keyof typeof SUBSCRIPTION_TIERS].features :
          SUBSCRIPTION_TIERS.FREE.features
      });
    } catch (error) {
      console.error('Check play access error:', error);
      res.status(500).json({ error: 'Failed to check access' });
    }
  }
);

export default router;
