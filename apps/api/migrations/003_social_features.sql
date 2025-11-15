-- Migration 003: Social Features
-- Following, Comments, Playlists, User Profiles

-- ============================================================================
-- FOLLOWING SYSTEM
-- ============================================================================

-- Artist following
CREATE TABLE IF NOT EXISTS artist_followers (
    id BIGSERIAL PRIMARY KEY,
    follower_address VARCHAR(42) NOT NULL,  -- User following
    artist_address VARCHAR(42) NOT NULL,    -- Artist being followed
    followed_at TIMESTAMPTZ DEFAULT NOW(),
    notifications_enabled BOOLEAN DEFAULT TRUE,
    UNIQUE(follower_address, artist_address),
    CHECK (follower_address != artist_address)  -- Can't follow yourself
);

CREATE INDEX idx_artist_followers_follower ON artist_followers(follower_address);
CREATE INDEX idx_artist_followers_artist ON artist_followers(artist_address);
CREATE INDEX idx_artist_followers_created ON artist_followers(followed_at DESC);

-- ============================================================================
-- COMMENTS SYSTEM
-- ============================================================================

-- Comments on songs
CREATE TABLE IF NOT EXISTS song_comments (
    id BIGSERIAL PRIMARY KEY,
    song_id VARCHAR(255) NOT NULL,
    commenter_address VARCHAR(42) NOT NULL,
    parent_comment_id BIGINT REFERENCES song_comments(id) ON DELETE CASCADE,  -- For replies
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    CHECK (LENGTH(content) > 0 AND LENGTH(content) <= 5000)
);

CREATE INDEX idx_song_comments_song ON song_comments(song_id, created_at DESC);
CREATE INDEX idx_song_comments_commenter ON song_comments(commenter_address);
CREATE INDEX idx_song_comments_parent ON song_comments(parent_comment_id);
CREATE INDEX idx_song_comments_created ON song_comments(created_at DESC);

-- Comment likes/reactions
CREATE TABLE IF NOT EXISTS comment_likes (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT NOT NULL REFERENCES song_comments(id) ON DELETE CASCADE,
    liker_address VARCHAR(42) NOT NULL,
    reaction_type VARCHAR(20) DEFAULT 'like',  -- like, love, fire, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, liker_address)
);

CREATE INDEX idx_comment_likes_comment ON comment_likes(comment_id);
CREATE INDEX idx_comment_likes_liker ON comment_likes(liker_address);

-- ============================================================================
-- PLAYLISTS
-- ============================================================================

-- User playlists
CREATE TABLE IF NOT EXISTS playlists (
    id BIGSERIAL PRIMARY KEY,
    playlist_id VARCHAR(255) UNIQUE NOT NULL,
    owner_address VARCHAR(42) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    is_collaborative BOOLEAN DEFAULT FALSE,
    cover_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (LENGTH(name) > 0 AND LENGTH(name) <= 255)
);

CREATE INDEX idx_playlists_owner ON playlists(owner_address, created_at DESC);
CREATE INDEX idx_playlists_public ON playlists(is_public, created_at DESC) WHERE is_public = TRUE;
CREATE INDEX idx_playlists_id ON playlists(playlist_id);

-- Playlist songs (order matters)
CREATE TABLE IF NOT EXISTS playlist_songs (
    id BIGSERIAL PRIMARY KEY,
    playlist_id VARCHAR(255) NOT NULL REFERENCES playlists(playlist_id) ON DELETE CASCADE,
    song_id VARCHAR(255) NOT NULL,
    added_by_address VARCHAR(42) NOT NULL,
    position INTEGER NOT NULL,  -- Order in playlist
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(playlist_id, song_id),
    UNIQUE(playlist_id, position)
);

CREATE INDEX idx_playlist_songs_playlist ON playlist_songs(playlist_id, position);
CREATE INDEX idx_playlist_songs_song ON playlist_songs(song_id);
CREATE INDEX idx_playlist_songs_added_by ON playlist_songs(added_by_address);

-- Playlist collaborators (for collaborative playlists)
CREATE TABLE IF NOT EXISTS playlist_collaborators (
    id BIGSERIAL PRIMARY KEY,
    playlist_id VARCHAR(255) NOT NULL REFERENCES playlists(playlist_id) ON DELETE CASCADE,
    collaborator_address VARCHAR(42) NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    can_add_songs BOOLEAN DEFAULT TRUE,
    can_remove_songs BOOLEAN DEFAULT TRUE,
    can_reorder BOOLEAN DEFAULT TRUE,
    UNIQUE(playlist_id, collaborator_address)
);

CREATE INDEX idx_playlist_collaborators_playlist ON playlist_collaborators(playlist_id);
CREATE INDEX idx_playlist_collaborators_user ON playlist_collaborators(collaborator_address);

-- Playlist followers
CREATE TABLE IF NOT EXISTS playlist_followers (
    id BIGSERIAL PRIMARY KEY,
    playlist_id VARCHAR(255) NOT NULL REFERENCES playlists(playlist_id) ON DELETE CASCADE,
    follower_address VARCHAR(42) NOT NULL,
    followed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(playlist_id, follower_address)
);

CREATE INDEX idx_playlist_followers_playlist ON playlist_followers(playlist_id);
CREATE INDEX idx_playlist_followers_user ON playlist_followers(follower_address);

-- ============================================================================
-- USER PROFILES
-- ============================================================================

-- Extended user profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    id BIGSERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    website_url TEXT,
    twitter_handle VARCHAR(50),
    instagram_handle VARCHAR(50),
    spotify_url TEXT,
    location VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (LENGTH(bio) <= 1000)
);

CREATE INDEX idx_user_profiles_address ON user_profiles(wallet_address);
CREATE INDEX idx_user_profiles_display_name ON user_profiles(display_name);

-- ============================================================================
-- ACTIVITY FEED
-- ============================================================================

-- Activity feed events
CREATE TABLE IF NOT EXISTS activity_feed (
    id BIGSERIAL PRIMARY KEY,
    actor_address VARCHAR(42) NOT NULL,  -- Who did the action
    activity_type VARCHAR(50) NOT NULL,  -- play, comment, follow, release, etc.
    target_type VARCHAR(50),              -- song, artist, playlist
    target_id VARCHAR(255),               -- ID of the target
    metadata JSONB,                       -- Additional data
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_feed_actor ON activity_feed(actor_address, created_at DESC);
CREATE INDEX idx_activity_feed_type ON activity_feed(activity_type, created_at DESC);
CREATE INDEX idx_activity_feed_created ON activity_feed(created_at DESC);
CREATE INDEX idx_activity_feed_target ON activity_feed(target_type, target_id);

-- Index for JSONB queries
CREATE INDEX idx_activity_feed_metadata ON activity_feed USING gin(metadata);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

-- User notifications
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    recipient_address VARCHAR(42) NOT NULL,
    notification_type VARCHAR(50) NOT NULL,  -- new_follower, new_comment, new_release, etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_address, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(recipient_address, is_read, created_at DESC) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_type ON notifications(notification_type);

-- ============================================================================
-- MATERIALIZED VIEWS FOR SOCIAL ANALYTICS
-- ============================================================================

-- Popular playlists
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_popular_playlists AS
SELECT
    p.playlist_id,
    p.name,
    p.owner_address,
    p.description,
    p.cover_image_url,
    p.is_public,
    COUNT(DISTINCT pf.follower_address) as follower_count,
    COUNT(DISTINCT ps.song_id) as song_count,
    p.created_at,
    p.updated_at,
    NOW() as last_refreshed
FROM playlists p
LEFT JOIN playlist_followers pf ON p.playlist_id = pf.playlist_id
LEFT JOIN playlist_songs ps ON p.playlist_id = ps.playlist_id
WHERE p.is_public = TRUE
GROUP BY p.playlist_id, p.name, p.owner_address, p.description, p.cover_image_url, p.is_public, p.created_at, p.updated_at;

CREATE INDEX idx_mv_popular_playlists_followers ON mv_popular_playlists(follower_count DESC);
CREATE INDEX idx_mv_popular_playlists_owner ON mv_popular_playlists(owner_address);

-- Artist social stats
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_artist_social_stats AS
SELECT
    a.artist_address,
    a.name as artist_name,
    COUNT(DISTINCT af.follower_address) as follower_count,
    COUNT(DISTINCT sc.id) as total_comments_received,
    COUNT(DISTINCT act.id) as activity_count,
    MAX(af.followed_at) as last_new_follower,
    NOW() as last_refreshed
FROM artists a
LEFT JOIN artist_followers af ON a.artist_address = af.artist_address
LEFT JOIN songs s ON a.artist_address = s.artist_address
LEFT JOIN song_comments sc ON s.song_id = sc.song_id
LEFT JOIN activity_feed act ON a.artist_address = act.actor_address
GROUP BY a.artist_address, a.name;

CREATE INDEX idx_mv_artist_social_stats_followers ON mv_artist_social_stats(follower_count DESC);
CREATE INDEX idx_mv_artist_social_stats_artist ON mv_artist_social_stats(artist_address);

-- Song engagement stats
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_song_engagement AS
SELECT
    s.song_id,
    s.title,
    s.artist_address,
    COUNT(DISTINCT sc.id) as comment_count,
    COUNT(DISTINCT sc.commenter_address) as unique_commenters,
    COUNT(DISTINCT cl.liker_address) as total_likes,
    COUNT(DISTINCT ps.playlist_id) as playlist_adds,
    MAX(sc.created_at) as last_comment_at,
    NOW() as last_refreshed
FROM songs s
LEFT JOIN song_comments sc ON s.song_id = sc.song_id AND sc.is_deleted = FALSE
LEFT JOIN comment_likes cl ON sc.id = cl.comment_id
LEFT JOIN playlist_songs ps ON s.song_id = ps.song_id
GROUP BY s.song_id, s.title, s.artist_address;

CREATE INDEX idx_mv_song_engagement_song ON mv_song_engagement(song_id);
CREATE INDEX idx_mv_song_engagement_comments ON mv_song_engagement(comment_count DESC);
CREATE INDEX idx_mv_song_engagement_likes ON mv_song_engagement(total_likes DESC);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get user's feed
CREATE OR REPLACE FUNCTION get_user_feed(
    user_addr VARCHAR(42),
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    id BIGINT,
    actor_address VARCHAR(42),
    activity_type VARCHAR(50),
    target_type VARCHAR(50),
    target_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        af.id,
        af.actor_address,
        af.activity_type,
        af.target_type,
        af.target_id,
        af.metadata,
        af.created_at
    FROM activity_feed af
    WHERE af.actor_address IN (
        -- Include followed artists
        SELECT artist_address FROM artist_followers WHERE follower_address = user_addr
        UNION
        -- Include self
        SELECT user_addr
    )
    ORDER BY af.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- Function to create activity
CREATE OR REPLACE FUNCTION create_activity(
    actor VARCHAR(42),
    act_type VARCHAR(50),
    tgt_type VARCHAR(50),
    tgt_id VARCHAR(255),
    meta JSONB DEFAULT '{}'::JSONB
)
RETURNS BIGINT AS $$
DECLARE
    activity_id BIGINT;
BEGIN
    INSERT INTO activity_feed (actor_address, activity_type, target_type, target_id, metadata)
    VALUES (actor, act_type, tgt_type, tgt_id, meta)
    RETURNING id INTO activity_id;

    RETURN activity_id;
END;
$$ LANGUAGE plpgsql;

-- Function to notify followers
CREATE OR REPLACE FUNCTION notify_followers(
    artist VARCHAR(42),
    notif_type VARCHAR(50),
    title VARCHAR(255),
    message TEXT,
    action_url TEXT DEFAULT NULL,
    meta JSONB DEFAULT '{}'::JSONB
)
RETURNS INTEGER AS $$
DECLARE
    notification_count INTEGER;
BEGIN
    INSERT INTO notifications (
        recipient_address,
        notification_type,
        title,
        message,
        action_url,
        metadata
    )
    SELECT
        follower_address,
        notif_type,
        title,
        message,
        action_url,
        meta
    FROM artist_followers
    WHERE artist_address = artist
      AND notifications_enabled = TRUE;

    GET DIAGNOSTICS notification_count = ROW_COUNT;
    RETURN notification_count;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh social materialized views
CREATE OR REPLACE FUNCTION refresh_social_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_popular_playlists;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_artist_social_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_song_engagement;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update playlist updated_at on song add/remove
CREATE OR REPLACE FUNCTION update_playlist_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE playlists
    SET updated_at = NOW()
    WHERE playlist_id = NEW.playlist_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER playlist_songs_update_timestamp
AFTER INSERT OR DELETE ON playlist_songs
FOR EACH ROW
EXECUTE FUNCTION update_playlist_timestamp();

-- Create activity on new comment
CREATE OR REPLACE FUNCTION create_comment_activity()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_activity(
        NEW.commenter_address,
        'comment',
        'song',
        NEW.song_id,
        jsonb_build_object('comment_id', NEW.id, 'content', LEFT(NEW.content, 100))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER song_comment_activity
AFTER INSERT ON song_comments
FOR EACH ROW
EXECUTE FUNCTION create_comment_activity();

-- Create activity on new follow
CREATE OR REPLACE FUNCTION create_follow_activity()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_activity(
        NEW.follower_address,
        'follow',
        'artist',
        NEW.artist_address,
        '{}'::JSONB
    );

    -- Notify the artist
    INSERT INTO notifications (
        recipient_address,
        notification_type,
        title,
        message
    ) VALUES (
        NEW.artist_address,
        'new_follower',
        'New Follower',
        'You have a new follower!'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER artist_follow_activity
AFTER INSERT ON artist_followers
FOR EACH ROW
EXECUTE FUNCTION create_follow_activity();

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Uncomment to add sample data for testing

/*
-- Sample user profiles
INSERT INTO user_profiles (wallet_address, display_name, bio) VALUES
('0x1234...', 'DJ SampleMaster', 'Electronic music producer from Berlin'),
('0x5678...', 'Rock Legend', 'Classic rock enthusiast');

-- Sample follows
INSERT INTO artist_followers (follower_address, artist_address) VALUES
('0x1111...', '0x2222...'),
('0x1111...', '0x3333...');

-- Sample playlist
INSERT INTO playlists (playlist_id, owner_address, name, description, is_public) VALUES
('playlist-001', '0x1111...', 'My Favorite Tracks', 'Best songs ever', TRUE);
*/

-- ============================================================================
-- INDEXES SUMMARY
-- ============================================================================

-- Total indexes created: 25+
-- Covering: followers, comments, playlists, profiles, activity, notifications
-- Performance optimized for social queries

COMMENT ON TABLE artist_followers IS 'Artist following relationships';
COMMENT ON TABLE song_comments IS 'Comments on songs with reply support';
COMMENT ON TABLE playlists IS 'User-created playlists';
COMMENT ON TABLE user_profiles IS 'Extended user profile information';
COMMENT ON TABLE activity_feed IS 'Global activity feed for all user actions';
COMMENT ON TABLE notifications IS 'User notifications for social events';
