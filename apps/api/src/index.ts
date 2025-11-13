import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { createClient } from 'redis';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3100;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Redis connection
const redis = createClient({
  url: process.env.REDIS_URL,
});

redis.on('error', (err) => console.log('Redis Client Error', err));

// Initialize database
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS songs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        artist_address TEXT NOT NULL,
        genre TEXT NOT NULL,
        description TEXT,
        ipfs_hash TEXT NOT NULL,
        payment_model TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        plays INTEGER DEFAULT 0,
        earnings NUMERIC DEFAULT 0
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS plays (
        id SERIAL PRIMARY KEY,
        song_id TEXT REFERENCES songs(id),
        listener_address TEXT NOT NULL,
        amount NUMERIC DEFAULT 0,
        payment_type TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('✓ Database tables initialized');
  } finally {
    client.release();
  }
}

// ============================================================
// API Routes
// ============================================================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all songs
app.get('/api/songs', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM songs ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch songs:', error);
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
});

// Get single song
app.get('/api/songs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM songs WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Song not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to fetch song:', error);
    res.status(500).json({ error: 'Failed to fetch song' });
  }
});

// Register a new song
app.post('/api/songs', async (req, res) => {
  try {
    const { id, title, artist, artistAddress, genre, description, ipfsHash, paymentModel } = req.body;

    const result = await pool.query(
      `INSERT INTO songs (id, title, artist, artist_address, genre, description, ipfs_hash, payment_model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, title, artist, artistAddress, genre, description, ipfsHash, paymentModel]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Failed to register song:', error);
    res.status(500).json({ error: 'Failed to register song' });
  }
});

// Record a play
app.post('/api/songs/:id/play', async (req, res) => {
  try {
    const { id } = req.params;
    const { listenerAddress, amount, paymentType } = req.body;

    // Insert play record
    await pool.query(
      `INSERT INTO plays (song_id, listener_address, amount, payment_type)
       VALUES ($1, $2, $3, $4)`,
      [id, listenerAddress || 'anonymous', amount || 0, paymentType || 'stream']
    );

    // Update song stats
    await pool.query(
      `UPDATE songs
       SET plays = plays + 1,
           earnings = earnings + $2
       WHERE id = $1`,
      [id, amount || 0]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to record play:', error);
    res.status(500).json({ error: 'Failed to record play' });
  }
});

// Get play history for a song
app.get('/api/songs/:id/plays', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM plays WHERE song_id = $1 ORDER BY timestamp DESC',
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch plays:', error);
    res.status(500).json({ error: 'Failed to fetch plays' });
  }
});

// Upload to IPFS (via Web3.Storage)
app.post('/api/upload-to-ipfs', async (req, res) => {
  try {
    // This would integrate with Web3.Storage
    // For now, return a mock response
    const mockHash = 'Qm' + Math.random().toString(36).substring(2, 15);

    res.json({
      ipfsHash: mockHash,
      gateway: `https://w3s.link/ipfs/${mockHash}`,
    });
  } catch (error) {
    console.error('Failed to upload to IPFS:', error);
    res.status(500).json({ error: 'Failed to upload to IPFS' });
  }
});

// Create DKG claim (via Ceramic)
app.post('/api/create-dkg-claim', async (req, res) => {
  try {
    const {
      songId,
      title,
      artist,
      ipfsHash,
      artistAddress,
      epistemicTier,
      networkTier,
      memoryTier,
    } = req.body;

    // This would create a claim on Ceramic Network
    // For now, return a mock response
    const mockStreamId = 'kjzl6cwe1jw14' + Math.random().toString(36).substring(2, 15);

    res.json({
      streamId: mockStreamId,
      songId,
      epistemicTier,
      networkTier,
      memoryTier,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to create DKG claim:', error);
    res.status(500).json({ error: 'Failed to create DKG claim' });
  }
});

// Get artist stats
app.get('/api/artists/:address/stats', async (req, res) => {
  try {
    const { address } = req.params;

    const songsResult = await pool.query(
      `SELECT
         COUNT(*) AS total_songs,
         COALESCE(SUM(plays), 0) AS total_plays,
         COALESCE(SUM(earnings), 0) AS total_earnings
       FROM songs
       WHERE artist_address = $1`,
      [address]
    );

    const stats = songsResult.rows[0] || {
      total_songs: 0,
      total_plays: 0,
      total_earnings: 0,
    };

    res.json({
      artistAddress: address,
      totalSongs: Number(stats.total_songs) || 0,
      totalPlays: Number(stats.total_plays) || 0,
      totalEarnings: Number(stats.total_earnings) || 0,
    });
  } catch (error) {
    console.error('Failed to fetch artist stats:', error);
    res.status(500).json({ error: 'Failed to fetch artist stats' });
  }
});

// ============================================================
// Start Server
// ============================================================

async function startServer() {
  try {
    // Connect to Redis
    await redis.connect();
    console.log('✓ Connected to Redis');

    // Initialize database
    await initDatabase();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`✓ API server running on port ${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
