# 🚀 Mycelix Music Platform - Improvement Plan (Cycles 8-10)

**Created:** November 16, 2025
**Status:** In Progress
**Previous Cycles:** 1-7 completed (Phases 5-22 + Integration Pages)

---

## 📋 Executive Summary

This plan addresses **critical production readiness gaps** discovered after completing the Platform Subscription and Integration Pages features. With 10,800+ lines of untested code and missing notification infrastructure, we need to ensure the platform is production-ready before deployment.

### Critical Gaps Identified
1. **Testing Gap** - Platform Subscription (4,200 lines) and Integration Pages (810 lines) have NO tests
2. **Notification Gap** - No system to alert users about subscriptions, payments, new content, engagement
3. **DevOps Gap** - No CI/CD pipeline for automated testing and deployment
4. **Monitoring Gap** - No subscription-specific metrics and alerting

### Goals
1. **Production Reliability** - 95%+ test coverage including all recent features
2. **User Engagement** - Real-time notifications for all critical events
3. **DevOps Excellence** - Automated CI/CD with zero-downtime deployments
4. **Observability** - Comprehensive monitoring for subscription metrics

### Estimated Impact
- **+8,000 lines** of test code (contract, API, integration, E2E tests)
- **+3,500 lines** of notification system (backend + frontend)
- **+1,200 lines** of DevOps automation (CI/CD, monitoring)
- **95%+ test coverage** (from 91%)
- **Real-time notifications** for 15+ event types
- **Automated deployments** with GitHub Actions
- **Subscription metrics** dashboard

---

## 🎯 Cycle 8: Comprehensive Testing Infrastructure (Phase 23)

**Priority:** CRITICAL | **Estimated LOC:** 8,000+ | **Timeline:** 1-2 days

### Objectives
Test all recently added features (Platform Subscription, Creator Tools, Integration Pages) to ensure production reliability and achieve 95%+ test coverage.

### Why This Is Critical
- **10,800+ lines** of untested code in production-critical features
- Subscription payment system needs bulletproof testing
- Integration pages are user-facing and need E2E tests
- No tests = production bugs = bad user experience

---

### Component 1: Platform Subscription Contract Tests (1,200 lines)

**File:** `contracts/test/PlatformSubscriptionStrategy.t.sol`

**Test Coverage:**

#### Basic Functionality Tests (300 lines)
```solidity
// Subscription Management
- testSubscribe() - User can subscribe to a tier
- testSubscribeMultipleTiers() - Users can upgrade tiers
- testUnsubscribe() - Users can cancel subscriptions
- testRenewSubscription() - Auto-renewal works correctly
- testGracePeriod() - Grace period prevents immediate cutoff

// Tier Management
- testTierPricing() - All 4 tiers have correct pricing
- testTierFeatures() - Feature access by tier
- testUpgradeTier() - Pro-rated upgrade calculations
- testDowngradeTier() - Downgrade at period end

// Payment Processing
- testPaymentCollection() - Payments collected correctly
- testPaymentDistribution() - 70/20/10 split works
- testFailedPayment() - Handle insufficient funds
- testRefund() - Refund processing
```

#### Revenue Distribution Tests (300 lines)
```solidity
// Artist Revenue
- testArtistRevenueCalculation() - Play-based distribution
- testMultipleArtistPayouts() - Multiple artists get paid
- testArtistWithNoPlays() - Artists with 0 plays get 0
- testRevenueRounding() - No rounding errors

// Platform Revenue
- testPlatformFeeCollection() - 20% platform fee
- testPlatformWithdrawal() - Platform can withdraw fees

// Patronage Pool
- testPatronagePoolFunding() - 10% goes to pool
- testPatronageDistribution() - Artist supporters get extra
- testPatronageEligibility() - Only supporters get bonus
```

#### Edge Cases & Security Tests (400 lines)
```solidity
// Edge Cases
- testZeroPlayRevenue() - No plays = no revenue
- testSubscriptionExpiry() - Expired subs can't access
- testConcurrentSubscriptions() - Multiple concurrent subs
- testFractionalPayments() - Handle wei-level precision

// Security Tests
- testUnauthorizedWithdrawal() - Non-owner can't withdraw
- testReentrancyProtection() - No reentrancy attacks
- testIntegerOverflow() - No overflow vulnerabilities
- testFrontRunning() - Front-running protection
- testDOSPrevention() - Can't DOS the contract

// Upgrade & Admin
- testUpgradeContract() - Contract upgrades work
- testPauseSubscriptions() - Emergency pause works
- testChangeDistribution() - Owner can update splits
```

#### Gas Optimization Tests (200 lines)
```solidity
- testSubscribeGas() - Subscribe costs < 100k gas
- testRenewalGas() - Renewal costs < 80k gas
- testBatchDistributionGas() - Batch payouts optimized
- testStorageOptimization() - Minimal storage slots used
```

**Tools:**
- Forge/Foundry for contract testing
- Gas profiling and optimization
- Fuzz testing for edge cases

---

### Component 2: Subscription API Tests (2,000 lines)

**Files:**
- `apps/api/tests/unit/subscriptions.test.ts` (800 lines)
- `apps/api/tests/integration/subscriptions.test.ts` (1,200 lines)

**Test Coverage:**

#### Unit Tests (800 lines)

**Subscription Endpoints:**
```typescript
// POST /api/subscriptions/subscribe
describe('POST /api/subscriptions/subscribe', () => {
  it('should subscribe user to FREE tier', async () => {})
  it('should subscribe user to BASIC tier with payment', async () => {})
  it('should subscribe user to PREMIUM tier', async () => {})
  it('should subscribe user to ARTIST_SUPPORTER tier', async () => {})
  it('should reject invalid tier', async () => {})
  it('should reject unauthorized users', async () => {})
  it('should handle insufficient funds', async () => {})
})

// POST /api/subscriptions/upgrade
describe('POST /api/subscriptions/upgrade', () => {
  it('should upgrade from FREE to BASIC', async () => {})
  it('should calculate pro-rated amount', async () => {})
  it('should upgrade from BASIC to PREMIUM', async () => {})
  it('should upgrade from PREMIUM to ARTIST_SUPPORTER', async () => {})
  it('should reject downgrade via upgrade endpoint', async () => {})
})

// POST /api/subscriptions/cancel
describe('POST /api/subscriptions/cancel', () => {
  it('should cancel active subscription', async () => {})
  it('should set end date to period end', async () => {})
  it('should disable auto-renewal', async () => {})
  it('should allow access until period end', async () => {})
})

// GET /api/subscriptions/current
describe('GET /api/subscriptions/current', () => {
  it('should return current subscription', async () => {})
  it('should return null for non-subscribers', async () => {})
  it('should include tier details', async () => {})
  it('should include renewal date', async () => {})
})

// GET /api/subscriptions/history
describe('GET /api/subscriptions/history', () => {
  it('should return subscription history', async () => {})
  it('should paginate results', async () => {})
  it('should filter by date range', async () => {})
  it('should include payment status', async () => {})
})

// GET /api/subscriptions/revenue
describe('GET /api/subscriptions/revenue (Artist)', () => {
  it('should return artist revenue from subscriptions', async () => {})
  it('should calculate play-based revenue', async () => {})
  it('should include patronage bonus', async () => {})
  it('should filter by date range', async () => {})
})
```

**Billing Endpoints:**
```typescript
// GET /api/subscriptions/billing/history
describe('GET /api/subscriptions/billing/history', () => {
  it('should return billing transactions', async () => {})
  it('should include successful payments', async () => {})
  it('should include failed payments', async () => {})
  it('should include refunds', async () => {})
  it('should paginate (limit/offset)', async () => {})
})

// POST /api/subscriptions/billing/retry
describe('POST /api/subscriptions/billing/retry', () => {
  it('should retry failed payment', async () => {})
  it('should update subscription status on success', async () => {})
  it('should handle retry failure', async () => {})
})
```

#### Integration Tests (1,200 lines)

**Complete User Flows:**
```typescript
// Subscription Lifecycle
describe('Subscription Lifecycle', () => {
  it('should complete full subscription flow', async () => {
    // 1. User subscribes to BASIC tier
    // 2. Verify subscription created in DB
    // 3. Verify payment processed on-chain
    // 4. Verify revenue distributed correctly
    // 5. User upgrades to PREMIUM
    // 6. Verify pro-rated payment
    // 7. User cancels subscription
    // 8. Verify access until period end
    // 9. Verify subscription expires
  })
})

// Revenue Distribution
describe('Revenue Distribution', () => {
  it('should distribute revenue correctly with plays', async () => {
    // 1. Multiple users subscribe
    // 2. Users listen to different artists
    // 3. Track play counts
    // 4. Calculate expected revenue per artist
    // 5. Verify revenue distribution matches
  })

  it('should handle patronage pool distribution', async () => {
    // 1. User subscribes to ARTIST_SUPPORTER tier
    // 2. User listens to specific artists
    // 3. Verify patronage pool funded (10%)
    // 4. Verify bonus distributed to listened artists
  })
})

// Payment Failures
describe('Payment Failure Handling', () => {
  it('should handle failed renewal gracefully', async () => {
    // 1. User has active subscription
    // 2. Simulate failed renewal payment
    // 3. Verify grace period starts
    // 4. Verify user notified
    // 5. Verify subscription suspended after grace
  })
})

// Edge Cases
describe('Edge Cases', () => {
  it('should handle concurrent upgrades', async () => {})
  it('should handle subscription during grace period', async () => {})
  it('should handle artist with zero plays', async () => {})
  it('should handle precision with large revenue pools', async () => {})
})
```

**Tools:**
- Jest for test framework
- Supertest for API testing
- Test database with migrations
- Mock blockchain interactions

---

### Component 3: Subscription React Hooks Tests (1,500 lines)

**File:** `apps/web/hooks/__tests__/useSubscription.test.tsx`

**Test Coverage:**

#### Hook Tests (1,500 lines)

```typescript
// useCurrentSubscription
describe('useCurrentSubscription', () => {
  it('should fetch current subscription', async () => {})
  it('should return null for non-subscribers', async () => {})
  it('should refetch on wallet change', async () => {})
  it('should cache subscription data', async () => {})
  it('should handle loading states', async () => {})
  it('should handle errors', async () => {})
})

// useSubscribe
describe('useSubscribe', () => {
  it('should subscribe to FREE tier', async () => {})
  it('should subscribe to paid tier', async () => {})
  it('should invalidate cache on success', async () => {})
  it('should handle transaction rejection', async () => {})
  it('should handle insufficient funds', async () => {})
  it('should call onSuccess callback', async () => {})
  it('should call onError callback', async () => {})
})

// useUpgradeSubscription
describe('useUpgradeSubscription', () => {
  it('should upgrade tier', async () => {})
  it('should calculate pro-rated amount', async () => {})
  it('should display confirmation modal', async () => {})
  it('should handle upgrade failure', async () => {})
})

// useCancelSubscription
describe('useCancelSubscription', () => {
  it('should cancel subscription', async () => {})
  it('should show cancellation confirmation', async () => {})
  it('should update UI after cancellation', async () => {})
  it('should handle cancellation error', async () => {})
})

// useBillingHistory
describe('useBillingHistory', () => {
  it('should fetch billing history', async () => {})
  it('should paginate results', async () => {})
  it('should filter by transaction type', async () => {})
  it('should show loading state', async () => {})
})

// useArtistRevenue
describe('useArtistRevenue', () => {
  it('should fetch artist subscription revenue', async () => {})
  it('should include patronage bonus', async () => {})
  it('should filter by date range', async () => {})
  it('should format revenue amounts', async () => {})
})

// useSubscriptionPlans
describe('useSubscriptionPlans', () => {
  it('should return all tier configurations', async () => {})
  it('should mark current tier', async () => {})
  it('should show upgrade/downgrade options', async () => {})
})
```

**Tools:**
- React Testing Library
- Jest
- Mock wagmi hooks
- Mock React Query

---

### Component 4: Integration Page Tests (1,800 lines)

**Files:**
- `apps/web/tests/e2e/subscription-flow.spec.ts` (900 lines)
- `apps/web/tests/e2e/creator-portal.spec.ts` (900 lines)

**Test Coverage:**

#### Subscription Flow E2E Tests (900 lines)

```typescript
// /subscribe page
describe('Subscribe Page', () => {
  it('should display all subscription tiers', async () => {})
  it('should show pricing for each tier', async () => {})
  it('should show features for each tier', async () => {})
  it('should highlight recommended tier', async () => {})

  it('should subscribe to FREE tier', async () => {
    // 1. Navigate to /subscribe
    // 2. Click FREE tier
    // 3. Verify subscription created
    // 4. Redirect to /subscription/manage
  })

  it('should subscribe to BASIC tier with payment', async () => {
    // 1. Navigate to /subscribe
    // 2. Click BASIC tier
    // 3. Connect wallet
    // 4. Approve transaction
    // 5. Verify payment processed
    // 6. Redirect to /subscription/manage
  })
})

// /subscription/manage page
describe('Manage Subscription Page', () => {
  it('should show current subscription details', async () => {})
  it('should show next billing date', async () => {})
  it('should show quick links', async () => {})

  it('should upgrade subscription', async () => {
    // 1. Navigate to /subscription/manage
    // 2. Click upgrade button
    // 3. Select new tier
    // 4. Approve pro-rated payment
    // 5. Verify subscription updated
  })

  it('should cancel subscription', async () => {
    // 1. Navigate to /subscription/manage
    // 2. Click cancel button
    // 3. Confirm cancellation
    // 4. Verify status shows "Active until [date]"
  })

  it('should show wallet connection prompt if not connected', async () => {})
})

// /subscription/billing page
describe('Billing History Page', () => {
  it('should display transaction history', async () => {})
  it('should show successful payments', async () => {})
  it('should show failed payments', async () => {})
  it('should show refunds', async () => {})
  it('should paginate transactions', async () => {})
  it('should show breadcrumb navigation', async () => {})
})
```

#### Creator Portal E2E Tests (900 lines)

```typescript
// /creator/dashboard page
describe('Creator Dashboard Page', () => {
  it('should display creator metrics', async () => {})
  it('should show revenue overview', async () => {})
  it('should show quick actions', async () => {})
  it('should require wallet connection', async () => {})

  it('should navigate to all sections', async () => {
    // Test navigation to songs, fans, analytics, promo, calendar
  })
})

// /creator/songs page
describe('Creator Songs Page', () => {
  it('should display song manager', async () => {})
  it('should show breadcrumb navigation', async () => {})
  it('should require wallet connection', async () => {})
})

// /creator/fans page
describe('Creator Fans Page', () => {
  it('should display fan engagement', async () => {})
  it('should show patron list', async () => {})
  it('should allow sending messages', async () => {})
})

// /creator/analytics page
describe('Creator Analytics Page', () => {
  it('should display analytics dashboard', async () => {})
  it('should show revenue charts', async () => {})
  it('should allow exporting data', async () => {})
})

// /creator/promo page
describe('Creator Promo Page', () => {
  it('should display promotional tools', async () => {})
  it('should allow creating campaigns', async () => {})
})

// /creator/calendar page
describe('Creator Calendar Page', () => {
  it('should display content calendar', async () => {})
  it('should allow scheduling releases', async () => {})
})

// Responsive Tests
describe('Mobile Responsive Tests', () => {
  it('should render correctly on mobile (375px)', async () => {})
  it('should render correctly on tablet (768px)', async () => {})
  it('should render correctly on desktop (1920px)', async () => {})
})
```

**Tools:**
- Playwright for E2E testing
- Visual regression testing
- Mobile viewport testing

---

### Component 5: Creator Tools Tests (1,500 lines)

**Files:**
- `apps/api/tests/unit/creator.test.ts` (600 lines)
- `apps/api/tests/integration/creator.test.ts` (600 lines)
- `apps/web/hooks/__tests__/useCreator.test.tsx` (300 lines)

**Test Coverage:**

#### Creator API Tests (600 lines)
```typescript
// Song Management
describe('Song Management APIs', () => {
  it('should create song draft', async () => {})
  it('should publish song', async () => {})
  it('should schedule release', async () => {})
  it('should update song metadata', async () => {})
  it('should delete song', async () => {})
})

// Fan Engagement
describe('Fan Engagement APIs', () => {
  it('should send message to all followers', async () => {})
  it('should send message to patrons only', async () => {})
  it('should moderate comments', async () => {})
})

// Analytics
describe('Creator Analytics APIs', () => {
  it('should fetch revenue analytics', async () => {})
  it('should fetch audience analytics', async () => {})
  it('should export analytics data', async () => {})
})
```

#### Creator Integration Tests (600 lines)
```typescript
describe('Creator Workflows', () => {
  it('should complete song upload and release flow', async () => {
    // 1. Create draft
    // 2. Upload audio
    // 3. Set metadata
    // 4. Schedule release
    // 5. Auto-publish at scheduled time
  })

  it('should manage fan engagement', async () => {
    // 1. User follows artist
    // 2. Artist sends message
    // 3. Follower receives notification
  })
})
```

#### Creator Hook Tests (300 lines)
```typescript
describe('useCreatorDashboard', () => {
  it('should fetch dashboard data', async () => {})
  it('should refresh metrics', async () => {})
})

describe('useSongManager', () => {
  it('should manage song lifecycle', async () => {})
})
```

---

### Success Metrics

**Test Coverage Targets:**
- [ ] Overall coverage: **95%+** (from 91%)
- [ ] Contract coverage: **100%** (all functions)
- [ ] API coverage: **95%+** (all endpoints)
- [ ] Hook coverage: **90%+** (all hooks)
- [ ] E2E coverage: **100%** (all critical paths)

**Quality Targets:**
- [ ] Zero flaky tests
- [ ] All tests pass in CI/CD
- [ ] Test execution < 5 minutes
- [ ] No skipped tests in production

**Documentation:**
- [ ] Test README with setup instructions
- [ ] Test coverage report published
- [ ] Test patterns documented

---

## 🎯 Cycle 9: Notification System (Phase 18)

**Priority:** HIGH | **Estimated LOC:** 3,500+ | **Timeline:** 1 day

### Objectives
Build comprehensive notification system for user engagement, subscription alerts, and real-time updates.

### Why This Is Critical
- Users need notifications for subscription renewals and payment failures
- Creators need alerts for new followers, comments, patronage
- Real-time engagement drives platform stickiness
- Critical for subscription retention (payment failure alerts)

---

### Component 1: Notification Database Schema (400 lines)

**File:** `apps/api/migrations/007_notifications.sql`

**Schema Design:**

```sql
-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_address VARCHAR(42) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'subscription', 'payment', 'engagement', 'content'
  category VARCHAR(50) NOT NULL, -- 'info', 'warning', 'error', 'success'
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  data JSONB, -- Additional structured data
  link VARCHAR(500), -- Deep link to related page
  read BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- Auto-delete after expiry

  INDEX idx_user_notifications (user_address, created_at DESC),
  INDEX idx_unread_notifications (user_address, read) WHERE read = FALSE,
  INDEX idx_notification_type (type, created_at DESC)
);

-- Notification preferences
CREATE TABLE notification_preferences (
  user_address VARCHAR(42) PRIMARY KEY,
  email_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  in_app_enabled BOOLEAN DEFAULT TRUE,

  -- Category preferences
  subscription_notifications BOOLEAN DEFAULT TRUE,
  payment_notifications BOOLEAN DEFAULT TRUE,
  engagement_notifications BOOLEAN DEFAULT TRUE,
  content_notifications BOOLEAN DEFAULT TRUE,
  marketing_notifications BOOLEAN DEFAULT FALSE,

  -- Delivery preferences
  email_digest BOOLEAN DEFAULT FALSE, -- Daily digest vs real-time
  digest_frequency VARCHAR(20) DEFAULT 'daily', -- 'daily', 'weekly'
  quiet_hours_start TIME,
  quiet_hours_end TIME,

  updated_at TIMESTAMP DEFAULT NOW()
);

-- Email queue (for async processing)
CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  to_address VARCHAR(42) NOT NULL,
  email VARCHAR(255) NOT NULL, -- User's email
  subject VARCHAR(200) NOT NULL,
  template VARCHAR(100) NOT NULL,
  data JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  attempts INTEGER DEFAULT 0,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP,

  INDEX idx_email_queue_status (status, created_at)
);

-- Push subscriptions (for web push)
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_address VARCHAR(42) NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_info JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_user_push_subscriptions (user_address)
);
```

**Indexes for Performance:**
- User notifications (quick fetch)
- Unread notifications (badge count)
- Type-based queries (filtering)
- Email queue processing

---

### Component 2: Notification Backend API (1,200 lines)

**File:** `apps/api/src/routes/notifications.ts`

**API Endpoints:**

```typescript
// GET /api/notifications
// Fetch user's notifications
router.get('/', async (req, res) => {
  // Query params: limit, offset, unread_only, type, category
  // Returns: { notifications: [], total: number, unread_count: number }
})

// GET /api/notifications/:id
// Get single notification
router.get('/:id', async (req, res) => {})

// PATCH /api/notifications/:id/read
// Mark notification as read
router.patch('/:id/read', async (req, res) => {})

// PATCH /api/notifications/mark-all-read
// Mark all notifications as read
router.patch('/mark-all-read', async (req, res) => {})

// DELETE /api/notifications/:id
// Delete/archive notification
router.delete('/:id', async (req, res) => {})

// GET /api/notifications/preferences
// Get notification preferences
router.get('/preferences', async (req, res) => {})

// PUT /api/notifications/preferences
// Update notification preferences
router.put('/preferences', async (req, res) => {})

// POST /api/notifications/subscribe-push
// Subscribe to push notifications
router.post('/subscribe-push', async (req, res) => {
  // Body: { subscription: PushSubscription, deviceInfo: object }
})

// DELETE /api/notifications/unsubscribe-push
// Unsubscribe from push notifications
router.delete('/unsubscribe-push', async (req, res) => {})
```

**Notification Service:**

```typescript
// apps/api/src/services/NotificationService.ts
class NotificationService {
  // Create notification
  async createNotification(params: {
    userAddress: string
    type: NotificationType
    category: NotificationCategory
    title: string
    message: string
    data?: any
    link?: string
  }): Promise<Notification> {
    // 1. Create notification in DB
    // 2. Check user preferences
    // 3. Send via enabled channels (in-app, email, push)
  }

  // Send in-app notification
  async sendInAppNotification(notification: Notification): Promise<void> {
    // Real-time via WebSocket/SSE
  }

  // Send email notification
  async sendEmailNotification(notification: Notification): Promise<void> {
    // Queue email for async processing
  }

  // Send push notification
  async sendPushNotification(notification: Notification): Promise<void> {
    // Send via web push API
  }

  // Batch notifications (for digests)
  async sendDigest(userAddress: string, frequency: 'daily' | 'weekly'): Promise<void> {
    // Aggregate notifications and send digest
  }
}
```

**Event Handlers:**

```typescript
// apps/api/src/events/notificationHandlers.ts

// Subscription events
eventBus.on('subscription.created', async (event) => {
  await notificationService.createNotification({
    userAddress: event.userAddress,
    type: 'subscription',
    category: 'success',
    title: 'Subscription Activated',
    message: `You're now subscribed to the ${event.tier} plan!`,
    link: '/subscription/manage',
  })
})

eventBus.on('subscription.renewed', async (event) => {
  await notificationService.createNotification({
    userAddress: event.userAddress,
    type: 'subscription',
    category: 'info',
    title: 'Subscription Renewed',
    message: `Your ${event.tier} subscription has been renewed.`,
    data: { amount: event.amount, nextBilling: event.nextBilling },
  })
})

eventBus.on('subscription.payment_failed', async (event) => {
  await notificationService.createNotification({
    userAddress: event.userAddress,
    type: 'payment',
    category: 'error',
    title: 'Payment Failed',
    message: 'Your subscription payment failed. Please update your payment method.',
    link: '/subscription/manage',
  })
})

eventBus.on('subscription.expiring_soon', async (event) => {
  await notificationService.createNotification({
    userAddress: event.userAddress,
    type: 'subscription',
    category: 'warning',
    title: 'Subscription Expiring Soon',
    message: `Your subscription expires in ${event.daysRemaining} days.`,
    link: '/subscription/manage',
  })
})

// Engagement events
eventBus.on('user.followed', async (event) => {
  await notificationService.createNotification({
    userAddress: event.artistAddress,
    type: 'engagement',
    category: 'success',
    title: 'New Follower',
    message: `${event.followerName || 'A user'} started following you!`,
    link: `/profile/${event.followerAddress}`,
  })
})

eventBus.on('comment.created', async (event) => {
  await notificationService.createNotification({
    userAddress: event.songOwnerAddress,
    type: 'engagement',
    category: 'info',
    title: 'New Comment',
    message: `${event.commenterName} commented on "${event.songTitle}"`,
    link: `/songs/${event.songId}`,
  })
})

eventBus.on('patronage.received', async (event) => {
  await notificationService.createNotification({
    userAddress: event.artistAddress,
    type: 'payment',
    category: 'success',
    title: 'New Patron',
    message: `${event.patronName} is now supporting you with ${event.amount} ETH/month!`,
    link: '/creator/fans',
  })
})

// Content events
eventBus.on('song.scheduled_release', async (event) => {
  // Notify followers
  const followers = await getFollowers(event.artistAddress)
  for (const follower of followers) {
    await notificationService.createNotification({
      userAddress: follower.address,
      type: 'content',
      category: 'info',
      title: 'New Release Coming',
      message: `${event.artistName} is releasing "${event.songTitle}" on ${event.releaseDate}`,
      link: `/artist/${event.artistAddress}`,
    })
  }
})

eventBus.on('song.published', async (event) => {
  // Notify followers
  const followers = await getFollowers(event.artistAddress)
  for (const follower of followers) {
    await notificationService.createNotification({
      userAddress: follower.address,
      type: 'content',
      category: 'success',
      title: 'New Release',
      message: `${event.artistName} just released "${event.songTitle}"!`,
      link: `/songs/${event.songId}`,
    })
  }
})
```

---

### Component 3: Notification Frontend (1,900 lines)

**Files:**
- `apps/web/hooks/useNotifications.ts` (600 lines)
- `apps/web/components/notifications/NotificationCenter.tsx` (500 lines)
- `apps/web/components/notifications/NotificationBell.tsx` (200 lines)
- `apps/web/components/notifications/NotificationItem.tsx` (200 lines)
- `apps/web/components/notifications/NotificationPreferences.tsx` (400 lines)

**React Hooks:**

```typescript
// apps/web/hooks/useNotifications.ts

export function useNotifications(options?: {
  limit?: number
  unreadOnly?: boolean
  type?: NotificationType
}) {
  return useQuery({
    queryKey: ['notifications', options],
    queryFn: () => fetchNotifications(options),
    refetchInterval: 30000, // Poll every 30s
  })
}

export function useNotificationCount() {
  return useQuery({
    queryKey: ['notification-count'],
    queryFn: () => fetchNotificationCount(),
    refetchInterval: 30000,
  })
}

export function useMarkAsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (notificationId: string) => markNotificationAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications'])
      queryClient.invalidateQueries(['notification-count'])
    },
  })
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => markAllNotificationsAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications'])
      queryClient.invalidateQueries(['notification-count'])
    },
  })
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => fetchNotificationPreferences(),
  })
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (preferences: NotificationPreferences) =>
      updateNotificationPreferences(preferences),
    onSuccess: () => {
      queryClient.invalidateQueries(['notification-preferences'])
    },
  })
}

export function useSubscribeToPush() {
  return useMutation({
    mutationFn: async () => {
      // Request permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') throw new Error('Permission denied')

      // Subscribe to push
      const subscription = await navigator.serviceWorker.ready.then(reg =>
        reg.pushManager.subscribe({ /* ... */ })
      )

      // Send to backend
      return subscribeToPush(subscription)
    },
  })
}
```

**Notification Bell Component:**

```typescript
// apps/web/components/notifications/NotificationBell.tsx

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const { data: count } = useNotificationCount()

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100"
      >
        <BellIcon className="w-6 h-6" />
        {count > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl z-50">
          <NotificationCenter onClose={() => setIsOpen(false)} />
        </div>
      )}
    </div>
  )
}
```

**Notification Center Component:**

```typescript
// apps/web/components/notifications/NotificationCenter.tsx

export function NotificationCenter({ onClose }: { onClose: () => void }) {
  const { data: notifications, isLoading } = useNotifications({ limit: 20 })
  const markAllAsRead = useMarkAllAsRead()

  return (
    <div className="max-h-[600px] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold text-lg">Notifications</h3>
        <div className="flex gap-2">
          <button
            onClick={() => markAllAsRead.mutate()}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Mark all read
          </button>
          <button onClick={onClose}>
            <XIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <Tab>All</Tab>
        <Tab>Unread</Tab>
        <Tab>Subscriptions</Tab>
        <Tab>Engagement</Tab>
      </div>

      {/* Notification List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center">Loading...</div>
        ) : notifications?.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No notifications
          </div>
        ) : (
          notifications?.map(notification => (
            <NotificationItem
              key={notification.id}
              notification={notification}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t text-center">
        <Link href="/notifications">
          <a className="text-sm text-blue-600 hover:text-blue-700">
            View all notifications
          </a>
        </Link>
      </div>
    </div>
  )
}
```

**Notification Item Component:**

```typescript
// apps/web/components/notifications/NotificationItem.tsx

export function NotificationItem({ notification }: { notification: Notification }) {
  const markAsRead = useMarkAsRead()
  const router = useRouter()

  const handleClick = () => {
    if (!notification.read) {
      markAsRead.mutate(notification.id)
    }
    if (notification.link) {
      router.push(notification.link)
    }
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'p-4 border-b cursor-pointer hover:bg-gray-50',
        !notification.read && 'bg-blue-50'
      )}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          {getNotificationIcon(notification.type, notification.category)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-sm">{notification.title}</h4>
            {!notification.read && (
              <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />
            )}
          </div>

          <p className="text-sm text-gray-600 mt-1">
            {notification.message}
          </p>

          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <TimeAgo date={notification.created_at} />
            {notification.link && (
              <>
                <span>•</span>
                <span className="text-blue-600">View details →</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Notification Preferences Page:**

```typescript
// apps/web/components/notifications/NotificationPreferences.tsx

export function NotificationPreferences() {
  const { data: preferences } = useNotificationPreferences()
  const updatePreferences = useUpdateNotificationPreferences()
  const subscribeToPush = useSubscribeToPush()

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Notification Preferences</h2>

      {/* Delivery Methods */}
      <section className="mb-8">
        <h3 className="font-semibold mb-4">Delivery Methods</h3>

        <div className="space-y-3">
          <Toggle
            label="In-App Notifications"
            checked={preferences?.in_app_enabled}
            onChange={(checked) =>
              updatePreferences.mutate({ ...preferences, in_app_enabled: checked })
            }
          />

          <Toggle
            label="Email Notifications"
            checked={preferences?.email_enabled}
            onChange={(checked) =>
              updatePreferences.mutate({ ...preferences, email_enabled: checked })
            }
          />

          <div>
            <Toggle
              label="Push Notifications"
              checked={preferences?.push_enabled}
              onChange={(checked) => {
                if (checked) {
                  subscribeToPush.mutate()
                } else {
                  updatePreferences.mutate({ ...preferences, push_enabled: false })
                }
              }}
            />
            <p className="text-sm text-gray-500 mt-1 ml-7">
              Get real-time alerts even when you're not on the site
            </p>
          </div>
        </div>
      </section>

      {/* Notification Categories */}
      <section className="mb-8">
        <h3 className="font-semibold mb-4">What to notify me about</h3>

        <div className="space-y-3">
          <Toggle
            label="Subscription & Billing"
            description="Renewals, payment failures, upgrades"
            checked={preferences?.subscription_notifications}
            onChange={(checked) =>
              updatePreferences.mutate({ ...preferences, subscription_notifications: checked })
            }
          />

          <Toggle
            label="Engagement & Social"
            description="New followers, comments, likes"
            checked={preferences?.engagement_notifications}
            onChange={(checked) =>
              updatePreferences.mutate({ ...preferences, engagement_notifications: checked })
            }
          />

          <Toggle
            label="New Content"
            description="New releases from artists you follow"
            checked={preferences?.content_notifications}
            onChange={(checked) =>
              updatePreferences.mutate({ ...preferences, content_notifications: checked })
            }
          />

          <Toggle
            label="Payment & Revenue"
            description="New patronage, revenue updates"
            checked={preferences?.payment_notifications}
            onChange={(checked) =>
              updatePreferences.mutate({ ...preferences, payment_notifications: checked })
            }
          />

          <Toggle
            label="Marketing & Updates"
            description="Platform updates, new features, tips"
            checked={preferences?.marketing_notifications}
            onChange={(checked) =>
              updatePreferences.mutate({ ...preferences, marketing_notifications: checked })
            }
          />
        </div>
      </section>

      {/* Email Preferences */}
      <section>
        <h3 className="font-semibold mb-4">Email Preferences</h3>

        <div className="space-y-3">
          <Toggle
            label="Email Digest"
            description="Receive a summary instead of individual emails"
            checked={preferences?.email_digest}
            onChange={(checked) =>
              updatePreferences.mutate({ ...preferences, email_digest: checked })
            }
          />

          {preferences?.email_digest && (
            <Select
              label="Digest Frequency"
              value={preferences.digest_frequency}
              onChange={(value) =>
                updatePreferences.mutate({ ...preferences, digest_frequency: value })
              }
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
              ]}
            />
          )}
        </div>
      </section>
    </div>
  )
}
```

---

### Success Metrics

**Notification System:**
- [ ] 15+ notification event types implemented
- [ ] Multi-channel delivery (in-app, email, push)
- [ ] User preference management
- [ ] Real-time delivery (< 1s latency)
- [ ] Email digest functionality

**User Engagement:**
- [ ] Notification open rate > 40%
- [ ] Push subscription rate > 30%
- [ ] Preference customization rate > 50%

**Reliability:**
- [ ] 99.9% delivery success rate
- [ ] Email queue processing < 1min
- [ ] Zero notification spam

---

## 🎯 Cycle 10: DevOps & CI/CD Pipeline (Phase 21)

**Priority:** HIGH | **Estimated LOC:** 1,200+ | **Timeline:** 1 day

### Objectives
Automate testing, building, and deployment with GitHub Actions CI/CD pipeline.

### Why This Is Critical
- Manual deployment is error-prone
- Need automated testing before merge
- Enable continuous delivery
- Production deployments should be one-click

---

### Component 1: GitHub Actions Workflows (600 lines)

**Files:**
- `.github/workflows/ci.yml` (300 lines)
- `.github/workflows/deploy.yml` (200 lines)
- `.github/workflows/contract-tests.yml` (100 lines)

**CI Workflow:**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop, claude/**]
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    name: Lint Code
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run Prettier
        run: npm run format:check

  test-contracts:
    name: Test Smart Contracts
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: recursive

      - name: Install Foundry
        uses: foundry-rs/foundry-toolchain@v1

      - name: Run Forge tests
        run: |
          cd contracts
          forge test -vvv

      - name: Run Forge coverage
        run: |
          cd contracts
          forge coverage --report lcov

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./contracts/lcov.info
          flags: contracts

  test-api:
    name: Test API
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: mycelix_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/mycelix_test

      - name: Run API tests
        run: npm run test:api
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/mycelix_test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./apps/api/coverage/lcov.info
          flags: api

  test-web:
    name: Test Web App
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:web

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./apps/web/coverage/lcov.info
          flags: web

  test-e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-results
          path: apps/web/test-results/

  build:
    name: Build All Packages
    runs-on: ubuntu-latest
    needs: [lint, test-contracts, test-api, test-web]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build contracts
        run: npm run build:contracts

      - name: Build SDK
        run: npm run build:sdk

      - name: Build API
        run: npm run build:api

      - name: Build Web
        run: npm run build:web

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-artifacts
          path: |
            contracts/out
            packages/sdk/dist
            apps/api/dist
            apps/web/.next
```

**Deploy Workflow:**

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        type: choice
        options:
          - staging
          - production

jobs:
  deploy-contracts:
    name: Deploy Smart Contracts
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment || 'production' }}
    steps:
      - uses: actions/checkout@v3

      - name: Install Foundry
        uses: foundry-rs/foundry-toolchain@v1

      - name: Deploy contracts
        run: |
          cd contracts
          forge script script/Deploy.s.sol --rpc-url ${{ secrets.RPC_URL }} --private-key ${{ secrets.DEPLOYER_PRIVATE_KEY }} --broadcast

  deploy-api:
    name: Deploy API
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment || 'production' }}
    needs: [deploy-contracts]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build API
        run: npm run build:api

      - name: Deploy to Railway/Render
        run: |
          # Deploy command here
          echo "Deploying API..."

  deploy-web:
    name: Deploy Web App
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment || 'production' }}
    needs: [deploy-api]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build Web
        run: npm run build:web
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.API_URL }}
          NEXT_PUBLIC_CONTRACT_ADDRESS: ${{ secrets.CONTRACT_ADDRESS }}

      - name: Deploy to Vercel
        run: |
          npx vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
```

---

### Component 2: Docker Configuration (300 lines)

**Files:**
- `docker-compose.yml` (150 lines)
- `Dockerfile.api` (75 lines)
- `Dockerfile.web` (75 lines)

**Docker Compose for Local Development:**

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: mycelix
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - '5432:5432'
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - '6379:6379'

  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    ports:
      - '3001:3001'
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/mycelix
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - ./apps/api:/app/apps/api

  web:
    build:
      context: .
      dockerfile: Dockerfile.web
    ports:
      - '3000:3000'
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001
    depends_on:
      - api
    volumes:
      - ./apps/web:/app/apps/web

volumes:
  postgres-data:
```

---

### Component 3: Environment Management (300 lines)

**Files:**
- `.env.example` (updated with all variables)
- `scripts/setup-env.sh` (100 lines)
- `docs/DEPLOYMENT.md` (200 lines)

**Environment Variables:**

```bash
# .env.example

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mycelix
REDIS_URL=redis://localhost:6379

# Blockchain
RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
CHAIN_ID=1
CONTRACT_ADDRESS=0x...

# API
API_PORT=3001
API_URL=http://localhost:3001
JWT_SECRET=your-jwt-secret
CORS_ORIGIN=http://localhost:3000

# Web
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=1

# Notifications
SENDGRID_API_KEY=your-sendgrid-key
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key

# Monitoring
SENTRY_DSN=https://...@sentry.io/...

# AWS (for file uploads)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=mycelix-uploads
AWS_REGION=us-east-1
```

---

### Success Metrics

**CI/CD Pipeline:**
- [ ] All tests run automatically on PR
- [ ] Build artifacts generated
- [ ] Deployment automated
- [ ] Zero-downtime deployments
- [ ] Rollback capability

**Performance:**
- [ ] CI pipeline runs < 10 minutes
- [ ] Deployment time < 5 minutes
- [ ] Test parallelization enabled

**Quality Gates:**
- [ ] All tests must pass before merge
- [ ] Coverage threshold enforced (95%+)
- [ ] Linting must pass
- [ ] No TypeScript errors

---

## 📊 Overall Session Goals

### Completion Targets

**By End of Cycle 8 (Testing):**
- ✅ 95%+ test coverage
- ✅ All subscription features tested
- ✅ All integration pages tested
- ✅ Contract security verified

**By End of Cycle 9 (Notifications):**
- ✅ Real-time notification system
- ✅ Multi-channel delivery
- ✅ User preferences
- ✅ 15+ event types

**By End of Cycle 10 (DevOps):**
- ✅ Automated CI/CD
- ✅ One-click deployments
- ✅ Environment management
- ✅ Docker containerization

### Final Platform Status

**Code Metrics:**
- Lines of Code: **105,000+** (from 93,200+)
- Test Coverage: **95%+** (from 91%)
- Files: **95+** (from 83)
- Documentation: **16,000+** lines

**Production Readiness:**
- ✅ All features tested
- ✅ Notifications active
- ✅ CI/CD automated
- ✅ Ready for launch

---

## 📝 Implementation Order

1. **Start with Cycle 8 (Testing)** - CRITICAL GAP
   - Phase 1: Contract tests (1 day)
   - Phase 2: API tests (1 day)
   - Phase 3: Hook tests (0.5 days)
   - Phase 4: E2E tests (0.5 days)

2. **Then Cycle 9 (Notifications)** - HIGH IMPACT
   - Phase 1: Database schema (0.5 days)
   - Phase 2: Backend API (0.5 days)
   - Phase 3: Frontend UI (0.5 days)

3. **Finally Cycle 10 (DevOps)** - PRODUCTION READY
   - Phase 1: GitHub Actions (0.5 days)
   - Phase 2: Docker setup (0.5 days)

**Total Timeline:** 3-5 days for all three cycles

---

## 🎯 Success Definition

This improvement plan succeeds when:

1. **Production Confidence** - 95%+ test coverage gives confidence to deploy
2. **User Engagement** - Notifications keep users informed and engaged
3. **Deployment Speed** - CI/CD enables rapid, safe deployments
4. **Platform Complete** - All major features built, tested, and production-ready

**The Mycelix Music platform will be ready for production launch! 🚀**
