-- ============================================================================
-- Migration: 001_initial_schema
-- Description: Initial database schema for Mycelix Music
-- Created: 2025-01-15
-- ============================================================================

BEGIN;

-- Songs table
CREATE TABLE IF NOT EXISTS songs (
    song_id VARCHAR(66) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist_address VARCHAR(42) NOT NULL,
    artist_name VARCHAR(255) NOT NULL,
    album VARCHAR(255),
    genre VARCHAR(100) NOT NULL,
    duration INTEGER NOT NULL CHECK (duration > 0),
    ipfs_hash VARCHAR(100) NOT NULL,
    cover_art_url TEXT,
    payment_model VARCHAR(50) NOT NULL CHECK (payment_model IN ('pay-per-stream', 'gift-economy')),
    price_per_stream DECIMAL(18, 8) NOT NULL CHECK (price_per_stream >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Plays table
CREATE TABLE IF NOT EXISTS plays (
    id SERIAL PRIMARY KEY,
    song_id VARCHAR(66) NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,
    listener_address VARCHAR(42) NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    amount_paid DECIMAL(18, 8) NOT NULL CHECK (amount_paid >= 0),
    payment_type VARCHAR(50) NOT NULL CHECK (payment_type IN ('stream', 'tip'))
);

-- Artist stats table (materialized view for performance)
CREATE TABLE IF NOT EXISTS artist_stats (
    artist_address VARCHAR(42) PRIMARY KEY,
    total_plays BIGINT NOT NULL DEFAULT 0,
    total_earnings DECIMAL(18, 8) NOT NULL DEFAULT 0,
    unique_listeners BIGINT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Listener profiles table
CREATE TABLE IF NOT EXISTS listener_profiles (
    listener_address VARCHAR(42) PRIMARY KEY,
    total_plays BIGINT NOT NULL DEFAULT 0,
    total_spent DECIMAL(18, 8) NOT NULL DEFAULT 0,
    cgc_earned DECIMAL(18, 8) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_active TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Revenue splits table
CREATE TABLE IF NOT EXISTS revenue_splits (
    id SERIAL PRIMARY KEY,
    song_id VARCHAR(66) NOT NULL REFERENCES songs(song_id) ON DELETE CASCADE,
    recipient_address VARCHAR(42) NOT NULL,
    basis_points INTEGER NOT NULL CHECK (basis_points >= 0 AND basis_points <= 10000),
    role VARCHAR(50) NOT NULL,
    UNIQUE(song_id, recipient_address, role)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_songs_artist_address ON songs(artist_address);
CREATE INDEX IF NOT EXISTS idx_songs_genre ON songs(genre);
CREATE INDEX IF NOT EXISTS idx_songs_payment_model ON songs(payment_model);
CREATE INDEX IF NOT EXISTS idx_songs_created_at ON songs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plays_song_id ON plays(song_id);
CREATE INDEX IF NOT EXISTS idx_plays_listener_address ON plays(listener_address);
CREATE INDEX IF NOT EXISTS idx_plays_timestamp ON plays(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_revenue_splits_song_id ON revenue_splits(song_id);

-- Functions for automatic stat updates
CREATE OR REPLACE FUNCTION update_artist_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO artist_stats (artist_address, total_plays, total_earnings, unique_listeners, last_updated)
    SELECT
        s.artist_address,
        COUNT(p.id),
        COALESCE(SUM(p.amount_paid), 0),
        COUNT(DISTINCT p.listener_address),
        NOW()
    FROM songs s
    LEFT JOIN plays p ON s.song_id = p.song_id
    WHERE s.artist_address = (SELECT artist_address FROM songs WHERE song_id = NEW.song_id)
    GROUP BY s.artist_address
    ON CONFLICT (artist_address)
    DO UPDATE SET
        total_plays = EXCLUDED.total_plays,
        total_earnings = EXCLUDED.total_earnings,
        unique_listeners = EXCLUDED.unique_listeners,
        last_updated = EXCLUDED.last_updated;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_listener_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO listener_profiles (listener_address, total_plays, total_spent, last_active)
    VALUES (
        NEW.listener_address,
        1,
        NEW.amount_paid,
        NOW()
    )
    ON CONFLICT (listener_address)
    DO UPDATE SET
        total_plays = listener_profiles.total_plays + 1,
        total_spent = listener_profiles.total_spent + NEW.amount_paid,
        last_active = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS trg_update_artist_stats ON plays;
CREATE TRIGGER trg_update_artist_stats
    AFTER INSERT ON plays
    FOR EACH ROW
    EXECUTE FUNCTION update_artist_stats();

DROP TRIGGER IF NOT EXISTS trg_update_listener_profile ON plays;
CREATE TRIGGER trg_update_listener_profile
    AFTER INSERT ON plays
    FOR EACH ROW
    EXECUTE FUNCTION update_listener_profile();

-- Insert schema version
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version, description)
VALUES (1, 'Initial schema with songs, plays, stats, and indexes')
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- ============================================================================
-- Verification queries
-- ============================================================================
-- Run these manually to verify migration success:
--
-- SELECT * FROM schema_migrations;
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public';
-- ============================================================================
