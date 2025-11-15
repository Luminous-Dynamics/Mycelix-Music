/**
 * Creator Tools API Routes
 * Comprehensive endpoints for artist content management, fan engagement, and analytics
 */

import express, { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { pool } from '../db';

const router = express.Router();

// ============================================================
// MIDDLEWARE
// ============================================================

// Validate request
const validate = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Check if user is the artist (simplified - would use JWT in production)
const isArtist = async (req: Request, res: Response, next: any) => {
  const artistAddress = req.params.artistAddress || req.body.artistAddress;
  // In production, verify JWT token matches artist address
  // For now, we'll trust the request
  next();
};

// ============================================================
// DASHBOARD OVERVIEW
// ============================================================

/**
 * GET /api/creator/:artistAddress/dashboard
 * Get comprehensive dashboard stats for an artist
 */
router.get(
  '/:artistAddress/dashboard',
  param('artistAddress').isEthereumAddress(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { artistAddress } = req.params;
      const { startDate, endDate } = req.query;

      // Get from materialized view for fast response
      const statsQuery = await pool.query(
        'SELECT * FROM mv_creator_dashboard_stats WHERE artist_address = $1',
        [artistAddress]
      );

      if (statsQuery.rows.length === 0) {
        return res.status(404).json({ error: 'Artist not found' });
      }

      const stats = statsQuery.rows[0];

      // Get period-specific metrics if date range provided
      let periodMetrics = null;
      if (startDate && endDate) {
        const metricsQuery = await pool.query(
          'SELECT * FROM get_creator_metrics($1, $2, $3)',
          [artistAddress, startDate, endDate]
        );
        periodMetrics = metricsQuery.rows[0];
      }

      // Get revenue by strategy
      const revenueByStrategyQuery = await pool.query(
        `SELECT
          s.strategy,
          COUNT(p.id) as play_count,
          SUM(p.amount_paid) as total_earnings
        FROM songs s
        LEFT JOIN plays p ON s.song_id = p.song_id
        WHERE s.artist_address = $1
        GROUP BY s.strategy`,
        [artistAddress]
      );

      // Get recent activity
      const recentActivityQuery = await pool.query(
        `SELECT * FROM (
          SELECT 'follower' as type, followed_at as timestamp, follower_address as user_address
          FROM artist_followers
          WHERE artist_address = $1
          UNION ALL
          SELECT 'comment' as type, created_at as timestamp, commenter_address as user_address
          FROM song_comments sc
          JOIN songs s ON sc.song_id = s.song_id
          WHERE s.artist_address = $1
          UNION ALL
          SELECT 'patron' as type, subscribed_at as timestamp, patron_address as user_address
          FROM patronage_subscriptions
          WHERE artist_address = $1
        ) activities
        ORDER BY timestamp DESC
        LIMIT 20`,
        [artistAddress]
      );

      res.json({
        overview: stats,
        periodMetrics,
        revenueByStrategy: revenueByStrategyQuery.rows,
        recentActivity: recentActivityQuery.rows
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  }
);

// ============================================================
// SONG MANAGEMENT
// ============================================================

/**
 * POST /api/creator/songs/draft
 * Save song as draft
 */
router.post(
  '/songs/draft',
  [
    body('artistAddress').isEthereumAddress(),
    body('draftName').optional().isString(),
    body('metadata').isObject(),
    body('audioCid').optional().isString(),
    body('coverArtCid').optional().isString()
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { artistAddress, draftName, metadata, audioCid, coverArtCid, notes } = req.body;

      const result = await pool.query(
        `INSERT INTO song_drafts (artist_address, draft_name, song_metadata, audio_cid, cover_art_cid, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [artistAddress, draftName, JSON.stringify(metadata), audioCid, coverArtCid, notes]
      );

      res.json({ draft: result.rows[0] });
    } catch (error) {
      console.error('Save draft error:', error);
      res.status(500).json({ error: 'Failed to save draft' });
    }
  }
);

/**
 * GET /api/creator/:artistAddress/drafts
 * Get all drafts for an artist
 */
router.get(
  '/:artistAddress/drafts',
  param('artistAddress').isEthereumAddress(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { artistAddress } = req.params;
      const { status } = req.query;

      let query = 'SELECT * FROM song_drafts WHERE artist_address = $1';
      const params = [artistAddress];

      if (status) {
        query += ' AND status = $2';
        params.push(status as string);
      }

      query += ' ORDER BY updated_at DESC';

      const result = await pool.query(query, params);
      res.json({ drafts: result.rows });
    } catch (error) {
      console.error('Get drafts error:', error);
      res.status(500).json({ error: 'Failed to fetch drafts' });
    }
  }
);

/**
 * PUT /api/creator/songs/draft/:id
 * Update draft
 */
router.put(
  '/songs/draft/:id',
  [
    param('id').isInt(),
    body('metadata').optional().isObject(),
    body('status').optional().isIn(['draft', 'review', 'ready', 'published'])
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        if (key === 'metadata') {
          setClauses.push(`song_metadata = $${paramIndex}`);
          values.push(JSON.stringify(updates[key]));
        } else if (key === 'audioCid') {
          setClauses.push(`audio_cid = $${paramIndex}`);
          values.push(updates[key]);
        } else if (key === 'coverArtCid') {
          setClauses.push(`cover_art_cid = $${paramIndex}`);
          values.push(updates[key]);
        } else if (['draftName', 'status', 'notes'].includes(key)) {
          setClauses.push(`${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = $${paramIndex}`);
          values.push(updates[key]);
        }
        paramIndex++;
      });

      setClauses.push(`updated_at = NOW()`);

      values.push(id);
      const result = await pool.query(
        `UPDATE song_drafts SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Draft not found' });
      }

      res.json({ draft: result.rows[0] });
    } catch (error) {
      console.error('Update draft error:', error);
      res.status(500).json({ error: 'Failed to update draft' });
    }
  }
);

/**
 * DELETE /api/creator/songs/draft/:id
 * Delete draft
 */
router.delete(
  '/songs/draft/:id',
  param('id').isInt(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'DELETE FROM song_drafts WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Draft not found' });
      }

      res.json({ success: true, deletedId: result.rows[0].id });
    } catch (error) {
      console.error('Delete draft error:', error);
      res.status(500).json({ error: 'Failed to delete draft' });
    }
  }
);

/**
 * POST /api/creator/songs/schedule
 * Schedule a song release
 */
router.post(
  '/songs/schedule',
  [
    body('artistAddress').isEthereumAddress(),
    body('songMetadata').isObject(),
    body('releaseDate').isISO8601(),
    body('autoPublish').optional().isBoolean(),
    body('notifyFollowers').optional().isBoolean()
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const {
        artistAddress,
        songMetadata,
        releaseDate,
        autoPublish = true,
        notifyFollowers = true,
        notifyPatrons = true,
        preSaveEnabled = false
      } = req.body;

      const result = await pool.query(
        `INSERT INTO scheduled_releases (
          artist_address, song_title, song_metadata, release_date,
          auto_publish, notify_followers, notify_patrons, pre_save_enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          artistAddress,
          songMetadata.title,
          JSON.stringify(songMetadata),
          releaseDate,
          autoPublish,
          notifyFollowers,
          notifyPatrons,
          preSaveEnabled
        ]
      );

      res.json({ scheduledRelease: result.rows[0] });
    } catch (error) {
      console.error('Schedule release error:', error);
      res.status(500).json({ error: 'Failed to schedule release' });
    }
  }
);

/**
 * GET /api/creator/:artistAddress/scheduled-releases
 * Get scheduled releases for an artist
 */
router.get(
  '/:artistAddress/scheduled-releases',
  param('artistAddress').isEthereumAddress(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { artistAddress } = req.params;

      const result = await pool.query(
        `SELECT * FROM scheduled_releases
         WHERE artist_address = $1
         ORDER BY release_date ASC`,
        [artistAddress]
      );

      res.json({ scheduledReleases: result.rows });
    } catch (error) {
      console.error('Get scheduled releases error:', error);
      res.status(500).json({ error: 'Failed to fetch scheduled releases' });
    }
  }
);

/**
 * DELETE /api/creator/scheduled-releases/:id
 * Cancel scheduled release
 */
router.delete(
  '/scheduled-releases/:id',
  param('id').isInt(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `UPDATE scheduled_releases SET status = 'cancelled' WHERE id = $1 RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Scheduled release not found' });
      }

      res.json({ success: true, release: result.rows[0] });
    } catch (error) {
      console.error('Cancel scheduled release error:', error);
      res.status(500).json({ error: 'Failed to cancel scheduled release' });
    }
  }
);

// ============================================================
// FAN ENGAGEMENT
// ============================================================

/**
 * POST /api/creator/messages
 * Send message to followers/patrons
 */
router.post(
  '/messages',
  [
    body('artistAddress').isEthereumAddress(),
    body('messageType').isIn(['announcement', 'patron_only', 'all_followers', 'direct']),
    body('content').isString().notEmpty(),
    body('subject').optional().isString(),
    body('targetTiers').optional().isArray()
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const {
        artistAddress,
        messageType,
        recipientAddress,
        subject,
        content,
        targetTiers,
        scheduledSend
      } = req.body;

      // Count recipients
      let recipientCount = 0;
      if (messageType === 'all_followers') {
        const countResult = await pool.query(
          'SELECT COUNT(*) FROM artist_followers WHERE artist_address = $1',
          [artistAddress]
        );
        recipientCount = parseInt(countResult.rows[0].count);
      } else if (messageType === 'patron_only') {
        const countResult = await pool.query(
          `SELECT COUNT(*) FROM patronage_subscriptions
           WHERE artist_address = $1 AND status = 'active'
           ${targetTiers && targetTiers.length > 0 ? 'AND tier = ANY($2)' : ''}`,
          targetTiers && targetTiers.length > 0 ? [artistAddress, targetTiers] : [artistAddress]
        );
        recipientCount = parseInt(countResult.rows[0].count);
      } else if (messageType === 'direct') {
        recipientCount = 1;
      }

      const status = scheduledSend ? 'scheduled' : 'sent';
      const sentAt = scheduledSend ? null : new Date();

      const result = await pool.query(
        `INSERT INTO creator_messages (
          artist_address, message_type, recipient_address, subject, content,
          target_tiers, scheduled_send, status, sent_at, recipient_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          artistAddress,
          messageType,
          recipientAddress || null,
          subject,
          content,
          targetTiers || null,
          scheduledSend || null,
          status,
          sentAt,
          recipientCount
        ]
      );

      res.json({ message: result.rows[0] });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

/**
 * GET /api/creator/:artistAddress/messages
 * Get messages sent by artist
 */
router.get(
  '/:artistAddress/messages',
  param('artistAddress').isEthereumAddress(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { artistAddress } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const result = await pool.query(
        `SELECT * FROM creator_messages
         WHERE artist_address = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [artistAddress, limit, offset]
      );

      res.json({ messages: result.rows });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }
);

/**
 * GET /api/creator/:artistAddress/patrons
 * Get list of patrons with details
 */
router.get(
  '/:artistAddress/patrons',
  param('artistAddress').isEthereumAddress(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { artistAddress } = req.params;
      const { tier, sortBy = 'subscribed_at', order = 'DESC' } = req.query;

      let query = `
        SELECT
          ps.*,
          up.display_name,
          up.avatar_url,
          COUNT(DISTINCT p.id) as total_plays,
          SUM(p.amount_paid) as total_spent
        FROM patronage_subscriptions ps
        LEFT JOIN user_profiles up ON ps.patron_address = up.user_address
        LEFT JOIN plays p ON ps.patron_address = p.listener_address
        LEFT JOIN songs s ON p.song_id = s.song_id AND s.artist_address = $1
        WHERE ps.artist_address = $1
        AND ps.status = 'active'
      `;

      const params = [artistAddress];

      if (tier) {
        query += ' AND ps.tier = $2';
        params.push(tier as string);
      }

      query += ` GROUP BY ps.id, up.display_name, up.avatar_url
                 ORDER BY ${sortBy} ${order}`;

      const result = await pool.query(query, params);

      res.json({ patrons: result.rows });
    } catch (error) {
      console.error('Get patrons error:', error);
      res.status(500).json({ error: 'Failed to fetch patrons' });
    }
  }
);

/**
 * POST /api/creator/moderate/comment/:commentId
 * Moderate a comment
 */
router.post(
  '/moderate/comment/:commentId',
  [
    param('commentId').isInt(),
    body('artistAddress').isEthereumAddress(),
    body('action').isIn(['delete', 'hide', 'pin', 'approve']),
    body('reason').optional().isString()
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { commentId } = req.params;
      const { artistAddress, action, reason } = req.body;

      // Record moderation action
      await pool.query(
        `INSERT INTO moderation_actions (artist_address, target_type, target_id, action, reason)
         VALUES ($1, 'comment', $2, $3, $4)`,
        [artistAddress, commentId, action, reason || null]
      );

      // Apply action
      if (action === 'delete') {
        await pool.query(
          'UPDATE song_comments SET is_deleted = TRUE WHERE id = $1',
          [commentId]
        );
      } else if (action === 'pin') {
        // Would need to add pinned field to song_comments table
        // await pool.query('UPDATE song_comments SET pinned = TRUE WHERE id = $1', [commentId]);
      }

      res.json({ success: true, action });
    } catch (error) {
      console.error('Moderate comment error:', error);
      res.status(500).json({ error: 'Failed to moderate comment' });
    }
  }
);

/**
 * POST /api/creator/ban/:userAddress
 * Ban a user
 */
router.post(
  '/ban/:userAddress',
  [
    param('userAddress').isEthereumAddress(),
    body('artistAddress').isEthereumAddress(),
    body('reason').optional().isString(),
    body('duration').optional().isInt(),
    body('banType').optional().isIn(['permanent', 'temporary'])
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { userAddress } = req.params;
      const { artistAddress, reason, duration, banType = 'permanent' } = req.body;

      const expiresAt = banType === 'temporary' && duration
        ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000)
        : null;

      const result = await pool.query(
        `INSERT INTO banned_users (artist_address, banned_user_address, reason, ban_type, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (artist_address, banned_user_address) DO UPDATE
         SET reason = $3, ban_type = $4, expires_at = $5, banned_at = NOW(), lifted_at = NULL
         RETURNING *`,
        [artistAddress, userAddress, reason || null, banType, expiresAt]
      );

      res.json({ ban: result.rows[0] });
    } catch (error) {
      console.error('Ban user error:', error);
      res.status(500).json({ error: 'Failed to ban user' });
    }
  }
);

/**
 * DELETE /api/creator/ban/:userAddress
 * Unban a user
 */
router.delete(
  '/ban/:userAddress',
  [
    param('userAddress').isEthereumAddress(),
    query('artistAddress').isEthereumAddress()
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { userAddress } = req.params;
      const { artistAddress } = req.query;

      const result = await pool.query(
        `UPDATE banned_users
         SET lifted_at = NOW(), lifted_by = $1
         WHERE artist_address = $1 AND banned_user_address = $2
         RETURNING *`,
        [artistAddress, userAddress]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Ban not found' });
      }

      res.json({ success: true, unbanned: result.rows[0] });
    } catch (error) {
      console.error('Unban user error:', error);
      res.status(500).json({ error: 'Failed to unban user' });
    }
  }
);

// ============================================================
// PROMOTIONAL CAMPAIGNS
// ============================================================

/**
 * POST /api/creator/campaigns
 * Create promotional campaign
 */
router.post(
  '/campaigns',
  [
    body('artistAddress').isEthereumAddress(),
    body('campaignName').isString().notEmpty(),
    body('discountCode').isString().notEmpty(),
    body('discountPercentage').optional().isFloat({ min: 0, max: 100 }),
    body('validFrom').optional().isISO8601(),
    body('validUntil').optional().isISO8601(),
    body('maxUses').optional().isInt()
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const {
        artistAddress,
        campaignName,
        discountCode,
        discountPercentage,
        discountFixed,
        validFrom,
        validUntil,
        maxUses,
        applicableSongs,
        applicableStrategies
      } = req.body;

      const result = await pool.query(
        `INSERT INTO discount_campaigns (
          artist_address, campaign_name, discount_code, discount_percentage,
          discount_fixed, valid_from, valid_until, max_uses,
          applicable_songs, applicable_strategies
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          artistAddress,
          campaignName,
          discountCode,
          discountPercentage || null,
          discountFixed || null,
          validFrom || new Date(),
          validUntil || null,
          maxUses || null,
          applicableSongs || [],
          applicableStrategies || []
        ]
      );

      res.json({ campaign: result.rows[0] });
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Discount code already exists' });
      }
      console.error('Create campaign error:', error);
      res.status(500).json({ error: 'Failed to create campaign' });
    }
  }
);

/**
 * GET /api/creator/:artistAddress/campaigns
 * Get campaigns for artist
 */
router.get(
  '/:artistAddress/campaigns',
  param('artistAddress').isEthereumAddress(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { artistAddress } = req.params;
      const { status } = req.query;

      let query = 'SELECT * FROM discount_campaigns WHERE artist_address = $1';
      const params = [artistAddress];

      if (status) {
        query += ' AND status = $2';
        params.push(status as string);
      }

      query += ' ORDER BY created_at DESC';

      const result = await pool.query(query, params);
      res.json({ campaigns: result.rows });
    } catch (error) {
      console.error('Get campaigns error:', error);
      res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
  }
);

/**
 * PUT /api/creator/campaigns/:id
 * Update campaign
 */
router.put(
  '/campaigns/:id',
  [
    param('id').isInt(),
    body('status').optional().isIn(['active', 'paused', 'cancelled'])
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      Object.keys(updates).forEach(key => {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        setClauses.push(`${dbKey} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      });

      values.push(id);

      const result = await pool.query(
        `UPDATE discount_campaigns SET ${setClauses.join(', ')}
         WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      res.json({ campaign: result.rows[0] });
    } catch (error) {
      console.error('Update campaign error:', error);
      res.status(500).json({ error: 'Failed to update campaign' });
    }
  }
);

/**
 * GET /api/creator/campaigns/:id/stats
 * Get campaign statistics
 */
router.get(
  '/campaigns/:id/stats',
  param('id').isInt(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const campaignResult = await pool.query(
        'SELECT * FROM discount_campaigns WHERE id = $1',
        [id]
      );

      if (campaignResult.rows.length === 0) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const usageResult = await pool.query(
        `SELECT
          COUNT(*) as total_uses,
          COUNT(DISTINCT user_address) as unique_users,
          SUM(discount_amount) as total_discount_given,
          SUM(discounted_price) as total_revenue,
          AVG(discount_amount) as avg_discount
        FROM campaign_usage
        WHERE campaign_id = $1`,
        [id]
      );

      res.json({
        campaign: campaignResult.rows[0],
        stats: usageResult.rows[0]
      });
    } catch (error) {
      console.error('Get campaign stats error:', error);
      res.status(500).json({ error: 'Failed to fetch campaign stats' });
    }
  }
);

// ============================================================
// REVENUE SPLITS
// ============================================================

/**
 * POST /api/creator/splits/:songId
 * Add revenue split for collaborator
 */
router.post(
  '/splits/:songId',
  [
    param('songId').isString(),
    body('collaboratorAddress').isEthereumAddress(),
    body('splitPercentage').isFloat({ min: 0, max: 100 }),
    body('role').optional().isString()
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { songId } = req.params;
      const { collaboratorAddress, collaboratorName, splitPercentage, role, contributionDescription } = req.body;

      // Verify total splits don't exceed 100%
      const existingSplits = await pool.query(
        'SELECT SUM(split_percentage) as total FROM revenue_splits WHERE song_id = $1 AND status = \'accepted\'',
        [songId]
      );

      const currentTotal = parseFloat(existingSplits.rows[0]?.total || '0');
      if (currentTotal + splitPercentage > 100) {
        return res.status(400).json({
          error: 'Total split percentage would exceed 100%',
          currentTotal,
          requested: splitPercentage
        });
      }

      const result = await pool.query(
        `INSERT INTO revenue_splits (
          song_id, collaborator_address, collaborator_name,
          split_percentage, role, contribution_description
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [songId, collaboratorAddress, collaboratorName, splitPercentage, role || null, contributionDescription || null]
      );

      res.json({ split: result.rows[0] });
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Split already exists for this collaborator' });
      }
      console.error('Add split error:', error);
      res.status(500).json({ error: 'Failed to add revenue split' });
    }
  }
);

/**
 * GET /api/creator/splits/:songId
 * Get revenue splits for a song
 */
router.get(
  '/splits/:songId',
  param('songId').isString(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { songId } = req.params;

      const result = await pool.query(
        'SELECT * FROM revenue_splits WHERE song_id = $1 ORDER BY split_percentage DESC',
        [songId]
      );

      res.json({ splits: result.rows });
    } catch (error) {
      console.error('Get splits error:', error);
      res.status(500).json({ error: 'Failed to fetch revenue splits' });
    }
  }
);

/**
 * PUT /api/creator/splits/:id/status
 * Accept or reject a split (by collaborator)
 */
router.put(
  '/splits/:id/status',
  [
    param('id').isInt(),
    body('status').isIn(['accepted', 'rejected']),
    body('collaboratorAddress').isEthereumAddress()
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, collaboratorAddress } = req.body;

      const result = await pool.query(
        `UPDATE revenue_splits
         SET status = $1, accepted_at = CASE WHEN $1 = 'accepted' THEN NOW() ELSE NULL END
         WHERE id = $2 AND collaborator_address = $3
         RETURNING *`,
        [status, id, collaboratorAddress]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Split not found or unauthorized' });
      }

      res.json({ split: result.rows[0] });
    } catch (error) {
      console.error('Update split status error:', error);
      res.status(500).json({ error: 'Failed to update split status' });
    }
  }
);

/**
 * DELETE /api/creator/splits/:id
 * Remove revenue split
 */
router.delete(
  '/splits/:id',
  param('id').isInt(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'DELETE FROM revenue_splits WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Split not found' });
      }

      res.json({ success: true, deletedSplit: result.rows[0] });
    } catch (error) {
      console.error('Delete split error:', error);
      res.status(500).json({ error: 'Failed to delete split' });
    }
  }
);

// ============================================================
// ANALYTICS
// ============================================================

/**
 * GET /api/creator/:artistAddress/analytics/revenue
 * Get detailed revenue analytics
 */
router.get(
  '/:artistAddress/analytics/revenue',
  [
    param('artistAddress').isEthereumAddress(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('groupBy').optional().isIn(['day', 'week', 'month'])
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { artistAddress } = req.params;
      const { startDate, endDate, groupBy = 'day' } = req.query;

      const dateFormat = groupBy === 'day' ? 'YYYY-MM-DD' :
                         groupBy === 'week' ? 'IYYY-IW' : 'YYYY-MM';

      const result = await pool.query(
        `SELECT
          TO_CHAR(p.played_at, $1) as period,
          s.strategy,
          COUNT(p.id) as play_count,
          SUM(p.amount_paid) as revenue,
          AVG(p.amount_paid) as avg_price,
          COUNT(DISTINCT p.listener_address) as unique_listeners
        FROM plays p
        JOIN songs s ON p.song_id = s.song_id
        WHERE s.artist_address = $2
        ${startDate ? 'AND p.played_at >= $3' : ''}
        ${endDate ? `AND p.played_at < $${startDate ? 4 : 3}` : ''}
        GROUP BY period, s.strategy
        ORDER BY period ASC`,
        [
          dateFormat,
          artistAddress,
          ...(startDate ? [startDate] : []),
          ...(endDate ? [endDate] : [])
        ]
      );

      res.json({ revenueData: result.rows });
    } catch (error) {
      console.error('Get revenue analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch revenue analytics' });
    }
  }
);

/**
 * GET /api/creator/:artistAddress/analytics/top-songs
 * Get top performing songs
 */
router.get(
  '/:artistAddress/analytics/top-songs',
  [
    param('artistAddress').isEthereumAddress(),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { artistAddress } = req.params;
      const { limit = 10, sortBy = 'plays' } = req.query;

      const result = await pool.query(
        `SELECT * FROM mv_artist_top_songs
         WHERE artist_address = $1
         ORDER BY ${sortBy === 'plays' ? 'rank_by_plays' : 'rank_by_earnings'} ASC
         LIMIT $2`,
        [artistAddress, limit]
      );

      res.json({ topSongs: result.rows });
    } catch (error) {
      console.error('Get top songs error:', error);
      res.status(500).json({ error: 'Failed to fetch top songs' });
    }
  }
);

/**
 * GET /api/creator/:artistAddress/analytics/audience
 * Get audience insights
 */
router.get(
  '/:artistAddress/analytics/audience',
  param('artistAddress').isEthereumAddress(),
  validate,
  async (req: Request, res: Response) => {
    try {
      const { artistAddress } = req.params;

      // Top listeners
      const topListeners = await pool.query(
        `SELECT
          p.listener_address,
          up.display_name,
          COUNT(p.id) as play_count,
          SUM(p.amount_paid) as total_spent,
          MAX(p.played_at) as last_played
        FROM plays p
        JOIN songs s ON p.song_id = s.song_id
        LEFT JOIN user_profiles up ON p.listener_address = up.user_address
        WHERE s.artist_address = $1
        GROUP BY p.listener_address, up.display_name
        ORDER BY play_count DESC
        LIMIT 50`,
        [artistAddress]
      );

      // Listener retention (returning listeners percentage)
      const retentionResult = await pool.query(
        `WITH listener_months AS (
          SELECT
            p.listener_address,
            DATE_TRUNC('month', p.played_at) as month
          FROM plays p
          JOIN songs s ON p.song_id = s.song_id
          WHERE s.artist_address = $1
          GROUP BY p.listener_address, month
        )
        SELECT
          COUNT(DISTINCT CASE WHEN play_count > 1 THEN listener_address END) * 100.0 /
          COUNT(DISTINCT listener_address) as retention_rate
        FROM (
          SELECT listener_address, COUNT(*) as play_count
          FROM listener_months
          GROUP BY listener_address
        ) counts`,
        [artistAddress]
      );

      // New vs returning listeners (last 30 days)
      const newVsReturning = await pool.query(
        `SELECT
          COUNT(DISTINCT CASE WHEN first_play >= NOW() - INTERVAL '30 days' THEN listener_address END) as new_listeners,
          COUNT(DISTINCT CASE WHEN first_play < NOW() - INTERVAL '30 days' THEN listener_address END) as returning_listeners
        FROM (
          SELECT
            p.listener_address,
            MIN(p.played_at) as first_play
          FROM plays p
          JOIN songs s ON p.song_id = s.song_id
          WHERE s.artist_address = $1
          AND p.played_at >= NOW() - INTERVAL '30 days'
          GROUP BY p.listener_address
        ) listener_stats`,
        [artistAddress]
      );

      res.json({
        topListeners: topListeners.rows,
        retention: retentionResult.rows[0],
        newVsReturning: newVsReturning.rows[0]
      });
    } catch (error) {
      console.error('Get audience analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch audience analytics' });
    }
  }
);

/**
 * GET /api/creator/:artistAddress/analytics/export
 * Export analytics data
 */
router.get(
  '/:artistAddress/analytics/export',
  [
    param('artistAddress').isEthereumAddress(),
    query('format').optional().isIn(['json', 'csv']),
    query('dataType').optional().isIn(['plays', 'earnings', 'followers', 'all'])
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { artistAddress } = req.params;
      const { format = 'json', dataType = 'all', startDate, endDate } = req.query;

      // Get comprehensive data
      const data: any = {};

      if (dataType === 'plays' || dataType === 'all') {
        const playsResult = await pool.query(
          `SELECT p.*, s.title, s.strategy
           FROM plays p
           JOIN songs s ON p.song_id = s.song_id
           WHERE s.artist_address = $1
           ${startDate ? 'AND p.played_at >= $2' : ''}
           ${endDate ? `AND p.played_at < $${startDate ? 3 : 2}` : ''}
           ORDER BY p.played_at DESC`,
          [artistAddress, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : [])]
        );
        data.plays = playsResult.rows;
      }

      // Add more data types as needed...

      if (format === 'csv') {
        // Convert to CSV (simplified - would use a CSV library in production)
        const csvHeader = Object.keys(data.plays[0] || {}).join(',');
        const csvRows = data.plays.map((row: any) => Object.values(row).join(','));
        const csv = [csvHeader, ...csvRows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="artist-analytics-${Date.now()}.csv"`);
        res.send(csv);
      } else {
        res.json(data);
      }
    } catch (error) {
      console.error('Export analytics error:', error);
      res.status(500).json({ error: 'Failed to export analytics' });
    }
  }
);

// ============================================================
// CONTENT CALENDAR
// ============================================================

/**
 * POST /api/creator/calendar
 * Add event to content calendar
 */
router.post(
  '/calendar',
  [
    body('artistAddress').isEthereumAddress(),
    body('eventType').isIn(['release', 'announcement', 'promotion', 'milestone', 'custom']),
    body('title').isString().notEmpty(),
    body('eventDate').isISO8601()
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const {
        artistAddress,
        eventType,
        title,
        description,
        eventDate,
        allDay = false,
        color,
        reminderEnabled = true,
        relatedSongId,
        relatedCampaignId
      } = req.body;

      const result = await pool.query(
        `INSERT INTO content_calendar (
          artist_address, event_type, title, description, event_date,
          all_day, color, reminder_enabled, related_song_id, related_campaign_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          artistAddress,
          eventType,
          title,
          description || null,
          eventDate,
          allDay,
          color || null,
          reminderEnabled,
          relatedSongId || null,
          relatedCampaignId || null
        ]
      );

      res.json({ event: result.rows[0] });
    } catch (error) {
      console.error('Add calendar event error:', error);
      res.status(500).json({ error: 'Failed to add calendar event' });
    }
  }
);

/**
 * GET /api/creator/:artistAddress/calendar
 * Get content calendar events
 */
router.get(
  '/:artistAddress/calendar',
  [
    param('artistAddress').isEthereumAddress(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const { artistAddress } = req.params;
      const { startDate, endDate } = req.query;

      let query = 'SELECT * FROM content_calendar WHERE artist_address = $1';
      const params = [artistAddress];

      if (startDate) {
        query += ' AND event_date >= $2';
        params.push(startDate as string);
      }
      if (endDate) {
        query += ` AND event_date < $${startDate ? 3 : 2}`;
        params.push(endDate as string);
      }

      query += ' ORDER BY event_date ASC';

      const result = await pool.query(query, params);
      res.json({ events: result.rows });
    } catch (error) {
      console.error('Get calendar events error:', error);
      res.status(500).json({ error: 'Failed to fetch calendar events' });
    }
  }
);

export default router;
