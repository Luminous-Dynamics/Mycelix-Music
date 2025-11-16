-- Migration 006: Platform Subscriptions
-- Created: 2025-11-15
-- Description: Database schema for platform-wide subscription system (5th economic model)

-- ============================================================
-- PLATFORM SUBSCRIPTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    subscriber_address VARCHAR(42) NOT NULL,
    tier VARCHAR(20) NOT NULL, -- BASIC, PREMIUM, ARTIST_SUPPORTER
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_billing_date TIMESTAMPTZ,
    next_billing_date TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'active', -- active, cancelled, expired, paused
    payment_method VARCHAR(100),
    auto_renew BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_tier CHECK (tier IN ('BASIC', 'PREMIUM', 'ARTIST_SUPPORTER')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'cancelled', 'expired', 'paused'))
);

CREATE INDEX idx_platform_subscriptions_subscriber ON platform_subscriptions(subscriber_address);
CREATE INDEX idx_platform_subscriptions_status ON platform_subscriptions(status) WHERE status = 'active';
CREATE INDEX idx_platform_subscriptions_tier ON platform_subscriptions(tier) WHERE status = 'active';
CREATE INDEX idx_platform_subscriptions_billing ON platform_subscriptions(next_billing_date) WHERE status = 'active';

-- ============================================================
-- SUBSCRIPTION TRANSACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_transactions (
    id BIGSERIAL PRIMARY KEY,
    subscription_id BIGINT REFERENCES platform_subscriptions(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL, -- charge, renewal, upgrade, downgrade, refund
    amount DECIMAL(20,6) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed, refunded
    transaction_hash VARCHAR(66),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_transaction_type CHECK (transaction_type IN ('charge', 'renewal', 'upgrade', 'downgrade', 'refund')),
    CONSTRAINT valid_transaction_status CHECK (status IN ('pending', 'completed', 'failed', 'refunded'))
);

CREATE INDEX idx_subscription_transactions_subscription ON subscription_transactions(subscription_id);
CREATE INDEX idx_subscription_transactions_status ON subscription_transactions(status);
CREATE INDEX idx_subscription_transactions_created ON subscription_transactions(created_at DESC);

-- ============================================================
-- REVENUE DISTRIBUTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_revenue_distributions (
    id BIGSERIAL PRIMARY KEY,
    month DATE NOT NULL, -- First day of month
    artist_address VARCHAR(42) NOT NULL,
    play_count INTEGER NOT NULL DEFAULT 0,
    total_plays INTEGER NOT NULL DEFAULT 0,
    share_percentage DECIMAL(10,6),
    earnings DECIMAL(20,6),
    distributed BOOLEAN DEFAULT FALSE,
    distributed_at TIMESTAMPTZ,
    transaction_hash VARCHAR(66),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(month, artist_address)
);

CREATE INDEX idx_revenue_distributions_month ON subscription_revenue_distributions(month DESC);
CREATE INDEX idx_revenue_distributions_artist ON subscription_revenue_distributions(artist_address);
CREATE INDEX idx_revenue_distributions_pending ON subscription_revenue_distributions(distributed) WHERE distributed = FALSE;

-- ============================================================
-- MONTHLY REVENUE POOL
-- ============================================================

CREATE TABLE IF NOT EXISTS monthly_subscription_pools (
    id BIGSERIAL PRIMARY KEY,
    month DATE NOT NULL UNIQUE, -- First day of month
    total_revenue DECIMAL(20,6) DEFAULT 0,
    artist_pool DECIMAL(20,6) DEFAULT 0, -- 70%
    platform_share DECIMAL(20,6) DEFAULT 0, -- 20%
    patronage_share DECIMAL(20,6) DEFAULT 0, -- 10%
    total_plays INTEGER DEFAULT 0,
    total_subscribers INTEGER DEFAULT 0,
    distributed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_monthly_pools_month ON monthly_subscription_pools(month DESC);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_subscription_timestamp
BEFORE UPDATE ON platform_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_subscription_timestamp();

-- Auto-calculate revenue distributions when play_count changes
CREATE OR REPLACE FUNCTION calculate_distribution_percentage()
RETURNS TRIGGER AS $$
BEGIN
    -- Update share percentage when play_count changes
    IF NEW.total_plays > 0 THEN
        NEW.share_percentage = (NEW.play_count::DECIMAL / NEW.total_plays::DECIMAL) * 100;

        -- Calculate earnings from artist pool
        DECLARE
            artist_pool DECIMAL(20,6);
        BEGIN
            SELECT mp.artist_pool INTO artist_pool
            FROM monthly_subscription_pools mp
            WHERE mp.month = NEW.month;

            IF FOUND AND artist_pool > 0 THEN
                NEW.earnings = (artist_pool * NEW.play_count::DECIMAL) / NEW.total_plays::DECIMAL;
            END IF;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_distribution
BEFORE UPDATE ON subscription_revenue_distributions
FOR EACH ROW
WHEN (OLD.play_count IS DISTINCT FROM NEW.play_count OR OLD.total_plays IS DISTINCT FROM NEW.total_plays)
EXECUTE FUNCTION calculate_distribution_percentage();

-- ============================================================
-- FUNCTIONS
-- ============================================================

/**
 * Get current subscription status for user
 */
CREATE OR REPLACE FUNCTION get_subscription_status(
    p_user_address VARCHAR(42)
)
RETURNS TABLE (
    has_subscription BOOLEAN,
    tier VARCHAR(20),
    status VARCHAR(20),
    expires_at TIMESTAMPTZ,
    days_remaining INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        TRUE as has_subscription,
        ps.tier,
        ps.status,
        ps.next_billing_date as expires_at,
        EXTRACT(DAY FROM ps.next_billing_date - NOW())::INTEGER as days_remaining
    FROM platform_subscriptions ps
    WHERE ps.subscriber_address = p_user_address
    AND ps.status = 'active'
    ORDER BY ps.created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'FREE'::VARCHAR(20), 'none'::VARCHAR(20), NULL::TIMESTAMPTZ, 0;
    END IF;
END;
$$ LANGUAGE plpgsql;

/**
 * Calculate monthly artist pool from subscriptions
 */
CREATE OR REPLACE FUNCTION calculate_monthly_pool(
    p_month DATE
)
RETURNS DECIMAL(20,6) AS $$
DECLARE
    total_revenue DECIMAL(20,6);
    artist_pool DECIMAL(20,6);
BEGIN
    -- Sum all subscription revenue for the month
    SELECT COALESCE(SUM(amount), 0) INTO total_revenue
    FROM subscription_transactions
    WHERE transaction_type IN ('charge', 'renewal', 'upgrade')
    AND status = 'completed'
    AND DATE_TRUNC('month', created_at) = p_month;

    -- 70% goes to artist pool
    artist_pool = total_revenue * 0.70;

    -- Upsert monthly pool
    INSERT INTO monthly_subscription_pools (month, total_revenue, artist_pool, platform_share, patronage_share)
    VALUES (
        p_month,
        total_revenue,
        artist_pool,
        total_revenue * 0.20,
        total_revenue * 0.10
    )
    ON CONFLICT (month) DO UPDATE SET
        total_revenue = EXCLUDED.total_revenue,
        artist_pool = EXCLUDED.artist_pool,
        platform_share = EXCLUDED.platform_share,
        patronage_share = EXCLUDED.patronage_share;

    RETURN artist_pool;
END;
$$ LANGUAGE plpgsql;

/**
 * Distribute monthly revenue to artists
 */
CREATE OR REPLACE FUNCTION distribute_monthly_revenue(
    p_month DATE
)
RETURNS TABLE (
    artist_address VARCHAR(42),
    play_count INTEGER,
    earnings DECIMAL(20,6),
    share_percentage DECIMAL(10,6)
) AS $$
DECLARE
    total_plays INTEGER;
    artist_pool DECIMAL(20,6);
BEGIN
    -- Get total plays for the month
    SELECT COALESCE(SUM(play_count), 0) INTO total_plays
    FROM subscription_revenue_distributions
    WHERE month = p_month;

    IF total_plays = 0 THEN
        RAISE EXCEPTION 'No plays recorded for month %', p_month;
    END IF;

    -- Get artist pool
    SELECT mp.artist_pool INTO artist_pool
    FROM monthly_subscription_pools mp
    WHERE mp.month = p_month;

    IF NOT FOUND OR artist_pool = 0 THEN
        -- Calculate if not exists
        artist_pool = calculate_monthly_pool(p_month);
    END IF;

    -- Update total_plays for all distributions
    UPDATE subscription_revenue_distributions
    SET total_plays = total_plays
    WHERE month = p_month;

    -- Return distribution details (trigger will calculate share_percentage and earnings)
    RETURN QUERY
    SELECT
        srd.artist_address,
        srd.play_count,
        srd.earnings,
        srd.share_percentage
    FROM subscription_revenue_distributions srd
    WHERE srd.month = p_month
    ORDER BY srd.play_count DESC;
END;
$$ LANGUAGE plpgsql;

/**
 * Get subscription tier pricing
 */
CREATE OR REPLACE FUNCTION get_tier_price(
    p_tier VARCHAR(20)
)
RETURNS DECIMAL(20,6) AS $$
BEGIN
    RETURN CASE
        WHEN p_tier = 'BASIC' THEN 5.0
        WHEN p_tier = 'PREMIUM' THEN 10.0
        WHEN p_tier = 'ARTIST_SUPPORTER' THEN 15.0
        ELSE 0.0
    END;
END;
$$ LANGUAGE plpgsql;

/**
 * Process expired subscriptions (run daily via cron)
 */
CREATE OR REPLACE FUNCTION process_expired_subscriptions()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- Grace period is 3 days
    UPDATE platform_subscriptions
    SET status = 'expired'
    WHERE status = 'active'
    AND next_billing_date < NOW() - INTERVAL '3 days';

    GET DIAGNOSTICS expired_count = ROW_COUNT;

    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- MATERIALIZED VIEW: SUBSCRIPTION STATS
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_subscription_stats AS
SELECT
    ps.tier,
    COUNT(*) as active_count,
    COUNT(*) FILTER (WHERE ps.auto_renew = TRUE) as auto_renew_count,
    AVG(EXTRACT(DAY FROM ps.next_billing_date - ps.start_date)) as avg_subscription_days,
    MIN(ps.start_date) as first_subscription,
    MAX(ps.start_date) as latest_subscription
FROM platform_subscriptions ps
WHERE ps.status = 'active'
GROUP BY ps.tier;

CREATE UNIQUE INDEX idx_mv_subscription_stats_tier ON mv_subscription_stats(tier);

-- Function to refresh stats
CREATE OR REPLACE FUNCTION refresh_subscription_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_subscription_stats;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SEED DATA (Optional - for testing)
-- ============================================================

-- None - subscriptions are user-created

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE platform_subscriptions IS 'Platform-wide subscriptions for unlimited music access (5th economic model)';
COMMENT ON TABLE subscription_transactions IS 'Transaction history for all subscription payments';
COMMENT ON TABLE subscription_revenue_distributions IS 'Monthly artist revenue distribution from subscription pool';
COMMENT ON TABLE monthly_subscription_pools IS 'Monthly subscription revenue pools for distribution';
COMMENT ON COLUMN platform_subscriptions.tier IS 'BASIC ($5), PREMIUM ($10), or ARTIST_SUPPORTER ($15)';
COMMENT ON COLUMN subscription_revenue_distributions.share_percentage IS 'Artist share of total plays (%)';

-- End of migration 006
