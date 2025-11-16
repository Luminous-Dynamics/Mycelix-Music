import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../src/app'
import { db } from '../../src/db'
import { ethers } from 'ethers'

describe('Subscription API - Integration Tests', () => {
  const testUser1 = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2'
  const testUser2 = '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199'
  const testUser3 = '0x1111111111111111111111111111111111111111'
  const artist1 = '0x2222222222222222222222222222222222222222'
  const artist2 = '0x3333333333333333333333333333333333333333'

  beforeAll(async () => {
    // Setup test database
    await db.query('BEGIN')
  })

  afterAll(async () => {
    // Cleanup
    await db.query('ROLLBACK')
    await db.end()
  })

  beforeEach(async () => {
    // Clean up between tests
    await db.query('DELETE FROM plays WHERE user_address IN ($1, $2, $3)', [
      testUser1,
      testUser2,
      testUser3,
    ])
    await db.query('DELETE FROM subscription_transactions WHERE user_address IN ($1, $2, $3)', [
      testUser1,
      testUser2,
      testUser3,
    ])
    await db.query('DELETE FROM subscriptions WHERE user_address IN ($1, $2, $3)', [
      testUser1,
      testUser2,
      testUser3,
    ])
    await db.query('DELETE FROM artist_revenue WHERE artist_address IN ($1, $2)', [artist1, artist2])
  })

  // ============================================
  // COMPLETE SUBSCRIPTION LIFECYCLE
  // ============================================

  describe('Complete Subscription Lifecycle', () => {
    it('should complete full subscription flow from subscribe to cancel', async () => {
      // 1. User subscribes to BASIC tier
      const subscribeRes = await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser1,
          tier: 'BASIC',
          txHash: '0x' + '1'.repeat(64),
        })
        .expect(201)

      expect(subscribeRes.body.success).toBe(true)
      const subscriptionId = subscribeRes.body.subscription.id

      // 2. Verify subscription created in DB
      const { rows: subRows } = await db.query(
        'SELECT * FROM subscriptions WHERE user_address = $1',
        [testUser1]
      )

      expect(subRows).toHaveLength(1)
      expect(subRows[0].tier).toBe('BASIC')
      expect(subRows[0].active).toBe(true)

      // 3. Verify payment processed (transaction recorded)
      const { rows: txRows } = await db.query(
        'SELECT * FROM subscription_transactions WHERE user_address = $1',
        [testUser1]
      )

      expect(txRows).toHaveLength(1)
      expect(txRows[0].type).toBe('subscription')
      expect(txRows[0].status).toBe('success')

      // 4. User listens to some songs (simulate plays)
      await db.query(
        `INSERT INTO plays (user_address, artist_address, song_id, created_at)
         VALUES
           ($1, $2, 'song1', NOW()),
           ($1, $2, 'song2', NOW()),
           ($1, $3, 'song3', NOW())`,
        [testUser1, artist1, artist2]
      )

      // 5. Verify revenue distribution (simulate backend job)
      const distributeRes = await request(app)
        .post('/api/subscriptions/distribute')
        .send({
          adminKey: process.env.ADMIN_KEY, // Required for admin endpoints
        })
        .expect(200)

      expect(distributeRes.body.success).toBe(true)

      // 6. Check artist revenue
      const artist1Revenue = await request(app)
        .get('/api/subscriptions/revenue')
        .query({ artistAddress: artist1 })
        .expect(200)

      expect(artist1Revenue.body.revenue.totalRevenue).toBeGreaterThan(0)
      expect(artist1Revenue.body.revenue.playCount).toBe(2)

      // 7. User upgrades to PREMIUM
      const upgradeRes = await request(app)
        .post('/api/subscriptions/upgrade')
        .send({
          userAddress: testUser1,
          newTier: 'PREMIUM',
          txHash: '0x' + '2'.repeat(64),
        })
        .expect(200)

      expect(upgradeRes.body.subscription.tier).toBe('PREMIUM')

      // 8. Verify upgrade transaction
      const { rows: upgradeTxRows } = await db.query(
        'SELECT * FROM subscription_transactions WHERE user_address = $1 AND type = $2',
        [testUser1, 'upgrade']
      )

      expect(upgradeTxRows).toHaveLength(1)
      expect(upgradeTxRows[0].from_tier).toBe('BASIC')
      expect(upgradeTxRows[0].to_tier).toBe('PREMIUM')

      // 9. User cancels subscription
      const cancelRes = await request(app)
        .post('/api/subscriptions/cancel')
        .send({
          userAddress: testUser1,
        })
        .expect(200)

      expect(cancelRes.body.success).toBe(true)

      // 10. Verify subscription still active until end date
      const currentRes = await request(app)
        .get('/api/subscriptions/current')
        .query({ userAddress: testUser1 })
        .expect(200)

      expect(currentRes.body.subscription.active).toBe(true)
      expect(currentRes.body.subscription.auto_renew).toBe(false)

      // 11. Simulate time passing (update end_date to past)
      await db.query(
        'UPDATE subscriptions SET end_date = NOW() - interval \'1 day\' WHERE user_address = $1',
        [testUser1]
      )

      // 12. Verify subscription expired
      const expiredRes = await request(app)
        .get('/api/subscriptions/current')
        .query({ userAddress: testUser1 })
        .expect(200)

      expect(expiredRes.body.subscription).toBe(null) // Expired subscriptions return null
    })

    it('should handle multi-tier upgrade path', async () => {
      // Subscribe to FREE
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser1,
          tier: 'FREE',
        })
        .expect(201)

      // Upgrade to BASIC
      await request(app)
        .post('/api/subscriptions/upgrade')
        .send({
          userAddress: testUser1,
          newTier: 'BASIC',
          txHash: '0x' + '1'.repeat(64),
        })
        .expect(200)

      // Upgrade to PREMIUM
      await request(app)
        .post('/api/subscriptions/upgrade')
        .send({
          userAddress: testUser1,
          newTier: 'PREMIUM',
          txHash: '0x' + '2'.repeat(64),
        })
        .expect(200)

      // Upgrade to ARTIST_SUPPORTER
      const finalUpgrade = await request(app)
        .post('/api/subscriptions/upgrade')
        .send({
          userAddress: testUser1,
          newTier: 'ARTIST_SUPPORTER',
          txHash: '0x' + '3'.repeat(64),
        })
        .expect(200)

      expect(finalUpgrade.body.subscription.tier).toBe('ARTIST_SUPPORTER')

      // Verify all transactions recorded
      const { rows } = await db.query(
        'SELECT * FROM subscription_transactions WHERE user_address = $1 ORDER BY created_at',
        [testUser1]
      )

      expect(rows.length).toBeGreaterThanOrEqual(4) // 1 subscription + 3 upgrades
    })
  })

  // ============================================
  // REVENUE DISTRIBUTION FLOWS
  // ============================================

  describe('Revenue Distribution Flows', () => {
    it('should distribute revenue correctly with multiple users and plays', async () => {
      // User1 subscribes to BASIC (0.01 ETH)
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser1,
          tier: 'BASIC',
          txHash: '0x' + '1'.repeat(64),
        })

      // User2 subscribes to PREMIUM (0.02 ETH)
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser2,
          tier: 'PREMIUM',
          txHash: '0x' + '2'.repeat(64),
        })

      // User3 subscribes to ARTIST_SUPPORTER (0.05 ETH)
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser3,
          tier: 'ARTIST_SUPPORTER',
          txHash: '0x' + '3'.repeat(64),
        })

      // Record plays
      // User1: 10 plays to artist1
      for (let i = 0; i < 10; i++) {
        await db.query(
          `INSERT INTO plays (user_address, artist_address, song_id, created_at)
           VALUES ($1, $2, $3, NOW())`,
          [testUser1, artist1, `song${i}`]
        )
      }

      // User2: 20 plays to artist2
      for (let i = 0; i < 20; i++) {
        await db.query(
          `INSERT INTO plays (user_address, artist_address, song_id, created_at)
           VALUES ($1, $2, $3, NOW())`,
          [testUser2, artist2, `song${i}`]
        )
      }

      // User3: 15 plays to artist1, 5 plays to artist2
      for (let i = 0; i < 15; i++) {
        await db.query(
          `INSERT INTO plays (user_address, artist_address, song_id, created_at)
           VALUES ($1, $2, $3, NOW())`,
          [testUser3, artist1, `song${i}`]
        )
      }
      for (let i = 0; i < 5; i++) {
        await db.query(
          `INSERT INTO plays (user_address, artist_address, song_id, created_at)
           VALUES ($1, $2, $3, NOW())`,
          [testUser3, artist2, `song${i}`]
        )
      }

      // Distribute revenue
      await request(app)
        .post('/api/subscriptions/distribute')
        .send({
          adminKey: process.env.ADMIN_KEY,
        })
        .expect(200)

      // Check artist revenues
      const artist1Rev = await request(app)
        .get('/api/subscriptions/revenue')
        .query({ artistAddress: artist1 })
        .expect(200)

      const artist2Rev = await request(app)
        .get('/api/subscriptions/revenue')
        .query({ artistAddress: artist2 })
        .expect(200)

      // Total revenue: 0.01 + 0.02 + 0.05 = 0.08 ETH
      // Artist share: 70% = 0.056 ETH
      // Total plays: 10 + 20 + 15 + 5 = 50 plays
      // Artist1 plays: 10 + 15 = 25 plays (50% of total)
      // Artist2 plays: 20 + 5 = 25 plays (50% of total)
      // Expected artist1 revenue: 0.056 * 0.5 = 0.028 ETH
      // Expected artist2 revenue: 0.056 * 0.5 = 0.028 ETH

      expect(artist1Rev.body.revenue.playCount).toBe(25)
      expect(artist2Rev.body.revenue.playCount).toBe(25)

      // Revenue should be roughly equal
      const rev1 = parseFloat(artist1Rev.body.revenue.totalRevenue)
      const rev2 = parseFloat(artist2Rev.body.revenue.totalRevenue)

      expect(Math.abs(rev1 - rev2)).toBeLessThan(0.001) // Allow small precision difference
    })

    it('should handle patronage pool distribution correctly', async () => {
      // User subscribes to ARTIST_SUPPORTER tier
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser1,
          tier: 'ARTIST_SUPPORTER',
          txHash: '0x' + '1'.repeat(64),
        })

      // User listens exclusively to artist1
      for (let i = 0; i < 100; i++) {
        await db.query(
          `INSERT INTO plays (user_address, artist_address, song_id, created_at)
           VALUES ($1, $2, $3, NOW())`,
          [testUser1, artist1, `song${i}`]
        )
      }

      // Distribute revenue
      await request(app)
        .post('/api/subscriptions/distribute')
        .send({
          adminKey: process.env.ADMIN_KEY,
        })
        .expect(200)

      // Artist should get base share (70%) + patronage bonus (10%)
      const artistRev = await request(app)
        .get('/api/subscriptions/revenue')
        .query({ artistAddress: artist1 })
        .expect(200)

      // Total: 0.05 ETH
      // Base artist share: 70% = 0.035 ETH
      // Patronage pool: 10% = 0.005 ETH
      // Artist gets all patronage since 100% of plays
      // Expected total: 0.035 + 0.005 = 0.04 ETH

      expect(artistRev.body.revenue.patronageBonus).toBeDefined()
      expect(parseFloat(artistRev.body.revenue.totalRevenue)).toBeCloseTo(0.04, 4)
    })

    it('should distribute patronage pool among multiple artists proportionally', async () => {
      // Two users subscribe to ARTIST_SUPPORTER
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser1,
          tier: 'ARTIST_SUPPORTER',
          txHash: '0x' + '1'.repeat(64),
        })

      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser2,
          tier: 'ARTIST_SUPPORTER',
          txHash: '0x' + '2'.repeat(64),
        })

      // User1 listens to artist1 (75 plays)
      for (let i = 0; i < 75; i++) {
        await db.query(
          `INSERT INTO plays (user_address, artist_address, song_id, created_at)
           VALUES ($1, $2, $3, NOW())`,
          [testUser1, artist1, `song${i}`]
        )
      }

      // User2 listens to artist2 (25 plays)
      for (let i = 0; i < 25; i++) {
        await db.query(
          `INSERT INTO plays (user_address, artist_address, song_id, created_at)
           VALUES ($1, $2, $3, NOW())`,
          [testUser2, artist2, `song${i}`]
        )
      }

      // Distribute
      await request(app)
        .post('/api/subscriptions/distribute')
        .send({
          adminKey: process.env.ADMIN_KEY,
        })

      // Get revenues
      const artist1Rev = await request(app)
        .get('/api/subscriptions/revenue')
        .query({ artistAddress: artist1 })

      const artist2Rev = await request(app)
        .get('/api/subscriptions/revenue')
        .query({ artistAddress: artist2 })

      // Artist1 should get 75% of base + 75% of patronage
      // Artist2 should get 25% of base + 25% of patronage

      const rev1 = parseFloat(artist1Rev.body.revenue.totalRevenue)
      const rev2 = parseFloat(artist2Rev.body.revenue.totalRevenue)

      expect(rev1 / rev2).toBeCloseTo(3, 1) // Should be ~3:1 ratio
    })

    it('should handle zero plays scenario', async () => {
      // User subscribes but doesn't play anything
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser1,
          tier: 'BASIC',
          txHash: '0x' + '1'.repeat(64),
        })

      // Distribute revenue
      const distributeRes = await request(app)
        .post('/api/subscriptions/distribute')
        .send({
          adminKey: process.env.ADMIN_KEY,
        })
        .expect(200)

      // Platform should get the revenue since no plays
      expect(distributeRes.body.platformRevenue).toBeGreaterThan(0)
      expect(distributeRes.body.artistRevenue).toBe(0)
    })
  })

  // ============================================
  // PAYMENT FAILURE HANDLING
  // ============================================

  describe('Payment Failure Handling', () => {
    it('should handle failed renewal gracefully', async () => {
      // 1. User has active subscription
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser1,
          tier: 'BASIC',
          txHash: '0x' + '1'.repeat(64),
        })

      // 2. Simulate time passing to renewal date
      await db.query(
        'UPDATE subscriptions SET end_date = NOW() + interval \'1 day\' WHERE user_address = $1',
        [testUser1]
      )

      // 3. Simulate failed renewal (via backend job)
      await db.query(
        `INSERT INTO subscription_transactions
         (user_address, type, tier, amount, status, tx_hash, error)
         VALUES ($1, 'renewal', 'BASIC', 0.01, 'failed', $2, 'Insufficient funds')`,
        [testUser1, '0x' + 'f'.repeat(64)]
      )

      // 4. Verify grace period starts
      await db.query(
        'UPDATE subscriptions SET grace_period_end = NOW() + interval \'7 days\' WHERE user_address = $1',
        [testUser1]
      )

      const currentRes = await request(app)
        .get('/api/subscriptions/current')
        .query({ userAddress: testUser1 })

      expect(currentRes.body.subscription.in_grace_period).toBe(true)

      // 5. User retries payment
      const retryRes = await request(app)
        .post('/api/subscriptions/billing/retry')
        .send({
          userAddress: testUser1,
          txHash: '0x' + 'r'.repeat(64),
        })
        .expect(200)

      expect(retryRes.body.success).toBe(true)

      // 6. Verify subscription renewed
      const renewedRes = await request(app)
        .get('/api/subscriptions/current')
        .query({ userAddress: testUser1 })

      expect(renewedRes.body.subscription.active).toBe(true)
      expect(renewedRes.body.subscription.in_grace_period).toBe(false)
    })

    it('should suspend subscription after grace period if payment not resolved', async () => {
      // Subscribe
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser1,
          tier: 'BASIC',
          txHash: '0x' + '1'.repeat(64),
        })

      // Simulate failed renewal and expired grace period
      await db.query(
        `UPDATE subscriptions
         SET end_date = NOW() - interval '8 days',
             grace_period_end = NOW() - interval '1 day'
         WHERE user_address = $1`,
        [testUser1]
      )

      await db.query(
        `INSERT INTO subscription_transactions
         (user_address, type, tier, amount, status, tx_hash)
         VALUES ($1, 'renewal', 'BASIC', 0.01, 'failed', $2)`,
        [testUser1, '0x' + 'f'.repeat(64)]
      )

      // Check subscription status
      const res = await request(app)
        .get('/api/subscriptions/current')
        .query({ userAddress: testUser1 })

      expect(res.body.subscription).toBe(null) // Suspended/expired
    })
  })

  // ============================================
  // EDGE CASES
  // ============================================

  describe('Edge Cases', () => {
    it('should handle concurrent upgrades from multiple users', async () => {
      // Multiple users upgrade at the same time
      const promises = [
        request(app)
          .post('/api/subscriptions/subscribe')
          .send({
            userAddress: testUser1,
            tier: 'FREE',
          }),
        request(app)
          .post('/api/subscriptions/subscribe')
          .send({
            userAddress: testUser2,
            tier: 'FREE',
          }),
        request(app)
          .post('/api/subscriptions/subscribe')
          .send({
            userAddress: testUser3,
            tier: 'FREE',
          }),
      ]

      await Promise.all(promises)

      // All upgrade to BASIC simultaneously
      const upgradePromises = [
        request(app)
          .post('/api/subscriptions/upgrade')
          .send({
            userAddress: testUser1,
            newTier: 'BASIC',
            txHash: '0x' + '1'.repeat(64),
          }),
        request(app)
          .post('/api/subscriptions/upgrade')
          .send({
            userAddress: testUser2,
            newTier: 'BASIC',
            txHash: '0x' + '2'.repeat(64),
          }),
        request(app)
          .post('/api/subscriptions/upgrade')
          .send({
            userAddress: testUser3,
            newTier: 'BASIC',
            txHash: '0x' + '3'.repeat(64),
          }),
      ]

      const results = await Promise.all(upgradePromises)

      // All should succeed
      results.forEach((res) => {
        expect(res.status).toBe(200)
        expect(res.body.subscription.tier).toBe('BASIC')
      })
    })

    it('should handle subscription during grace period', async () => {
      // User subscribes
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser1,
          tier: 'BASIC',
          txHash: '0x' + '1'.repeat(64),
        })

      // Simulate expired + in grace period
      await db.query(
        `UPDATE subscriptions
         SET end_date = NOW() - interval '2 days',
             grace_period_end = NOW() + interval '5 days'
         WHERE user_address = $1`,
        [testUser1]
      )

      // User can still access during grace period
      const currentRes = await request(app)
        .get('/api/subscriptions/current')
        .query({ userAddress: testUser1 })

      expect(currentRes.body.subscription.in_grace_period).toBe(true)

      // User renews during grace period
      const renewRes = await request(app)
        .post('/api/subscriptions/billing/retry')
        .send({
          userAddress: testUser1,
          txHash: '0x' + 'r'.repeat(64),
        })
        .expect(200)

      expect(renewRes.body.success).toBe(true)
    })

    it('should handle precision with large revenue pools', async () => {
      // Create many subscriptions
      for (let i = 0; i < 100; i++) {
        const userAddr = ethers.Wallet.createRandom().address

        await request(app)
          .post('/api/subscriptions/subscribe')
          .send({
            userAddress: userAddr,
            tier: 'PREMIUM',
            txHash: '0x' + i.toString().padStart(64, '0'),
          })

        // Each user plays one song
        await db.query(
          `INSERT INTO plays (user_address, artist_address, song_id)
           VALUES ($1, $2, $3)`,
          [userAddr, artist1, `song${i}`]
        )
      }

      // Distribute
      const distributeRes = await request(app)
        .post('/api/subscriptions/distribute')
        .send({
          adminKey: process.env.ADMIN_KEY,
        })
        .expect(200)

      // Total revenue: 100 * 0.02 = 2 ETH
      // Artist share: 70% = 1.4 ETH
      // Should not have precision errors

      const artistRev = await request(app)
        .get('/api/subscriptions/revenue')
        .query({ artistAddress: artist1 })

      expect(artistRev.body.revenue.totalRevenue).toBeCloseTo(1.4, 2)
      expect(artistRev.body.revenue.playCount).toBe(100)
    })

    it('should handle mid-month tier changes correctly', async () => {
      // Subscribe on Jan 1
      await db.query(
        `INSERT INTO subscriptions (user_address, tier, end_date, active, auto_renew, created_at)
         VALUES ($1, 'BASIC', $2, true, true, $3)`,
        [testUser1, new Date('2025-02-01'), new Date('2025-01-01')]
      )

      // Upgrade on Jan 15 (halfway through month)
      await db.query('UPDATE subscriptions SET created_at = $1 WHERE user_address = $2', [
        new Date('2025-01-01'),
        testUser1,
      ])

      const upgradeRes = await request(app)
        .post('/api/subscriptions/upgrade')
        .send({
          userAddress: testUser1,
          newTier: 'PREMIUM',
          txHash: '0x' + '1'.repeat(64),
        })
        .expect(200)

      // Pro-rated amount should be calculated
      expect(upgradeRes.body.proRatedAmount).toBeDefined()
    })
  })

  // ============================================
  // BILLING HISTORY INTEGRATION
  // ============================================

  describe('Billing History Integration', () => {
    it('should track complete transaction history', async () => {
      // 1. Initial subscription
      await request(app)
        .post('/api/subscriptions/subscribe')
        .send({
          userAddress: testUser1,
          tier: 'BASIC',
          txHash: '0x' + '1'.repeat(64),
        })

      // 2. Upgrade
      await request(app)
        .post('/api/subscriptions/upgrade')
        .send({
          userAddress: testUser1,
          newTier: 'PREMIUM',
          txHash: '0x' + '2'.repeat(64),
        })

      // 3. Renewal (simulate)
      await db.query(
        `INSERT INTO subscription_transactions
         (user_address, type, tier, amount, status, tx_hash)
         VALUES ($1, 'renewal', 'PREMIUM', 0.02, 'success', $2)`,
        [testUser1, '0x' + '3'.repeat(64)]
      )

      // 4. Cancel (no transaction, just updates subscription)
      await request(app)
        .post('/api/subscriptions/cancel')
        .send({
          userAddress: testUser1,
        })

      // Get full billing history
      const historyRes = await request(app)
        .get('/api/subscriptions/billing/history')
        .query({ userAddress: testUser1 })

      expect(historyRes.body.transactions).toHaveLength(3) // subscribe, upgrade, renewal
      expect(historyRes.body.transactions.map((t: any) => t.type)).toContain('subscription')
      expect(historyRes.body.transactions.map((t: any) => t.type)).toContain('upgrade')
      expect(historyRes.body.transactions.map((t: any) => t.type)).toContain('renewal')
    })
  })
})
