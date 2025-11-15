-- Migration 005: Creator Tools & Advanced Artist Features
-- Created: 2025-11-15
-- Description: Database schema for professional creator tools including
--              scheduled releases, fan engagement, promotional campaigns,
--              revenue splits, and content moderation

-- ============================================================
-- SCHEDULED RELEASES
-- ============================================================

CREATE TABLE IF NOT EXISTS scheduled_releases (
    id BIGSERIAL PRIMARY KEY,
    artist_address VARCHAR(42) NOT NULL,
    song_id VARCHAR(255),
    song_title VARCHAR(500),
    song_metadata JSONB, -- Complete metadata for scheduled song
    audio_cid VARCHAR(100), -- IPFS CID for audio file
    cover_art_cid VARCHAR(100), -- IPFS CID for cover art
    release_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, published, cancelled, failed
    auto_publish BOOLEAN DEFAULT TRUE,
    notify_followers BOOLEAN DEFAULT TRUE,
    notify_patrons BOOLEAN DEFAULT TRUE,
    pre_save_enabled BOOLEAN DEFAULT FALSE,
    pre_save_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    error_message TEXT,
    CONSTRAINT fk_scheduled_artist FOREIGN KEY (artist_address) REFERENCES artists(artist_address)
);

CREATE INDEX idx_scheduled_releases_artist ON scheduled_releases(artist_address);
CREATE INDEX idx_scheduled_releases_date ON scheduled_releases(release_date) WHERE status = 'pending';
CREATE INDEX idx_scheduled_releases_status ON scheduled_releases(status);

-- ============================================================
-- CREATOR MESSAGES & ANNOUNCEMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS creator_messages (
    id BIGSERIAL PRIMARY KEY,
    artist_address VARCHAR(42) NOT NULL,
    message_type VARCHAR(50) NOT NULL, -- announcement, patron_only, all_followers, direct
    recipient_address VARCHAR(42), -- for direct messages, NULL for broadcasts
    subject VARCHAR(500),
    content TEXT NOT NULL,
    target_tiers TEXT[], -- for patron-only messages: ['gold', 'platinum']
    scheduled_send TIMESTAMPTZ, -- for scheduled announcements
    sent_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'draft', -- draft, scheduled, sent, failed
    recipient_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    unsubscribe_count INTEGER DEFAULT 0,
    metadata JSONB, -- attachments, links, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_message_artist FOREIGN KEY (artist_address) REFERENCES artists(artist_address)
);

CREATE INDEX idx_creator_messages_artist ON creator_messages(artist_address);
CREATE INDEX idx_creator_messages_type ON creator_messages(message_type);
CREATE INDEX idx_creator_messages_status ON creator_messages(status);
CREATE INDEX idx_creator_messages_scheduled ON creator_messages(scheduled_send) WHERE status = 'scheduled';

-- Track individual message reads
CREATE TABLE IF NOT EXISTS message_reads (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES creator_messages(id) ON DELETE CASCADE,
    reader_address VARCHAR(42) NOT NULL,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    clicked BOOLEAN DEFAULT FALSE,
    clicked_at TIMESTAMPTZ,
    UNIQUE(message_id, reader_address)
);

CREATE INDEX idx_message_reads_message ON message_reads(message_id);
CREATE INDEX idx_message_reads_reader ON message_reads(reader_address);

-- ============================================================
-- PROMOTIONAL CAMPAIGNS
-- ============================================================

CREATE TABLE IF NOT EXISTS discount_campaigns (
    id BIGSERIAL PRIMARY KEY,
    artist_address VARCHAR(42) NOT NULL,
    campaign_name VARCHAR(255) NOT NULL,
    campaign_type VARCHAR(50) DEFAULT 'discount', -- discount, free_play, bundle
    discount_code VARCHAR(50) UNIQUE,
    discount_percentage DECIMAL(5,2), -- 0.00 to 100.00
    discount_fixed DECIMAL(20,6), -- fixed amount discount
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    max_uses INTEGER, -- NULL = unlimited
    current_uses INTEGER DEFAULT 0,
    max_uses_per_user INTEGER DEFAULT 1,
    applicable_songs TEXT[], -- empty = all artist's songs
    applicable_strategies TEXT[], -- empty = all strategies
    status VARCHAR(20) DEFAULT 'active', -- active, paused, expired, cancelled
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_campaign_artist FOREIGN KEY (artist_address) REFERENCES artists(artist_address)
);

CREATE INDEX idx_discount_campaigns_artist ON discount_campaigns(artist_address);
CREATE INDEX idx_discount_campaigns_code ON discount_campaigns(discount_code) WHERE status = 'active';
CREATE INDEX idx_discount_campaigns_status ON discount_campaigns(status);
CREATE INDEX idx_discount_campaigns_valid ON discount_campaigns(valid_from, valid_until) WHERE status = 'active';

-- Track campaign usage
CREATE TABLE IF NOT EXISTS campaign_usage (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES discount_campaigns(id) ON DELETE CASCADE,
    user_address VARCHAR(42) NOT NULL,
    song_id VARCHAR(255) NOT NULL,
    original_price DECIMAL(20,6),
    discounted_price DECIMAL(20,6),
    discount_amount DECIMAL(20,6),
    used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_usage_campaign ON campaign_usage(campaign_id);
CREATE INDEX idx_campaign_usage_user ON campaign_usage(user_address);

-- ============================================================
-- REVENUE SPLITS & COLLABORATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS revenue_splits (
    id BIGSERIAL PRIMARY KEY,
    song_id VARCHAR(255) NOT NULL,
    collaborator_address VARCHAR(42) NOT NULL,
    collaborator_name VARCHAR(255),
    split_percentage DECIMAL(5,2) NOT NULL, -- 0.00 to 100.00
    role VARCHAR(100), -- artist, producer, featured_artist, songwriter, engineer
    contribution_description TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    UNIQUE(song_id, collaborator_address),
    CONSTRAINT valid_percentage CHECK (split_percentage >= 0 AND split_percentage <= 100)
);

CREATE INDEX idx_revenue_splits_song ON revenue_splits(song_id);
CREATE INDEX idx_revenue_splits_collaborator ON revenue_splits(collaborator_address);
CREATE INDEX idx_revenue_splits_status ON revenue_splits(status);

-- Track split payments
CREATE TABLE IF NOT EXISTS split_payments (
    id BIGSERIAL PRIMARY KEY,
    split_id BIGINT NOT NULL REFERENCES revenue_splits(id),
    song_id VARCHAR(255) NOT NULL,
    collaborator_address VARCHAR(42) NOT NULL,
    amount DECIMAL(20,6) NOT NULL,
    play_count INTEGER,
    payment_period DATE, -- which month this payment covers
    transaction_hash VARCHAR(66),
    paid_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_split_payments_split ON split_payments(split_id);
CREATE INDEX idx_split_payments_collaborator ON split_payments(collaborator_address);
CREATE INDEX idx_split_payments_period ON split_payments(payment_period);

-- ============================================================
-- CONTENT MODERATION
-- ============================================================

CREATE TABLE IF NOT EXISTS moderation_actions (
    id BIGSERIAL PRIMARY KEY,
    artist_address VARCHAR(42) NOT NULL,
    target_type VARCHAR(50) NOT NULL, -- comment, user, playlist
    target_id VARCHAR(255) NOT NULL, -- ID of the moderated item
    action VARCHAR(50) NOT NULL, -- delete, hide, pin, ban, approve
    reason TEXT,
    duration INTEGER, -- for temporary bans (days)
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_moderation_artist FOREIGN KEY (artist_address) REFERENCES artists(artist_address)
);

CREATE INDEX idx_moderation_actions_artist ON moderation_actions(artist_address);
CREATE INDEX idx_moderation_actions_target ON moderation_actions(target_type, target_id);
CREATE INDEX idx_moderation_actions_action ON moderation_actions(action);

-- Banned users list
CREATE TABLE IF NOT EXISTS banned_users (
    id BIGSERIAL PRIMARY KEY,
    artist_address VARCHAR(42) NOT NULL,
    banned_user_address VARCHAR(42) NOT NULL,
    reason TEXT,
    ban_type VARCHAR(20) DEFAULT 'permanent', -- permanent, temporary
    banned_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    lifted_at TIMESTAMPTZ,
    lifted_by VARCHAR(42),
    UNIQUE(artist_address, banned_user_address),
    CONSTRAINT fk_ban_artist FOREIGN KEY (artist_address) REFERENCES artists(artist_address)
);

CREATE INDEX idx_banned_users_artist ON banned_users(artist_address);
CREATE INDEX idx_banned_users_banned ON banned_users(banned_user_address);
CREATE INDEX idx_banned_users_active ON banned_users(artist_address, banned_user_address) WHERE lifted_at IS NULL;

-- ============================================================
-- CONTENT CALENDAR & REMINDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS content_calendar (
    id BIGSERIAL PRIMARY KEY,
    artist_address VARCHAR(42) NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- release, announcement, promotion, milestone, custom
    title VARCHAR(500) NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    all_day BOOLEAN DEFAULT FALSE,
    color VARCHAR(20), -- for UI display
    status VARCHAR(20) DEFAULT 'planned', -- planned, in_progress, completed, cancelled
    reminder_enabled BOOLEAN DEFAULT TRUE,
    reminder_time TIMESTAMPTZ,
    related_song_id VARCHAR(255),
    related_campaign_id BIGINT REFERENCES discount_campaigns(id),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT fk_calendar_artist FOREIGN KEY (artist_address) REFERENCES artists(artist_address)
);

CREATE INDEX idx_content_calendar_artist ON content_calendar(artist_address);
CREATE INDEX idx_content_calendar_date ON content_calendar(event_date);
CREATE INDEX idx_content_calendar_type ON content_calendar(event_type);
CREATE INDEX idx_content_calendar_status ON content_calendar(status);

-- ============================================================
-- SONG DRAFTS & VERSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS song_drafts (
    id BIGSERIAL PRIMARY KEY,
    artist_address VARCHAR(42) NOT NULL,
    draft_name VARCHAR(500),
    song_metadata JSONB NOT NULL,
    audio_cid VARCHAR(100),
    cover_art_cid VARCHAR(100),
    version_number INTEGER DEFAULT 1,
    is_latest BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'draft', -- draft, review, ready, published
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_song_id VARCHAR(255),
    CONSTRAINT fk_draft_artist FOREIGN KEY (artist_address) REFERENCES artists(artist_address)
);

CREATE INDEX idx_song_drafts_artist ON song_drafts(artist_address);
CREATE INDEX idx_song_drafts_status ON song_drafts(status);
CREATE INDEX idx_song_drafts_latest ON song_drafts(artist_address, is_latest) WHERE is_latest = TRUE;

-- ============================================================
-- ANALYTICS SNAPSHOTS
-- ============================================================

-- Daily analytics snapshots for historical tracking
CREATE TABLE IF NOT EXISTS daily_artist_snapshots (
    id BIGSERIAL PRIMARY KEY,
    artist_address VARCHAR(42) NOT NULL,
    snapshot_date DATE NOT NULL,
    follower_count INTEGER DEFAULT 0,
    patron_count INTEGER DEFAULT 0,
    total_plays INTEGER DEFAULT 0,
    total_songs INTEGER DEFAULT 0,
    total_earnings DECIMAL(20,6) DEFAULT 0,
    avg_plays_per_song DECIMAL(10,2),
    engagement_rate DECIMAL(10,4), -- (comments + likes) / plays
    metadata JSONB, -- additional metrics
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(artist_address, snapshot_date),
    CONSTRAINT fk_snapshot_artist FOREIGN KEY (artist_address) REFERENCES artists(artist_address)
);

CREATE INDEX idx_daily_snapshots_artist_date ON daily_artist_snapshots(artist_address, snapshot_date DESC);
CREATE INDEX idx_daily_snapshots_date ON daily_artist_snapshots(snapshot_date);

-- ============================================================
-- PROMOTIONAL LINKS & TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS promo_links (
    id BIGSERIAL PRIMARY KEY,
    artist_address VARCHAR(42) NOT NULL,
    link_type VARCHAR(50) NOT NULL, -- song, profile, campaign, playlist
    target_id VARCHAR(255) NOT NULL,
    short_code VARCHAR(20) UNIQUE NOT NULL,
    full_url TEXT NOT NULL,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    click_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    CONSTRAINT fk_promo_artist FOREIGN KEY (artist_address) REFERENCES artists(artist_address)
);

CREATE INDEX idx_promo_links_artist ON promo_links(artist_address);
CREATE INDEX idx_promo_links_code ON promo_links(short_code);
CREATE INDEX idx_promo_links_type ON promo_links(link_type, target_id);

-- Track link clicks
CREATE TABLE IF NOT EXISTS promo_link_clicks (
    id BIGSERIAL PRIMARY KEY,
    link_id BIGINT NOT NULL REFERENCES promo_links(id) ON DELETE CASCADE,
    clicked_at TIMESTAMPTZ DEFAULT NOW(),
    referrer TEXT,
    user_agent TEXT,
    ip_address INET,
    converted BOOLEAN DEFAULT FALSE,
    converted_at TIMESTAMPTZ
);

CREATE INDEX idx_promo_clicks_link ON promo_link_clicks(link_id);
CREATE INDEX idx_promo_clicks_time ON promo_link_clicks(clicked_at);

-- ============================================================
-- MATERIALIZED VIEW: CREATOR DASHBOARD STATS
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_creator_dashboard_stats AS
SELECT
    a.artist_address,
    a.name as artist_name,
    COUNT(DISTINCT s.song_id) as total_songs,
    COUNT(DISTINCT af.follower_address) as total_followers,
    COUNT(DISTINCT p.patron_address) as total_patrons,
    SUM(CASE WHEN p.tier = 'bronze' THEN 1 ELSE 0 END) as bronze_patrons,
    SUM(CASE WHEN p.tier = 'silver' THEN 1 ELSE 0 END) as silver_patrons,
    SUM(CASE WHEN p.tier = 'gold' THEN 1 ELSE 0 END) as gold_patrons,
    SUM(CASE WHEN p.tier = 'platinum' THEN 1 ELSE 0 END) as platinum_patrons,
    COALESCE(SUM(song_plays.play_count), 0) as total_plays,
    COALESCE(SUM(song_plays.total_earnings), 0) as total_earnings,
    COUNT(DISTINCT sc.id) as total_comments_received,
    COUNT(DISTINCT ps.playlist_id) as total_playlist_adds,
    COUNT(DISTINCT sr.id) as scheduled_releases_count,
    COUNT(DISTINCT dc.id) as active_campaigns_count
FROM artists a
LEFT JOIN songs s ON a.artist_address = s.artist_address
LEFT JOIN artist_followers af ON a.artist_address = af.artist_address
LEFT JOIN (
    SELECT artist_address, patron_address, tier
    FROM patronage_subscriptions
    WHERE status = 'active'
) p ON a.artist_address = p.artist_address
LEFT JOIN (
    SELECT song_id, COUNT(*) as play_count, SUM(amount_paid) as total_earnings
    FROM plays
    GROUP BY song_id
) song_plays ON s.song_id = song_plays.song_id
LEFT JOIN song_comments sc ON s.song_id = sc.song_id AND sc.is_deleted = FALSE
LEFT JOIN playlist_songs ps ON s.song_id = ps.song_id
LEFT JOIN scheduled_releases sr ON a.artist_address = sr.artist_address AND sr.status = 'pending'
LEFT JOIN discount_campaigns dc ON a.artist_address = dc.artist_address AND dc.status = 'active'
GROUP BY a.artist_address, a.name;

CREATE UNIQUE INDEX idx_creator_dashboard_artist ON mv_creator_dashboard_stats(artist_address);

-- Function to refresh creator dashboard stats
CREATE OR REPLACE FUNCTION refresh_creator_dashboard_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_creator_dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- MATERIALIZED VIEW: TOP PERFORMING SONGS
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_artist_top_songs AS
SELECT
    s.artist_address,
    s.song_id,
    s.title,
    s.genre,
    s.strategy,
    COUNT(DISTINCT p.id) as play_count,
    SUM(p.amount_paid) as total_earnings,
    COUNT(DISTINCT sc.id) as comment_count,
    COUNT(DISTINCT ps.playlist_id) as playlist_adds,
    AVG(CASE WHEN p.amount_paid > 0 THEN p.amount_paid END) as avg_price,
    MAX(p.played_at) as last_played_at,
    (
        COUNT(DISTINCT p.id) * 1.0 +
        COUNT(DISTINCT sc.id) * 5.0 +
        COUNT(DISTINCT ps.playlist_id) * 10.0
    ) as engagement_score,
    ROW_NUMBER() OVER (PARTITION BY s.artist_address ORDER BY COUNT(DISTINCT p.id) DESC) as rank_by_plays,
    ROW_NUMBER() OVER (PARTITION BY s.artist_address ORDER BY SUM(p.amount_paid) DESC) as rank_by_earnings
FROM songs s
LEFT JOIN plays p ON s.song_id = p.song_id
LEFT JOIN song_comments sc ON s.song_id = sc.song_id AND sc.is_deleted = FALSE
LEFT JOIN playlist_songs ps ON s.song_id = ps.song_id
WHERE s.created_at >= NOW() - INTERVAL '90 days'
GROUP BY s.artist_address, s.song_id, s.title, s.genre, s.strategy;

CREATE INDEX idx_artist_top_songs_artist ON mv_artist_top_songs(artist_address, rank_by_plays);
CREATE INDEX idx_artist_top_songs_earnings ON mv_artist_top_songs(artist_address, rank_by_earnings);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to get creator metrics for a date range
CREATE OR REPLACE FUNCTION get_creator_metrics(
    p_artist_address VARCHAR(42),
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
    total_plays BIGINT,
    total_earnings DECIMAL(20,6),
    unique_listeners BIGINT,
    new_followers BIGINT,
    new_patrons BIGINT,
    total_comments BIGINT,
    avg_engagement_rate DECIMAL(10,4)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(DISTINCT p.id)::BIGINT as total_plays,
        COALESCE(SUM(p.amount_paid), 0)::DECIMAL(20,6) as total_earnings,
        COUNT(DISTINCT p.listener_address)::BIGINT as unique_listeners,
        COUNT(DISTINCT af.id)::BIGINT as new_followers,
        COUNT(DISTINCT ps.id)::BIGINT as new_patrons,
        COUNT(DISTINCT sc.id)::BIGINT as total_comments,
        (
            (COUNT(DISTINCT sc.id)::DECIMAL + COUNT(DISTINCT pl.id)::DECIMAL) /
            NULLIF(COUNT(DISTINCT p.id)::DECIMAL, 0) * 100
        )::DECIMAL(10,4) as avg_engagement_rate
    FROM artists a
    LEFT JOIN songs s ON a.artist_address = s.artist_address
    LEFT JOIN plays p ON s.song_id = p.song_id
        AND p.played_at >= p_start_date
        AND p.played_at < p_end_date
    LEFT JOIN artist_followers af ON a.artist_address = af.artist_address
        AND af.followed_at >= p_start_date
        AND af.followed_at < p_end_date
    LEFT JOIN patronage_subscriptions ps ON a.artist_address = ps.artist_address
        AND ps.subscribed_at >= p_start_date
        AND ps.subscribed_at < p_end_date
    LEFT JOIN song_comments sc ON s.song_id = sc.song_id
        AND sc.created_at >= p_start_date
        AND sc.created_at < p_end_date
        AND sc.is_deleted = FALSE
    LEFT JOIN comment_likes pl ON sc.id = pl.comment_id
        AND pl.liked_at >= p_start_date
        AND pl.liked_at < p_end_date
    WHERE a.artist_address = p_artist_address
    GROUP BY a.artist_address;
END;
$$ LANGUAGE plpgsql;

-- Function to process scheduled releases
CREATE OR REPLACE FUNCTION process_scheduled_releases()
RETURNS TABLE (
    release_id BIGINT,
    artist_address VARCHAR(42),
    song_title VARCHAR(500),
    processed BOOLEAN,
    error TEXT
) AS $$
DECLARE
    release_record RECORD;
BEGIN
    FOR release_record IN
        SELECT * FROM scheduled_releases
        WHERE status = 'pending'
        AND release_date <= NOW()
        AND auto_publish = TRUE
        ORDER BY release_date ASC
    LOOP
        BEGIN
            -- This would trigger actual song publishing logic
            -- For now, just mark as published
            UPDATE scheduled_releases
            SET status = 'published', published_at = NOW()
            WHERE id = release_record.id;

            RETURN QUERY SELECT
                release_record.id,
                release_record.artist_address,
                release_record.song_title,
                TRUE,
                NULL::TEXT;
        EXCEPTION WHEN OTHERS THEN
            UPDATE scheduled_releases
            SET status = 'failed', error_message = SQLERRM
            WHERE id = release_record.id;

            RETURN QUERY SELECT
                release_record.id,
                release_record.artist_address,
                release_record.song_title,
                FALSE,
                SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate revenue split for a song
CREATE OR REPLACE FUNCTION calculate_revenue_split(
    p_song_id VARCHAR(255),
    p_total_amount DECIMAL(20,6)
)
RETURNS TABLE (
    collaborator_address VARCHAR(42),
    collaborator_name VARCHAR(255),
    split_amount DECIMAL(20,6),
    split_percentage DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        rs.collaborator_address,
        rs.collaborator_name,
        (p_total_amount * rs.split_percentage / 100)::DECIMAL(20,6) as split_amount,
        rs.split_percentage
    FROM revenue_splits rs
    WHERE rs.song_id = p_song_id
    AND rs.status = 'accepted'
    AND rs.verified = TRUE
    ORDER BY rs.split_percentage DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Automatically update campaign usage count
CREATE OR REPLACE FUNCTION update_campaign_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE discount_campaigns
    SET current_uses = current_uses + 1
    WHERE id = NEW.campaign_id;

    -- Auto-expire if max uses reached
    UPDATE discount_campaigns
    SET status = 'expired'
    WHERE id = NEW.campaign_id
    AND max_uses IS NOT NULL
    AND current_uses >= max_uses;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_campaign_usage
AFTER INSERT ON campaign_usage
FOR EACH ROW
EXECUTE FUNCTION update_campaign_usage_count();

-- Update message read count
CREATE OR REPLACE FUNCTION update_message_read_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE creator_messages
    SET read_count = (
        SELECT COUNT(*) FROM message_reads WHERE message_id = NEW.message_id
    )
    WHERE id = NEW.message_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_message_reads
AFTER INSERT ON message_reads
FOR EACH ROW
EXECUTE FUNCTION update_message_read_count();

-- Update promo link click count
CREATE OR REPLACE FUNCTION update_promo_link_clicks()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE promo_links
    SET click_count = click_count + 1
    WHERE id = NEW.link_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_promo_clicks
AFTER INSERT ON promo_link_clicks
FOR EACH ROW
EXECUTE FUNCTION update_promo_link_clicks();

-- Update promo link conversion count
CREATE OR REPLACE FUNCTION update_promo_link_conversions()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.converted = TRUE AND OLD.converted = FALSE THEN
        UPDATE promo_links
        SET conversion_count = conversion_count + 1
        WHERE id = NEW.link_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_promo_conversions
AFTER UPDATE ON promo_link_clicks
FOR EACH ROW
WHEN (NEW.converted IS DISTINCT FROM OLD.converted)
EXECUTE FUNCTION update_promo_link_conversions();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE scheduled_releases IS 'Stores songs scheduled for future release with auto-publish capability';
COMMENT ON TABLE creator_messages IS 'Artist announcements and messages to followers/patrons';
COMMENT ON TABLE discount_campaigns IS 'Promotional discount campaigns created by artists';
COMMENT ON TABLE revenue_splits IS 'Revenue sharing agreements for song collaborations';
COMMENT ON TABLE moderation_actions IS 'Content moderation actions taken by artists';
COMMENT ON TABLE banned_users IS 'Users banned by artists from commenting/interacting';
COMMENT ON TABLE content_calendar IS 'Artist content planning and scheduling calendar';
COMMENT ON TABLE song_drafts IS 'Work-in-progress songs and version management';
COMMENT ON TABLE daily_artist_snapshots IS 'Daily analytics snapshots for historical tracking';
COMMENT ON TABLE promo_links IS 'Trackable promotional links created by artists';

-- End of migration 005
