-- Migration 004: Search and Discovery Features
-- Full-text search, recommendations, discovery feeds

-- ============================================================================
-- FULL-TEXT SEARCH CONFIGURATION
-- ============================================================================

-- Create custom search configuration for music
CREATE TEXT SEARCH CONFIGURATION music_search (COPY = english);

-- Create search indexes for songs
CREATE INDEX IF NOT EXISTS idx_songs_fts ON songs
USING gin(to_tsvector('music_search',
    coalesce(title, '') || ' ' ||
    coalesce(genre, '') || ' ' ||
    coalesce(description, '')
));

-- Create search indexes for artists
CREATE INDEX IF NOT EXISTS idx_artists_fts ON artists
USING gin(to_tsvector('music_search',
    coalesce(name, '') || ' ' ||
    coalesce(bio, '')
));

-- Create search indexes for playlists
CREATE INDEX IF NOT EXISTS idx_playlists_fts ON playlists
USING gin(to_tsvector('music_search',
    coalesce(name, '') || ' ' ||
    coalesce(description, '')
));

-- Create search indexes for user profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_fts ON user_profiles
USING gin(to_tsvector('music_search',
    coalesce(display_name, '') || ' ' ||
    coalesce(bio, '')
));

-- ============================================================================
-- SEARCH HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS search_history (
    id BIGSERIAL PRIMARY KEY,
    user_address VARCHAR(42) NOT NULL,
    search_query TEXT NOT NULL,
    search_type VARCHAR(50) NOT NULL,  -- 'song', 'artist', 'playlist', 'all'
    result_count INTEGER DEFAULT 0,
    clicked_result_id VARCHAR(255),
    clicked_result_type VARCHAR(50),
    searched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_search_history_user ON search_history(user_address, searched_at DESC);
CREATE INDEX idx_search_history_query ON search_history(search_query);

-- ============================================================================
-- LISTENING HISTORY (for recommendations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS listening_history (
    id BIGSERIAL PRIMARY KEY,
    listener_address VARCHAR(42) NOT NULL,
    song_id VARCHAR(255) NOT NULL,
    artist_address VARCHAR(42) NOT NULL,
    genre VARCHAR(100),
    strategy VARCHAR(50),
    play_duration INTEGER,  -- seconds
    completed BOOLEAN DEFAULT FALSE,  -- played >80%
    skipped BOOLEAN DEFAULT FALSE,
    liked BOOLEAN DEFAULT FALSE,
    played_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listening_history_listener ON listening_history(listener_address, played_at DESC);
CREATE INDEX idx_listening_history_song ON listening_history(song_id);
CREATE INDEX idx_listening_history_genre ON listening_history(genre);
CREATE INDEX idx_listening_history_completed ON listening_history(listener_address, completed) WHERE completed = TRUE;

-- ============================================================================
-- USER PREFERENCES (explicit preferences)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_address VARCHAR(42) UNIQUE NOT NULL,
    favorite_genres JSONB DEFAULT '[]'::JSONB,
    favorite_strategies JSONB DEFAULT '[]'::JSONB,
    blocked_artists JSONB DEFAULT '[]'::JSONB,
    language_preference VARCHAR(10) DEFAULT 'en',
    explicit_content BOOLEAN DEFAULT TRUE,
    discovery_mode VARCHAR(20) DEFAULT 'balanced',  -- conservative, balanced, adventurous
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_preferences_address ON user_preferences(user_address);

-- ============================================================================
-- SONG SIMILARITY (for recommendations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS song_similarities (
    id BIGSERIAL PRIMARY KEY,
    song_id_1 VARCHAR(255) NOT NULL,
    song_id_2 VARCHAR(255) NOT NULL,
    similarity_score DECIMAL(5,4) NOT NULL,  -- 0.0000 to 1.0000
    similarity_type VARCHAR(50) DEFAULT 'content',  -- content, collaborative, hybrid
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(song_id_1, song_id_2),
    CHECK (song_id_1 < song_id_2),  -- Ensure ordering
    CHECK (similarity_score >= 0 AND similarity_score <= 1)
);

CREATE INDEX idx_song_similarities_song1 ON song_similarities(song_id_1, similarity_score DESC);
CREATE INDEX idx_song_similarities_song2 ON song_similarities(song_id_2, similarity_score DESC);

-- ============================================================================
-- MATERIALIZED VIEWS FOR DISCOVERY
-- ============================================================================

-- Trending songs (weighted by recency and engagement)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_trending_songs AS
SELECT
    s.song_id,
    s.title,
    s.artist_address,
    a.name as artist_name,
    s.genre,
    s.strategy,
    -- Trending score formula
    (
        -- Play count weight (50%)
        (COUNT(DISTINCT lh.id) * 0.5) +
        -- Comment weight (20%)
        (COUNT(DISTINCT sc.id) * 5 * 0.2) +
        -- Playlist adds weight (20%)
        (COUNT(DISTINCT ps.id) * 10 * 0.2) +
        -- Follower weight (10%)
        (COUNT(DISTINCT af.id) * 2 * 0.1)
    ) *
    -- Recency multiplier (decay over 30 days)
    POWER(0.95, EXTRACT(DAY FROM NOW() - s.created_at)) as trending_score,
    COUNT(DISTINCT lh.id) as play_count_7d,
    COUNT(DISTINCT sc.id) as comment_count_7d,
    COUNT(DISTINCT ps.id) as playlist_adds_7d,
    NOW() as last_refreshed
FROM songs s
LEFT JOIN artists a ON s.artist_address = a.artist_address
LEFT JOIN listening_history lh ON s.song_id = lh.song_id
    AND lh.played_at >= NOW() - INTERVAL '7 days'
LEFT JOIN song_comments sc ON s.song_id = sc.song_id
    AND sc.created_at >= NOW() - INTERVAL '7 days'
LEFT JOIN playlist_songs ps ON s.song_id = ps.song_id
    AND ps.added_at >= NOW() - INTERVAL '7 days'
LEFT JOIN artist_followers af ON s.artist_address = af.artist_address
    AND af.followed_at >= NOW() - INTERVAL '7 days'
WHERE s.created_at >= NOW() - INTERVAL '90 days'  -- Only songs from last 90 days
GROUP BY s.song_id, s.title, s.artist_address, a.name, s.genre, s.strategy, s.created_at
HAVING COUNT(DISTINCT lh.id) > 0;  -- Must have at least 1 play

CREATE INDEX idx_mv_trending_songs_score ON mv_trending_songs(trending_score DESC);
CREATE INDEX idx_mv_trending_songs_genre ON mv_trending_songs(genre, trending_score DESC);

-- Genre-based recommendations
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_genre_trends AS
SELECT
    genre,
    COUNT(DISTINCT song_id) as song_count,
    COUNT(DISTINCT artist_address) as artist_count,
    SUM(play_count_7d) as total_plays_7d,
    AVG(trending_score) as avg_trending_score,
    ARRAY_AGG(song_id ORDER BY trending_score DESC LIMIT 10) as top_songs,
    NOW() as last_refreshed
FROM mv_trending_songs
WHERE genre IS NOT NULL
GROUP BY genre;

CREATE INDEX idx_mv_genre_trends_genre ON mv_genre_trends(genre);
CREATE INDEX idx_mv_genre_trends_plays ON mv_genre_trends(total_plays_7d DESC);

-- Rising artists (new artists gaining traction)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_rising_artists AS
SELECT
    a.artist_address,
    a.name as artist_name,
    COUNT(DISTINCT af.follower_address) as follower_count,
    COUNT(DISTINCT s.song_id) as song_count,
    COUNT(DISTINCT lh.id) as play_count_7d,
    -- Growth score (follower velocity)
    COUNT(DISTINCT CASE
        WHEN af.followed_at >= NOW() - INTERVAL '7 days'
        THEN af.follower_address
    END) as new_followers_7d,
    -- Rising score
    (
        COUNT(DISTINCT CASE WHEN af.followed_at >= NOW() - INTERVAL '7 days'
            THEN af.follower_address END) * 10 +
        COUNT(DISTINCT lh.id) * 1
    ) as rising_score,
    a.created_at as artist_since,
    NOW() as last_refreshed
FROM artists a
LEFT JOIN artist_followers af ON a.artist_address = af.artist_address
LEFT JOIN songs s ON a.artist_address = s.artist_address
LEFT JOIN listening_history lh ON s.song_id = lh.song_id
    AND lh.played_at >= NOW() - INTERVAL '7 days'
WHERE a.created_at >= NOW() - INTERVAL '180 days'  -- Artists from last 6 months
GROUP BY a.artist_address, a.name, a.created_at
HAVING COUNT(DISTINCT s.song_id) >= 1  -- Has at least 1 song
ORDER BY rising_score DESC;

CREATE INDEX idx_mv_rising_artists_score ON mv_rising_artists(rising_score DESC);

-- ============================================================================
-- HELPER FUNCTIONS FOR SEARCH
-- ============================================================================

-- Comprehensive search function
CREATE OR REPLACE FUNCTION search_all(
    search_query TEXT,
    user_addr VARCHAR(42) DEFAULT NULL,
    limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
    result_type VARCHAR(50),
    result_id VARCHAR(255),
    title TEXT,
    subtitle TEXT,
    image_url TEXT,
    relevance REAL
) AS $$
BEGIN
    RETURN QUERY
    -- Search songs
    SELECT
        'song'::VARCHAR(50) as result_type,
        s.song_id as result_id,
        s.title as title,
        a.name as subtitle,
        s.cover_art_url as image_url,
        ts_rank(
            to_tsvector('music_search', coalesce(s.title, '') || ' ' || coalesce(s.genre, '')),
            plainto_tsquery('music_search', search_query)
        ) as relevance
    FROM songs s
    LEFT JOIN artists a ON s.artist_address = a.artist_address
    WHERE to_tsvector('music_search', coalesce(s.title, '') || ' ' || coalesce(s.genre, ''))
        @@ plainto_tsquery('music_search', search_query)

    UNION ALL

    -- Search artists
    SELECT
        'artist'::VARCHAR(50),
        a.artist_address,
        a.name,
        COALESCE(a.bio, 'Artist'),
        up.avatar_url,
        ts_rank(
            to_tsvector('music_search', coalesce(a.name, '') || ' ' || coalesce(a.bio, '')),
            plainto_tsquery('music_search', search_query)
        )
    FROM artists a
    LEFT JOIN user_profiles up ON a.artist_address = up.wallet_address
    WHERE to_tsvector('music_search', coalesce(a.name, '') || ' ' || coalesce(a.bio, ''))
        @@ plainto_tsquery('music_search', search_query)

    UNION ALL

    -- Search playlists
    SELECT
        'playlist'::VARCHAR(50),
        p.playlist_id,
        p.name,
        COALESCE(p.description, 'Playlist'),
        p.cover_image_url,
        ts_rank(
            to_tsvector('music_search', coalesce(p.name, '') || ' ' || coalesce(p.description, '')),
            plainto_tsquery('music_search', search_query)
        )
    FROM playlists p
    WHERE p.is_public = TRUE
        AND to_tsvector('music_search', coalesce(p.name, '') || ' ' || coalesce(p.description, ''))
        @@ plainto_tsquery('music_search', search_query)

    ORDER BY relevance DESC
    LIMIT limit_count;

    -- Log search if user provided
    IF user_addr IS NOT NULL THEN
        INSERT INTO search_history (user_address, search_query, search_type, result_count)
        SELECT user_addr, search_query, 'all', COUNT(*)
        FROM (
            SELECT 1 FROM songs s
            WHERE to_tsvector('music_search', coalesce(s.title, '')) @@ plainto_tsquery('music_search', search_query)
        ) sub;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Get personalized recommendations for a user
CREATE OR REPLACE FUNCTION get_personalized_recommendations(
    user_addr VARCHAR(42),
    limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
    song_id VARCHAR(255),
    title TEXT,
    artist_name TEXT,
    genre VARCHAR(100),
    recommendation_score DECIMAL(10,4),
    reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH user_top_genres AS (
        -- Get user's most listened genres
        SELECT lh.genre, COUNT(*) as listen_count
        FROM listening_history lh
        WHERE lh.listener_address = user_addr
            AND lh.played_at >= NOW() - INTERVAL '30 days'
            AND lh.genre IS NOT NULL
        GROUP BY lh.genre
        ORDER BY listen_count DESC
        LIMIT 5
    ),
    user_followed_artists AS (
        -- Get artists user follows
        SELECT af.artist_address
        FROM artist_followers af
        WHERE af.follower_address = user_addr
    ),
    user_recent_songs AS (
        -- Songs user listened to recently
        SELECT DISTINCT lh.song_id
        FROM listening_history lh
        WHERE lh.listener_address = user_addr
            AND lh.played_at >= NOW() - INTERVAL '7 days'
    )
    SELECT
        s.song_id,
        s.title,
        a.name as artist_name,
        s.genre,
        (
            -- Genre match score (40%)
            CASE WHEN s.genre IN (SELECT genre FROM user_top_genres) THEN 40 ELSE 0 END +
            -- Followed artist score (30%)
            CASE WHEN s.artist_address IN (SELECT artist_address FROM user_followed_artists) THEN 30 ELSE 0 END +
            -- Trending score (20%)
            COALESCE((SELECT trending_score FROM mv_trending_songs WHERE song_id = s.song_id), 0) * 0.2 +
            -- Popularity score (10%)
            (SELECT COUNT(*) FROM listening_history WHERE song_id = s.song_id) * 0.001
        ) as recommendation_score,
        CASE
            WHEN s.artist_address IN (SELECT artist_address FROM user_followed_artists)
                THEN 'From an artist you follow'
            WHEN s.genre IN (SELECT genre FROM user_top_genres)
                THEN 'Based on your listening history'
            ELSE 'Popular in your preferred genres'
        END as reason
    FROM songs s
    LEFT JOIN artists a ON s.artist_address = a.artist_address
    WHERE s.song_id NOT IN (SELECT song_id FROM user_recent_songs)  -- Exclude recently played
        AND s.created_at >= NOW() - INTERVAL '365 days'  -- Songs from last year
    ORDER BY recommendation_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Get similar songs
CREATE OR REPLACE FUNCTION get_similar_songs(
    input_song_id VARCHAR(255),
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    song_id VARCHAR(255),
    title TEXT,
    artist_name TEXT,
    similarity_score DECIMAL(5,4)
) AS $$
BEGIN
    RETURN QUERY
    -- Use pre-computed similarities if available
    SELECT
        CASE
            WHEN ss.song_id_1 = input_song_id THEN ss.song_id_2
            ELSE ss.song_id_1
        END as song_id,
        s.title,
        a.name as artist_name,
        ss.similarity_score
    FROM song_similarities ss
    JOIN songs s ON (
        CASE
            WHEN ss.song_id_1 = input_song_id THEN ss.song_id_2
            ELSE ss.song_id_1
        END = s.song_id
    )
    LEFT JOIN artists a ON s.artist_address = a.artist_address
    WHERE ss.song_id_1 = input_song_id OR ss.song_id_2 = input_song_id
    ORDER BY ss.similarity_score DESC
    LIMIT limit_count;

    -- If no pre-computed similarities, fall back to genre-based
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            s2.song_id,
            s2.title,
            a.name,
            0.5::DECIMAL(5,4) as similarity_score
        FROM songs s1
        JOIN songs s2 ON s1.genre = s2.genre AND s1.song_id != s2.song_id
        LEFT JOIN artists a ON s2.artist_address = a.artist_address
        WHERE s1.song_id = input_song_id
        ORDER BY RANDOM()
        LIMIT limit_count;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh discovery views
CREATE OR REPLACE FUNCTION refresh_discovery_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trending_songs;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_genre_trends;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rising_artists;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEARCH SUGGESTIONS / AUTOCOMPLETE
-- ============================================================================

CREATE TABLE IF NOT EXISTS search_suggestions (
    id BIGSERIAL PRIMARY KEY,
    suggestion TEXT UNIQUE NOT NULL,
    suggestion_type VARCHAR(50) NOT NULL,  -- 'artist', 'genre', 'tag'
    popularity_score INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_search_suggestions_text ON search_suggestions(suggestion);
CREATE INDEX idx_search_suggestions_type ON search_suggestions(suggestion_type, popularity_score DESC);

-- Populate initial suggestions from existing data
INSERT INTO search_suggestions (suggestion, suggestion_type, popularity_score)
SELECT DISTINCT name, 'artist', COUNT(*) OVER (PARTITION BY name)
FROM artists
ON CONFLICT (suggestion) DO NOTHING;

INSERT INTO search_suggestions (suggestion, suggestion_type, popularity_score)
SELECT DISTINCT genre, 'genre', COUNT(*) OVER (PARTITION BY genre)
FROM songs
WHERE genre IS NOT NULL
ON CONFLICT (suggestion) DO NOTHING;

-- ============================================================================
-- INDEXES SUMMARY
-- ============================================================================

-- Full-text search indexes: 4
-- Listening history indexes: 4
-- Search history indexes: 2
-- Similarity indexes: 2
-- Materialized view indexes: 6
-- Total new indexes: 18+

COMMENT ON TABLE search_history IS 'User search history for analytics and suggestions';
COMMENT ON TABLE listening_history IS 'Detailed listening history for recommendations';
COMMENT ON TABLE user_preferences IS 'Explicit user preferences for personalization';
COMMENT ON TABLE song_similarities IS 'Pre-computed song similarity scores';
COMMENT ON TABLE search_suggestions IS 'Autocomplete suggestions for search';
