import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app'
import { db } from '../../src/db'
import { ethers } from 'ethers'

describe('Subscription API - Unit Tests', () => {
  const testUser = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2'
  const testUser2 = '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199'

  beforeEach(async () => {
    // Clean up test data
    await db.query('DELETE FROM subscriptions WHERE user_address = $1', [testUser])
    await db.query('DELETE FROM subscriptions WHERE user_address = $1', [testUser2])
    await db.query('DELETE FROM subscription_transactions WHERE user_address = $1', [testUser])
  })

  afterEach(async () => {
    // Clean up
    await db.query('DELETE FROM subscriptions WHERE user_address = $1', [testUser])
    await db.query('DELETE FROM subscriptions WHERE user_address = $1', [testUser2])
    await db.query('DELETE FROM subscription_transactions WHERE user_address = $1', [testUser])
  })

  // ============================================
  // POST /api/subscriptions/subscribe
  // ============================================

  describe('POST /api/subscriptions/subscribe', () => {
    it('should subscribe user to FREE tier', async () => {
      const res = await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser,
          tier: 'FREE',
        })
        .expect(201)

      expect(res.body).toMatchObject({
        success: true,
        subscription: {
          user_address: testUser,
          tier: 'FREE',
          active: true,
          auto_renew: true,
        },
      })

      expect(res.body.subscription.end_date).toBeDefined()
      expect(res.body.subscription.id).toBeDefined()
    })

    it('should subscribe user to BASIC tier with payment', async () => {
      const res = await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser,
          tier: 'BASIC',
          txHash: '0x' + '1'.repeat(64), // Mock transaction hash
        })
        .expect(201)

      expect(res.body).toMatchObject({
        success: true,
        subscription: {
          user_address: testUser,
          tier: 'BASIC',
          active: true,
        },
      })

      // Verify transaction was recorded
      const { rows } = await db.query(
        'SELECT * FROM subscription_transactions WHERE user_address = $1',
        [testUser]
      )

      expect(rows).toHaveLength(1)
      expect(rows[0].type).toBe('subscription')
      expect(rows[0].tier).toBe('BASIC')
    })

    it('should subscribe user to PREMIUM tier', async () => {
      const res = await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser,
          tier: 'PREMIUM',
          txHash: '0x' + '2'.repeat(64),
        })
        .expect(201)

      expect(res.body.subscription.tier).toBe('PREMIUM')
    })

    it('should subscribe user to ARTIST_SUPPORTER tier', async () => {
      const res = await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser,
          tier: 'ARTIST_SUPPORTER',
          txHash: '0x' + '3'.repeat(64),
        })
        .expect(201)

      expect(res.body.subscription.tier).toBe('ARTIST_SUPPORTER')
    })

    it('should reject invalid tier', async () => {
      const res = await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser,
          tier: 'INVALID_TIER',
        })
        .expect(400)

      expect(res.body).toMatchObject({
        success: false,
        error: 'Invalid tier',
      })
    })

    it('should reject missing userAddress', async () => {
      const res = await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          tier: 'BASIC',
        })
        .expect(400)

      expect(res.body.error).toContain('userAddress')
    })

    it('should reject invalid Ethereum address', async () => {
      const res = await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: 'invalid_address',
          tier: 'BASIC',
        })
        .expect(400)

      expect(res.body.error).toContain('Invalid Ethereum address')
    })

    it('should reject if already subscribed', async () => {
      // Create initial subscription
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser,
          tier: 'FREE',
        })

      // Try to subscribe again
      const res = await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser,
          tier: 'BASIC',
          txHash: '0x' + '1'.repeat(64),
        })
        .expect(409)

      expect(res.body.error).toContain('already subscribed')
    })

    it('should require txHash for paid tiers', async () => {
      const res = await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser,
          tier: 'BASIC',
          // Missing txHash
        })
        .expect(400)

      expect(res.body.error).toContain('txHash required for paid tiers')
    })
  })

  // ============================================
  // POST /api/subscriptions/upgrade
  // ============================================

  describe('POST /api/subscriptions/upgrade', () => {
    beforeEach(async () => {
      // Create FREE subscription for upgrade tests
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser,
          tier: 'FREE',
        })
    })

    it('should upgrade from FREE to BASIC', async () => {
      const res = await request(app)
        .post('/api/subscriptions/upgrade')
        .send({
          userAddress: testUser,
          newTier: 'BASIC',
          txHash: '0x' + '4'.repeat(64),
        })
        .expect(200)

      expect(res.body).toMatchObject({
        success: true,
        subscription: {
          tier: 'BASIC',
        },
      })

      // Verify transaction recorded
      const { rows } = await db.query(
        'SELECT * FROM subscription_transactions WHERE user_address = $1 AND type = $2',
        [testUser, 'upgrade']
      )

      expect(rows).toHaveLength(1)
      expect(rows[0].from_tier).toBe('FREE')
      expect(rows[0].to_tier).toBe('BASIC')
    })

    it('should calculate pro-rated amount for mid-period upgrade', async () => {
      // Upgrade to BASIC first
      await request(app)
        .post('/api/subscriptions/upgrade')
        .send({
          userAddress: testUser,
          newTier: 'BASIC',
          txHash: '0x' + '4'.repeat(64),
        })

      // Wait 15 days (simulate with database update)
      await db.query(
        'UPDATE subscriptions SET created_at = created_at - interval \'15 days\' WHERE user_address = $1',
        [testUser]
      )

      // Upgrade to PREMIUM
      const res = await request(app)
        .post('/api/subscriptions/upgrade')
        .send({
          userAddress: testUser,
          newTier: 'PREMIUM',
          txHash: '0x' + '5'.repeat(64),
        })
        .expect(200)

      expect(res.body.proRatedAmount).toBeDefined()
      expect(res.body.proRatedAmount).toBeGreaterThan(0)
      // Should be roughly half the price difference since halfway through period
      expect(res.body.proRatedAmount).toBeLessThan(
        res.body.fullUpgradeCost
      )
    })

    it('should upgrade from BASIC to PREMIUM', async () => {
      // First upgrade to BASIC
      await request(app)
        .post('/api/subscriptions/upgrade')
        .send({
          userAddress: testUser,
          newTier: 'BASIC',
          txHash: '0x' + '4'.repeat(64),
        })

      // Then upgrade to PREMIUM
      const res = await request(app)
        .post('/api/subscriptions/upgrade')
        .send({
          userAddress: testUser,
          newTier: 'PREMIUM',
          txHash: '0x' + '5'.repeat(64),
        })
        .expect(200)

      expect(res.body.subscription.tier).toBe('PREMIUM')
    })

    it('should upgrade from PREMIUM to ARTIST_SUPPORTER', async () => {
      // Setup: upgrade to PREMIUM first
      await request(app)
        .post('/api/subscriptions/upgrade')
        .send({
          userAddress: testUser,
          newTier: 'PREMIUM',
          txHash: '0x' + '4'.repeat(64),
        })

      // Upgrade to ARTIST_SUPPORTER
      const res = await request(app)
        .post('/api/subscriptions/upgrade')
        .send({
          userAddress: testUser,
          newTier: 'ARTIST_SUPPORTER',
          txHash: '0x' + '6'.repeat(64),
        })
        .expect(200)

      expect(res.body.subscription.tier).toBe('ARTIST_SUPPORTER')
    })

    it('should reject downgrade via upgrade endpoint', async () => {
      // Setup: upgrade to PREMIUM
      await request(app)
        .post('/api/subscriptions/upgrade')
        .send({
          userAddress: testUser,
          newTier: 'PREMIUM',
          txHash: '0x' + '4'.repeat(64),
        })

      // Try to "upgrade" to BASIC (downgrade)
      const res = await request(app)
        .post('/api/subscriptions/upgrade')
        .send({
          userAddress: testUser,
          newTier: 'BASIC',
          txHash: '0x' + '5'.repeat(64),
        })
        .expect(400)

      expect(res.body.error).toContain('Use downgrade endpoint')
    })

    it('should reject upgrade to same tier', async () => {
      const res = await request(app)
        .post('/api/subscriptions/upgrade')
        .send({
          userAddress: testUser,
          newTier: 'FREE',
          txHash: '0x' + '4'.repeat(64),
        })
        .expect(400)

      expect(res.body.error).toContain('Already on this tier')
    })

    it('should reject if no active subscription', async () => {
      // Cancel subscription first
      await request(app)
        .post('/api/subscriptions/cancel')
        .send({
          userAddress: testUser,
        })

      // Try to upgrade
      const res = await request(app)
        .post('/api/subscriptions/upgrade')
        .send({
          userAddress: testUser,
          newTier: 'BASIC',
          txHash: '0x' + '4'.repeat(64),
        })
        .expect(404)

      expect(res.body.error).toContain('No active subscription')
    })
  })

  // ============================================
  // POST /api/subscriptions/cancel
  // ============================================

  describe('POST /api/subscriptions/cancel', () => {
    beforeEach(async () => {
      // Create subscription for cancel tests
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser,
          tier: 'BASIC',
          txHash: '0x' + '1'.repeat(64),
        })
    })

    it('should cancel active subscription', async () => {
      const res = await request(app)
        .post('/api/subscriptions/cancel')
        .send({
          userAddress: testUser,
        })
        .expect(200)

      expect(res.body).toMatchObject({
        success: true,
        message: 'Subscription cancelled',
      })

      // Verify auto_renew is disabled
      const { rows } = await db.query(
        'SELECT * FROM subscriptions WHERE user_address = $1',
        [testUser]
      )

      expect(rows[0].auto_renew).toBe(false)
      expect(rows[0].active).toBe(true) // Still active until end date
    })

    it('should set end date to current period end', async () => {
      // Get current end date
      const { rows: beforeRows } = await db.query(
        'SELECT end_date FROM subscriptions WHERE user_address = $1',
        [testUser]
      )
      const originalEndDate = beforeRows[0].end_date

      // Cancel
      await request(app)
        .post('/api/subscriptions/cancel')
        .send({
          userAddress: testUser,
        })

      // Verify end date unchanged
      const { rows: afterRows } = await db.query(
        'SELECT end_date FROM subscriptions WHERE user_address = $1',
        [testUser]
      )

      expect(afterRows[0].end_date).toEqual(originalEndDate)
    })

    it('should disable auto-renewal', async () => {
      await request(app)
        .post('/api/subscriptions/cancel')
        .send({
          userAddress: testUser,
        })

      const { rows } = await db.query(
        'SELECT auto_renew FROM subscriptions WHERE user_address = $1',
        [testUser]
      )

      expect(rows[0].auto_renew).toBe(false)
    })

    it('should allow access until period end', async () => {
      await request(app)
        .post('/api/subscriptions/cancel')
        .send({
          userAddress: testUser,
        })

      // Verify subscription still active
      const res = await request(app)
        .get('/api/subscriptions/current')
        .query({ userAddress: testUser })
        .expect(200)

      expect(res.body.subscription.active).toBe(true)
      expect(res.body.subscription.auto_renew).toBe(false)
    })

    it('should reject if no active subscription', async () => {
      const res = await request(app)
        .post('/api/subscriptions/cancel')
        .send({
          userAddress: testUser2, // Never subscribed
        })
        .expect(404)

      expect(res.body.error).toContain('No active subscription')
    })

    it('should reject if already cancelled', async () => {
      // Cancel first time
      await request(app)
        .post('/api/subscriptions/cancel')
        .send({
          userAddress: testUser,
        })

      // Try to cancel again
      const res = await request(app)
        .post('/api/subscriptions/cancel')
        .send({
          userAddress: testUser,
        })
        .expect(400)

      expect(res.body.error).toContain('already cancelled')
    })
  })

  // ============================================
  // GET /api/subscriptions/current
  // ============================================

  describe('GET /api/subscriptions/current', () => {
    it('should return current subscription for subscribed user', async () => {
      // Subscribe first
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser,
          tier: 'PREMIUM',
          txHash: '0x' + '1'.repeat(64),
        })

      const res = await request(app)
        .get('/api/subscriptions/current')
        .query({ userAddress: testUser })
        .expect(200)

      expect(res.body).toMatchObject({
        success: true,
        subscription: {
          user_address: testUser,
          tier: 'PREMIUM',
          active: true,
          auto_renew: true,
        },
      })
    })

    it('should return null for non-subscribed user', async () => {
      const res = await request(app)
        .get('/api/subscriptions/current')
        .query({ userAddress: testUser })
        .expect(200)

      expect(res.body).toMatchObject({
        success: true,
        subscription: null,
      })
    })

    it('should include tier details', async () => {
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser,
          tier: 'BASIC',
          txHash: '0x' + '1'.repeat(64),
        })

      const res = await request(app)
        .get('/api/subscriptions/current')
        .query({ userAddress: testUser })
        .expect(200)

      expect(res.body.tierDetails).toBeDefined()
      expect(res.body.tierDetails.name).toBe('BASIC')
      expect(res.body.tierDetails.price).toBeDefined()
      expect(res.body.tierDetails.features).toBeDefined()
    })

    it('should include renewal date', async () => {
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser,
          tier: 'PREMIUM',
          txHash: '0x' + '1'.repeat(64),
        })

      const res = await request(app)
        .get('/api/subscriptions/current')
        .query({ userAddress: testUser })
        .expect(200)

      expect(res.body.subscription.end_date).toBeDefined()
      expect(new Date(res.body.subscription.end_date).getTime()).toBeGreaterThan(
        Date.now()
      )
    })

    it('should require userAddress parameter', async () => {
      const res = await request(app)
        .get('/api/subscriptions/current')
        .expect(400)

      expect(res.body.error).toContain('userAddress required')
    })
  })

  // ============================================
  // GET /api/subscriptions/history
  // ============================================

  describe('GET /api/subscriptions/history', () => {
    beforeEach(async () => {
      // Create some subscription history
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser,
          tier: 'BASIC',
          txHash: '0x' + '1'.repeat(64),
        })

      await request(app)
        .post('/api/subscriptions/upgrade')
        .send({
          userAddress: testUser,
          newTier: 'PREMIUM',
          txHash: '0x' + '2'.repeat(64),
        })
    })

    it('should return subscription history', async () => {
      const res = await request(app)
        .get('/api/subscriptions/history')
        .query({ userAddress: testUser })
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.history).toBeInstanceOf(Array)
      expect(res.body.history.length).toBeGreaterThan(0)
    })

    it('should paginate results', async () => {
      const res = await request(app)
        .get('/api/subscriptions/history')
        .query({
          userAddress: testUser,
          limit: 1,
          offset: 0,
        })
        .expect(200)

      expect(res.body.history).toHaveLength(1)
      expect(res.body.total).toBeGreaterThan(1)
    })

    it('should filter by date range', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

      const res = await request(app)
        .get('/api/subscriptions/history')
        .query({
          userAddress: testUser,
          startDate: yesterday.toISOString(),
          endDate: tomorrow.toISOString(),
        })
        .expect(200)

      expect(res.body.history).toBeInstanceOf(Array)
      // All records should be within date range
      res.body.history.forEach((record: any) => {
        const recordDate = new Date(record.created_at)
        expect(recordDate.getTime()).toBeGreaterThanOrEqual(yesterday.getTime())
        expect(recordDate.getTime()).toBeLessThanOrEqual(tomorrow.getTime())
      })
    })

    it('should include payment status for each entry', async () => {
      const res = await request(app)
        .get('/api/subscriptions/history')
        .query({ userAddress: testUser })
        .expect(200)

      res.body.history.forEach((record: any) => {
        expect(record.status).toBeDefined()
        expect(['success', 'pending', 'failed']).toContain(record.status)
      })
    })

    it('should return empty array for user with no history', async () => {
      const res = await request(app)
        .get('/api/subscriptions/history')
        .query({ userAddress: testUser2 })
        .expect(200)

      expect(res.body.history).toHaveLength(0)
      expect(res.body.total).toBe(0)
    })
  })

  // ============================================
  // GET /api/subscriptions/revenue (Artist)
  // ============================================

  describe('GET /api/subscriptions/revenue', () => {
    const artistAddress = '0x9999999999999999999999999999999999999999'

    beforeEach(async () => {
      // Create subscriptions and simulate plays
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser,
          tier: 'BASIC',
          txHash: '0x' + '1'.repeat(64),
        })

      // Record plays (simulated via database)
      await db.query(
        `INSERT INTO plays (user_address, artist_address, created_at)
         VALUES ($1, $2, NOW())`,
        [testUser, artistAddress]
      )
    })

    it('should return artist revenue from subscriptions', async () => {
      const res = await request(app)
        .get('/api/subscriptions/revenue')
        .query({ artistAddress })
        .expect(200)

      expect(res.body).toMatchObject({
        success: true,
        revenue: expect.any(Object),
      })

      expect(res.body.revenue.totalRevenue).toBeDefined()
      expect(res.body.revenue.playCount).toBeGreaterThan(0)
    })

    it('should calculate play-based revenue correctly', async () => {
      // Add more plays
      for (let i = 0; i < 10; i++) {
        await db.query(
          `INSERT INTO plays (user_address, artist_address, created_at)
           VALUES ($1, $2, NOW())`,
          [testUser, artistAddress]
        )
      }

      const res = await request(app)
        .get('/api/subscriptions/revenue')
        .query({ artistAddress })
        .expect(200)

      expect(res.body.revenue.playCount).toBeGreaterThanOrEqual(10)
      expect(res.body.revenue.totalRevenue).toBeGreaterThan(0)
    })

    it('should include patronage bonus for supporter tier', async () => {
      // Subscribe user to ARTIST_SUPPORTER tier
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser2,
          tier: 'ARTIST_SUPPORTER',
          txHash: '0x' + '2'.repeat(64),
        })

      // Record plays
      await db.query(
        `INSERT INTO plays (user_address, artist_address, created_at)
         VALUES ($1, $2, NOW())`,
        [testUser2, artistAddress]
      )

      const res = await request(app)
        .get('/api/subscriptions/revenue')
        .query({ artistAddress })
        .expect(200)

      expect(res.body.revenue.patronageBonus).toBeDefined()
      expect(res.body.revenue.patronageBonus).toBeGreaterThan(0)
    })

    it('should filter by date range', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

      const res = await request(app)
        .get('/api/subscriptions/revenue')
        .query({
          artistAddress,
          startDate: yesterday.toISOString(),
          endDate: tomorrow.toISOString(),
        })
        .expect(200)

      expect(res.body.revenue).toBeDefined()
    })

    it('should return zero revenue for artist with no plays', async () => {
      const newArtist = '0x8888888888888888888888888888888888888888'

      const res = await request(app)
        .get('/api/subscriptions/revenue')
        .query({ artistAddress: newArtist })
        .expect(200)

      expect(res.body.revenue.totalRevenue).toBe(0)
      expect(res.body.revenue.playCount).toBe(0)
    })
  })

  // ============================================
  // GET /api/subscriptions/billing/history
  // ============================================

  describe('GET /api/subscriptions/billing/history', () => {
    beforeEach(async () => {
      // Create subscription with transaction
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser,
          tier: 'PREMIUM',
          txHash: '0x' + '1'.repeat(64),
        })
    })

    it('should return billing transactions', async () => {
      const res = await request(app)
        .get('/api/subscriptions/billing/history')
        .query({ userAddress: testUser })
        .expect(200)

      expect(res.body.success).toBe(true)
      expect(res.body.transactions).toBeInstanceOf(Array)
      expect(res.body.transactions.length).toBeGreaterThan(0)
    })

    it('should include successful payments', async () => {
      const res = await request(app)
        .get('/api/subscriptions/billing/history')
        .query({ userAddress: testUser })
        .expect(200)

      const successfulPayments = res.body.transactions.filter(
        (t: any) => t.status === 'success'
      )

      expect(successfulPayments.length).toBeGreaterThan(0)
    })

    it('should include failed payments', async () => {
      // Simulate failed payment
      await db.query(
        `INSERT INTO subscription_transactions
         (user_address, type, tier, amount, status, tx_hash)
         VALUES ($1, 'renewal', 'PREMIUM', 0.02, 'failed', $2)`,
        [testUser, '0x' + 'f'.repeat(64)]
      )

      const res = await request(app)
        .get('/api/subscriptions/billing/history')
        .query({ userAddress: testUser })
        .expect(200)

      const failedPayments = res.body.transactions.filter(
        (t: any) => t.status === 'failed'
      )

      expect(failedPayments.length).toBeGreaterThan(0)
    })

    it('should include refunds', async () => {
      // Simulate refund
      await db.query(
        `INSERT INTO subscription_transactions
         (user_address, type, tier, amount, status, tx_hash)
         VALUES ($1, 'refund', 'PREMIUM', -0.02, 'success', $2)`,
        [testUser, '0x' + 'r'.repeat(64)]
      )

      const res = await request(app)
        .get('/api/subscriptions/billing/history')
        .query({ userAddress: testUser })
        .expect(200)

      const refunds = res.body.transactions.filter(
        (t: any) => t.type === 'refund'
      )

      expect(refunds.length).toBeGreaterThan(0)
    })

    it('should paginate with limit and offset', async () => {
      const res = await request(app)
        .get('/api/subscriptions/billing/history')
        .query({
          userAddress: testUser,
          limit: 10,
          offset: 0,
        })
        .expect(200)

      expect(res.body.transactions.length).toBeLessThanOrEqual(10)
      expect(res.body.total).toBeDefined()
    })

    it('should default to limit of 50', async () => {
      // Create many transactions
      for (let i = 0; i < 100; i++) {
        await db.query(
          `INSERT INTO subscription_transactions
           (user_address, type, tier, amount, status, tx_hash)
           VALUES ($1, 'renewal', 'BASIC', 0.01, 'success', $2)`,
          [testUser, '0x' + i.toString().repeat(32).slice(0, 64)]
        )
      }

      const res = await request(app)
        .get('/api/subscriptions/billing/history')
        .query({ userAddress: testUser })
        .expect(200)

      expect(res.body.transactions.length).toBeLessThanOrEqual(50)
    })
  })

  // ============================================
  // POST /api/subscriptions/billing/retry
  // ============================================

  describe('POST /api/subscriptions/billing/retry', () => {
    beforeEach(async () => {
      // Create subscription
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser,
          tier: 'BASIC',
          txHash: '0x' + '1'.repeat(64),
        })

      // Simulate failed renewal
      await db.query(
        `INSERT INTO subscription_transactions
         (user_address, type, tier, amount, status, tx_hash)
         VALUES ($1, 'renewal', 'BASIC', 0.01, 'failed', $2)`,
        [testUser, '0x' + 'f'.repeat(64)]
      )
    })

    it('should retry failed payment', async () => {
      const res = await request(app)
        .post('/api/subscriptions/billing/retry')
        .send({
          userAddress: testUser,
          txHash: '0x' + 'r'.repeat(64), // New transaction
        })
        .expect(200)

      expect(res.body).toMatchObject({
        success: true,
        message: 'Payment retry successful',
      })
    })

    it('should update subscription status on success', async () => {
      await request(app)
        .post('/api/subscriptions/billing/retry')
        .send({
          userAddress: testUser,
          txHash: '0x' + 'r'.repeat(64),
        })

      // Verify subscription is active
      const { rows } = await db.query(
        'SELECT active FROM subscriptions WHERE user_address = $1',
        [testUser]
      )

      expect(rows[0].active).toBe(true)
    })

    it('should handle retry failure', async () => {
      const res = await request(app)
        .post('/api/subscriptions/billing/retry')
        .send({
          userAddress: testUser,
          // Missing txHash - simulates payment failure
        })
        .expect(400)

      expect(res.body.success).toBe(false)
    })

    it('should reject if no failed payment exists', async () => {
      const res = await request(app)
        .post('/api/subscriptions/billing/retry')
        .send({
          userAddress: testUser2, // No failed payments
          txHash: '0x' + 'r'.repeat(64),
        })
        .expect(404)

      expect(res.body.error).toContain('No failed payment')
    })
  })
})
