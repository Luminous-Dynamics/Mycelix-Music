/**
 * API Integration Tests: Songs Endpoints
 * Tests all song-related API endpoints with real database interactions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Pool } from 'pg';
import Redis from 'ioredis';
import app from '../../src/index';

describe('API Integration Tests - Songs', () => {
  let pool: Pool;
  let redis: Redis;
  let testSongId: string;

  const testArtistAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const testSongData = {
    song_id: '0x' + '1'.repeat(64),
    title: 'Test Song',
    artist_address: testArtistAddress,
    artist_name: 'Test Artist',
    album: 'Test Album',
    genre: 'Electronic',
    duration: 180,
    ipfs_hash: 'QmTestHash123',
    cover_art_url: 'https://example.com/cover.jpg',
    payment_model: 'pay-per-stream',
    price_per_stream: '0.01',
  };

  beforeAll(async () => {
    // Setup test database connection
    pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    });

    // Setup test Redis connection
    redis = new Redis(process.env.TEST_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379');

    // Create test tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS songs (
        song_id VARCHAR(66) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        artist_address VARCHAR(42) NOT NULL,
        artist_name VARCHAR(255) NOT NULL,
        album VARCHAR(255),
        genre VARCHAR(100) NOT NULL,
        duration INTEGER NOT NULL,
        ipfs_hash VARCHAR(100) NOT NULL,
        cover_art_url TEXT,
        payment_model VARCHAR(50) NOT NULL,
        price_per_stream DECIMAL(18, 8) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS plays (
        id SERIAL PRIMARY KEY,
        song_id VARCHAR(66) NOT NULL,
        listener_address VARCHAR(42) NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW(),
        amount_paid DECIMAL(18, 8) NOT NULL,
        payment_type VARCHAR(50) NOT NULL
      )
    `);
  });

  afterAll(async () => {
    // Clean up test database
    await pool.query('DROP TABLE IF EXISTS songs CASCADE');
    await pool.query('DROP TABLE IF EXISTS plays CASCADE');
    await pool.end();
    await redis.quit();
  });

  beforeEach(async () => {
    // Clear test data before each test
    await pool.query('DELETE FROM songs');
    await pool.query('DELETE FROM plays');
    await redis.flushdb();
  });

  describe('POST /api/songs', () => {
    it('should create a new song', async () => {
      const response = await request(app)
        .post('/api/songs')
        .send(testSongData)
        .expect(201);

      expect(response.body).toHaveProperty('song_id', testSongData.song_id);
      expect(response.body).toHaveProperty('title', testSongData.title);
      expect(response.body).toHaveProperty('artist_address', testSongData.artist_address);

      // Verify in database
      const result = await pool.query('SELECT * FROM songs WHERE song_id = $1', [testSongData.song_id]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].title).toBe(testSongData.title);
    });

    it('should reject song with missing required fields', async () => {
      const invalidSong = { ...testSongData };
      delete (invalidSong as any).title;

      const response = await request(app)
        .post('/api/songs')
        .send(invalidSong)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('title');
    });

    it('should reject song with invalid artist address', async () => {
      const invalidSong = {
        ...testSongData,
        artist_address: 'not-a-valid-address',
      };

      const response = await request(app)
        .post('/api/songs')
        .send(invalidSong)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('address');
    });

    it('should reject duplicate song_id', async () => {
      // Create first song
      await request(app).post('/api/songs').send(testSongData).expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/songs')
        .send(testSongData)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already exists');
    });

    it('should handle special characters in title', async () => {
      const specialSong = {
        ...testSongData,
        song_id: '0x' + '2'.repeat(64),
        title: 'Song with "quotes" & <special> characters',
      };

      const response = await request(app)
        .post('/api/songs')
        .send(specialSong)
        .expect(201);

      expect(response.body.title).toBe(specialSong.title);
    });

    it('should invalidate cache after creating song', async () => {
      // Warm cache
      await request(app).get('/api/songs').expect(200);

      // Create new song
      await request(app).post('/api/songs').send(testSongData).expect(201);

      // Cache should be cleared
      const cacheKey = 'songs:all';
      const cached = await redis.get(cacheKey);
      expect(cached).toBeNull();
    });
  });

  describe('GET /api/songs', () => {
    beforeEach(async () => {
      // Insert test songs
      const songs = [
        { ...testSongData, song_id: '0x' + '1'.repeat(64), title: 'Song 1', genre: 'Electronic' },
        { ...testSongData, song_id: '0x' + '2'.repeat(64), title: 'Song 2', genre: 'Hip Hop' },
        { ...testSongData, song_id: '0x' + '3'.repeat(64), title: 'Song 3', genre: 'Electronic' },
      ];

      for (const song of songs) {
        await request(app).post('/api/songs').send(song);
      }
    });

    it('should get all songs', async () => {
      const response = await request(app).get('/api/songs').expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body).toHaveLength(3);
    });

    it('should cache songs list', async () => {
      // First request
      await request(app).get('/api/songs').expect(200);

      // Check cache
      const cacheKey = 'songs:all';
      const cached = await redis.get(cacheKey);
      expect(cached).not.toBeNull();

      const cachedData = JSON.parse(cached!);
      expect(cachedData).toHaveLength(3);
    });

    it('should filter songs by genre', async () => {
      const response = await request(app)
        .get('/api/songs?genre=Electronic')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.every((s: any) => s.genre === 'Electronic')).toBe(true);
    });

    it('should filter songs by artist', async () => {
      const response = await request(app)
        .get(`/api/songs?artist=${testArtistAddress}`)
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body.every((s: any) => s.artist_address === testArtistAddress)).toBe(true);
    });

    it('should filter songs by payment model', async () => {
      const response = await request(app)
        .get('/api/songs?model=pay-per-stream')
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body.every((s: any) => s.payment_model === 'pay-per-stream')).toBe(true);
    });

    it('should return songs ordered by creation date (newest first)', async () => {
      const response = await request(app).get('/api/songs').expect(200);

      const dates = response.body.map((s: any) => new Date(s.created_at).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
      }
    });
  });

  describe('GET /api/songs/:id', () => {
    beforeEach(async () => {
      await request(app).post('/api/songs').send(testSongData).expect(201);
    });

    it('should get song by ID', async () => {
      const response = await request(app)
        .get(`/api/songs/${testSongData.song_id}`)
        .expect(200);

      expect(response.body).toHaveProperty('song_id', testSongData.song_id);
      expect(response.body).toHaveProperty('title', testSongData.title);
    });

    it('should return 404 for non-existent song', async () => {
      const nonExistentId = '0x' + '9'.repeat(64);

      const response = await request(app)
        .get(`/api/songs/${nonExistentId}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should cache individual song', async () => {
      // First request
      await request(app)
        .get(`/api/songs/${testSongData.song_id}`)
        .expect(200);

      // Check cache
      const cacheKey = `songs:${testSongData.song_id}`;
      const cached = await redis.get(cacheKey);
      expect(cached).not.toBeNull();

      const cachedData = JSON.parse(cached!);
      expect(cachedData.song_id).toBe(testSongData.song_id);
    });

    it('should reject invalid song ID format', async () => {
      const response = await request(app)
        .get('/api/songs/invalid-id')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/plays', () => {
    beforeEach(async () => {
      await request(app).post('/api/songs').send(testSongData).expect(201);
    });

    it('should record a play event', async () => {
      const playData = {
        song_id: testSongData.song_id,
        listener_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        amount_paid: '0.01',
        payment_type: 'stream',
      };

      const response = await request(app)
        .post('/api/plays')
        .send(playData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);

      // Verify in database
      const result = await pool.query(
        'SELECT * FROM plays WHERE song_id = $1 AND listener_address = $2',
        [playData.song_id, playData.listener_address]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].payment_type).toBe('stream');
    });

    it('should reject play with missing fields', async () => {
      const invalidPlay = {
        song_id: testSongData.song_id,
        // missing listener_address
        amount_paid: '0.01',
      };

      const response = await request(app)
        .post('/api/plays')
        .send(invalidPlay)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject play for non-existent song', async () => {
      const playData = {
        song_id: '0x' + '9'.repeat(64),
        listener_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        amount_paid: '0.01',
        payment_type: 'stream',
      };

      const response = await request(app)
        .post('/api/plays')
        .send(playData)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should record multiple plays from same listener', async () => {
      const playData = {
        song_id: testSongData.song_id,
        listener_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        amount_paid: '0.01',
        payment_type: 'stream',
      };

      // Record 3 plays
      for (let i = 0; i < 3; i++) {
        await request(app).post('/api/plays').send(playData).expect(201);
      }

      // Verify 3 plays were recorded
      const result = await pool.query(
        'SELECT * FROM plays WHERE song_id = $1 AND listener_address = $2',
        [playData.song_id, playData.listener_address]
      );

      expect(result.rows).toHaveLength(3);
    });

    it('should invalidate song cache after play', async () => {
      const playData = {
        song_id: testSongData.song_id,
        listener_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        amount_paid: '0.01',
        payment_type: 'stream',
      };

      // Warm cache
      await request(app).get(`/api/songs/${testSongData.song_id}`).expect(200);

      // Record play
      await request(app).post('/api/plays').send(playData).expect(201);

      // Cache should be invalidated
      const cacheKey = `songs:${testSongData.song_id}`;
      const cached = await redis.get(cacheKey);
      expect(cached).toBeNull();
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit requests from same IP', async () => {
      // Make 101 requests (limit is 100/min)
      const requests = [];
      for (let i = 0; i < 101; i++) {
        requests.push(request(app).get('/api/songs'));
      }

      const responses = await Promise.all(requests);

      // Last request should be rate limited
      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body).toHaveProperty('error');
      expect(lastResponse.body.error).toContain('rate limit');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Close pool temporarily
      await pool.end();

      const response = await request(app).get('/api/songs');

      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(response.body).toHaveProperty('error');

      // Reconnect pool for other tests
      pool = new Pool({
        connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
      });
    });

    it('should handle Redis connection errors gracefully', async () => {
      // Quit Redis temporarily
      await redis.quit();

      // Request should still work (just without caching)
      const response = await request(app).get('/api/songs').expect(200);

      // Reconnect Redis
      redis = new Redis(process.env.TEST_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379');
    });
  });

  describe('Data Validation', () => {
    it('should sanitize SQL injection attempts', async () => {
      const maliciousSong = {
        ...testSongData,
        song_id: '0x' + '5'.repeat(64),
        title: "'; DROP TABLE songs; --",
      };

      const response = await request(app)
        .post('/api/songs')
        .send(maliciousSong)
        .expect(201);

      // Verify database is intact
      const result = await pool.query('SELECT COUNT(*) as count FROM songs');
      expect(Number(result.rows[0].count)).toBeGreaterThan(0);
    });

    it('should reject XSS attempts in input', async () => {
      const xssSong = {
        ...testSongData,
        song_id: '0x' + '6'.repeat(64),
        title: '<script>alert("XSS")</script>',
      };

      const response = await request(app)
        .post('/api/songs')
        .send(xssSong)
        .expect(201);

      // Response should escape script tags
      expect(response.body.title).not.toContain('<script>');
    });

    it('should validate Ethereum addresses', async () => {
      const invalidSong = {
        ...testSongData,
        song_id: '0x' + '7'.repeat(64),
        artist_address: '0xINVALID',
      };

      const response = await request(app)
        .post('/api/songs')
        .send(invalidSong)
        .expect(400);

      expect(response.body.error).toContain('address');
    });
  });
});
