-- ============================================================================
-- Materialized Views for Performance
-- ============================================================================
-- Creates materialized views for frequently accessed analytics data
-- Run after 001_initial_schema.sql
-- ============================================================================

-- ============================================================================
-- 1. Artist Analytics Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_artist_analytics AS
SELECT
    a.artist_address,
    a.name as artist_name,
    COUNT(DISTINCT s.song_id) as total_songs,
    COUNT(DISTINCT p.id) as total_plays,
    COUNT(DISTINCT p.listener_address) as unique_listeners,
    COALESCE(SUM(p.amount_paid), 0) as total_earnings,
    COALESCE(AVG(p.amount_paid), 0) as avg_earning_per_play,
    MAX(p.played_at) as last_play_date,
    COALESCE(
        SUM(CASE WHEN p.played_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END),
        0
    ) as plays_last_30_days,
    COALESCE(
        SUM(CASE WHEN p.played_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END),
        0
    ) as plays_last_7_days,
    NOW() as last_refreshed
FROM artists a
LEFT JOIN songs s ON a.artist_address = s.artist_address
LEFT JOIN plays p ON s.song_id = p.song_id
GROUP BY a.artist_address, a.name;

-- Create unique index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_artist_analytics_address
    ON mv_artist_analytics(artist_address);

-- Create index on earnings for top artists queries
CREATE INDEX IF NOT EXISTS idx_mv_artist_analytics_earnings
    ON mv_artist_analytics(total_earnings DESC);

-- ============================================================================
-- 2. Song Analytics Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_song_analytics AS
SELECT
    s.song_id,
    s.title,
    s.artist_address,
    s.genre,
    s.strategy,
    COUNT(DISTINCT p.id) as play_count,
    COUNT(DISTINCT p.listener_address) as unique_listeners,
    COALESCE(SUM(p.amount_paid), 0) as total_earnings,
    COALESCE(AVG(p.duration), 0) as avg_play_duration,
    COALESCE(AVG(p.amount_paid), 0) as avg_earning_per_play,
    MAX(p.played_at) as last_played,
    MIN(p.played_at) as first_played,
    COALESCE(
        SUM(CASE WHEN p.played_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END),
        0
    ) as plays_last_7_days,
    COALESCE(
        SUM(CASE WHEN p.played_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END),
        0
    ) as plays_last_30_days,
    -- Trending score: weighted by recency
    COALESCE(
        SUM(
            CASE
                WHEN p.played_at >= NOW() - INTERVAL '1 day' THEN 10
                WHEN p.played_at >= NOW() - INTERVAL '7 days' THEN 5
                WHEN p.played_at >= NOW() - INTERVAL '30 days' THEN 1
                ELSE 0
            END
        ),
        0
    ) as trending_score,
    NOW() as last_refreshed
FROM songs s
LEFT JOIN plays p ON s.song_id = p.song_id
GROUP BY s.song_id, s.title, s.artist_address, s.genre, s.strategy;

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_song_analytics_id
    ON mv_song_analytics(song_id);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_mv_song_analytics_trending
    ON mv_song_analytics(trending_score DESC);

CREATE INDEX IF NOT EXISTS idx_mv_song_analytics_popular
    ON mv_song_analytics(play_count DESC);

CREATE INDEX IF NOT EXISTS idx_mv_song_analytics_recent
    ON mv_song_analytics(last_played DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_mv_song_analytics_genre
    ON mv_song_analytics(genre, play_count DESC);

CREATE INDEX IF NOT EXISTS idx_mv_song_analytics_strategy
    ON mv_song_analytics(strategy, play_count DESC);

-- ============================================================================
-- 3. Platform Statistics Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_platform_stats AS
SELECT
    COUNT(DISTINCT artists.artist_address) as total_artists,
    COUNT(DISTINCT songs.song_id) as total_songs,
    COUNT(DISTINCT plays.id) as total_plays,
    COUNT(DISTINCT plays.listener_address) as total_listeners,
    COALESCE(SUM(plays.amount_paid), 0) as total_volume,
    COALESCE(AVG(plays.amount_paid), 0) as avg_payment,
    -- By strategy
    COUNT(DISTINCT CASE WHEN songs.strategy = 'pay-per-stream' THEN songs.song_id END) as songs_pay_per_stream,
    COUNT(DISTINCT CASE WHEN songs.strategy = 'gift-economy' THEN songs.song_id END) as songs_gift_economy,
    COUNT(DISTINCT CASE WHEN songs.strategy = 'patronage' THEN songs.song_id END) as songs_patronage,
    COUNT(DISTINCT CASE WHEN songs.strategy = 'auction' THEN songs.song_id END) as songs_auction,
    -- Recent activity
    COUNT(DISTINCT CASE WHEN plays.played_at >= NOW() - INTERVAL '24 hours' THEN plays.id END) as plays_last_24h,
    COUNT(DISTINCT CASE WHEN plays.played_at >= NOW() - INTERVAL '7 days' THEN plays.id END) as plays_last_7d,
    COUNT(DISTINCT CASE WHEN plays.played_at >= NOW() - INTERVAL '30 days' THEN plays.id END) as plays_last_30d,
    -- Growth metrics
    COUNT(DISTINCT CASE WHEN songs.created_at >= NOW() - INTERVAL '7 days' THEN songs.song_id END) as new_songs_last_7d,
    COUNT(DISTINCT CASE WHEN songs.created_at >= NOW() - INTERVAL '30 days' THEN songs.song_id END) as new_songs_last_30d,
    NOW() as last_refreshed
FROM artists
FULL OUTER JOIN songs ON artists.artist_address = songs.artist_address
FULL OUTER JOIN plays ON songs.song_id = plays.song_id;

-- ============================================================================
-- 4. Top Songs This Week View
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_songs_week AS
SELECT
    s.song_id,
    s.title,
    s.artist_address,
    a.name as artist_name,
    s.genre,
    COUNT(p.id) as plays,
    RANK() OVER (ORDER BY COUNT(p.id) DESC) as rank
FROM songs s
JOIN plays p ON s.song_id = p.song_id
LEFT JOIN artists a ON s.artist_address = a.artist_address
WHERE p.played_at >= NOW() - INTERVAL '7 days'
GROUP BY s.song_id, s.title, s.artist_address, a.name, s.genre
ORDER BY plays DESC
LIMIT 100;

-- Create index
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_top_songs_week_id
    ON mv_top_songs_week(song_id);

-- ============================================================================
-- 5. Listener Activity View
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_listener_activity AS
SELECT
    p.listener_address,
    COUNT(DISTINCT p.id) as total_plays,
    COUNT(DISTINCT p.song_id) as unique_songs_played,
    COUNT(DISTINCT s.artist_address) as unique_artists,
    COALESCE(SUM(p.amount_paid), 0) as total_spent,
    COALESCE(AVG(p.amount_paid), 0) as avg_spent_per_play,
    MAX(p.played_at) as last_active,
    MIN(p.played_at) as first_active,
    -- Preferences
    MODE() WITHIN GROUP (ORDER BY s.genre) as favorite_genre,
    MODE() WITHIN GROUP (ORDER BY s.strategy) as favorite_strategy,
    -- Activity level
    COUNT(DISTINCT CASE WHEN p.played_at >= NOW() - INTERVAL '7 days' THEN p.id END) as plays_last_7d,
    COUNT(DISTINCT CASE WHEN p.played_at >= NOW() - INTERVAL '30 days' THEN p.id END) as plays_last_30d,
    NOW() as last_refreshed
FROM plays p
JOIN songs s ON p.song_id = s.song_id
GROUP BY p.listener_address;

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_listener_activity_address
    ON mv_listener_activity(listener_address);

-- ============================================================================
-- 6. Genre Statistics View
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_genre_stats AS
SELECT
    s.genre,
    COUNT(DISTINCT s.song_id) as total_songs,
    COUNT(DISTINCT s.artist_address) as total_artists,
    COUNT(DISTINCT p.id) as total_plays,
    COALESCE(SUM(p.amount_paid), 0) as total_earnings,
    COALESCE(AVG(p.amount_paid), 0) as avg_earning_per_play,
    COUNT(DISTINCT p.listener_address) as unique_listeners,
    -- Recent activity
    COUNT(DISTINCT CASE WHEN p.played_at >= NOW() - INTERVAL '7 days' THEN p.id END) as plays_last_7d,
    -- Popularity rank
    RANK() OVER (ORDER BY COUNT(p.id) DESC) as popularity_rank,
    NOW() as last_refreshed
FROM songs s
LEFT JOIN plays p ON s.song_id = p.song_id
WHERE s.genre IS NOT NULL
GROUP BY s.genre;

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_genre_stats_genre
    ON mv_genre_stats(genre);

-- ============================================================================
-- Refresh Functions
-- ============================================================================

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_artist_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_song_analytics;
    REFRESH MATERIALIZED VIEW mv_platform_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_songs_week;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_listener_activity;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_genre_stats;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh artist-specific views
CREATE OR REPLACE FUNCTION refresh_artist_views(artist_addr TEXT)
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_artist_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_song_analytics;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Scheduled Refresh (via cron or external scheduler)
-- ============================================================================

-- To be run by cron or pg_cron extension:
-- Every hour: SELECT refresh_all_materialized_views();
--
-- Or using pg_cron:
-- SELECT cron.schedule('refresh-mvs', '0 * * * *', 'SELECT refresh_all_materialized_views();');

-- ============================================================================
-- Grants
-- ============================================================================

GRANT SELECT ON mv_artist_analytics TO PUBLIC;
GRANT SELECT ON mv_song_analytics TO PUBLIC;
GRANT SELECT ON mv_platform_stats TO PUBLIC;
GRANT SELECT ON mv_top_songs_week TO PUBLIC;
GRANT SELECT ON mv_listener_activity TO PUBLIC;
GRANT SELECT ON mv_genre_stats TO PUBLIC;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON MATERIALIZED VIEW mv_artist_analytics IS
'Artist analytics with aggregated statistics, refreshed hourly';

COMMENT ON MATERIALIZED VIEW mv_song_analytics IS
'Song analytics including trending scores and play metrics';

COMMENT ON MATERIALIZED VIEW mv_platform_stats IS
'Platform-wide statistics and growth metrics';

COMMENT ON MATERIALIZED VIEW mv_top_songs_week IS
'Top 100 songs from the last 7 days, ranked by plays';

COMMENT ON MATERIALIZED VIEW mv_listener_activity IS
'Listener activity patterns and preferences';

COMMENT ON MATERIALIZED VIEW mv_genre_stats IS
'Genre-specific statistics and popularity rankings';
