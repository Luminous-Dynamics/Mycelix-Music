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

// Rate limiting to prevent abuse
const requestCounts = new Map<string, { count: number; resetTime: number }>();

const rateLimit = (maxRequests: number, windowMs: number) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const identifier = req.ip || 'unknown';
    const now = Date.now();

    const record = requestCounts.get(identifier);

    if (!record || now > record.resetTime) {
      requestCounts.set(identifier, { count: 1, resetTime: now + windowMs });
      next();
    } else if (record.count < maxRequests) {
      record.count++;
      next();
    } else {
      res.status(429).json({
        error: 'Too many requests, please try again later',
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
    }
  };
};

// Clean up old rate limit records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Apply rate limiting to all routes (100 requests per minute)
app.use(rateLimit(100, 60 * 1000));

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

    // Create indexes for better query performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_artist_address ON songs(artist_address)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_genre ON songs(genre)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_payment_model ON songs(payment_model)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_songs_created_at ON songs(created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_plays_song_id ON plays(song_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_plays_listener_address ON plays(listener_address)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_plays_timestamp ON plays(timestamp DESC)
    `);

    console.log('✓ Database tables initialized');
    console.log('✓ Database indexes created');
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
    // Try to get from cache first
    const cacheKey = 'songs:all';
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // If not in cache, fetch from database
    const result = await pool.query(
      'SELECT * FROM songs ORDER BY created_at DESC'
    );

    // Cache for 30 seconds
    await redis.setEx(cacheKey, 30, JSON.stringify(result.rows));

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

    // Input validation
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid song ID' });
    }

    // Try to get from cache first
    const cacheKey = `song:${id}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // If not in cache, fetch from database
    const result = await pool.query('SELECT * FROM songs WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Cache for 60 seconds
    await redis.setEx(cacheKey, 60, JSON.stringify(result.rows[0]));

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Failed to fetch song:', error);
    res.status(500).json({ error: 'Failed to fetch song' });
  }
});

// Register a new song
app.post('/api/songs', async (req, res) => {
  try {
    const { id, title, artist, artistAddress, genre, description, ipfsHash, paymentModel } = req.body;

    // Input validation
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid or missing song ID' });
    }
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid or missing title' });
    }
    if (!artist || typeof artist !== 'string' || artist.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid or missing artist name' });
    }
    if (!artistAddress || typeof artistAddress !== 'string' || !artistAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid or missing artist address' });
    }
    if (!genre || typeof genre !== 'string') {
      return res.status(400).json({ error: 'Invalid or missing genre' });
    }
    if (!ipfsHash || typeof ipfsHash !== 'string') {
      return res.status(400).json({ error: 'Invalid or missing IPFS hash' });
    }
    if (!paymentModel || typeof paymentModel !== 'string') {
      return res.status(400).json({ error: 'Invalid or missing payment model' });
    }

    const result = await pool.query(
      `INSERT INTO songs (id, title, artist, artist_address, genre, description, ipfs_hash, payment_model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, title, artist, artistAddress, genre, description || '', ipfsHash, paymentModel]
    );

    // Invalidate cache
    await redis.del('songs:all');

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Failed to register song:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Song with this ID already exists' });
    }
    res.status(500).json({ error: 'Failed to register song' });
  }
});

// Record a play
app.post('/api/songs/:id/play', async (req, res) => {
  try {
    const { id } = req.params;
    const { listenerAddress, amount, paymentType } = req.body;

    // Input validation
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid song ID' });
    }

    // Validate listener address if provided
    if (listenerAddress && !listenerAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid listener address' });
    }

    // Validate amount if provided
    const playAmount = parseFloat(amount) || 0;
    if (playAmount < 0) {
      return res.status(400).json({ error: 'Amount cannot be negative' });
    }

    // Validate payment type
    const validPaymentTypes = ['stream', 'download', 'tip', 'patronage', 'nft_access'];
    const type = paymentType || 'stream';
    if (!validPaymentTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid payment type' });
    }

    // Check if song exists
    const songCheck = await pool.query('SELECT id FROM songs WHERE id = $1', [id]);
    if (songCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Insert play record
    await pool.query(
      `INSERT INTO plays (song_id, listener_address, amount, payment_type)
       VALUES ($1, $2, $3, $4)`,
      [id, listenerAddress || 'anonymous', playAmount, type]
    );

    // Update song stats
    await pool.query(
      `UPDATE songs
       SET plays = plays + 1,
           earnings = earnings + $2
       WHERE id = $1`,
      [id, playAmount]
    );

    // Invalidate cache for this song
    await redis.del(`song:${id}`);
    await redis.del('songs:all');

    res.json({ success: true });
  } catch (error: any) {
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

    // Input validation
    if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid artist address' });
    }

    const songsResult = await pool.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(plays), 0) as total_plays, COALESCE(SUM(earnings), 0) as total_earnings FROM songs WHERE artist_address = $1',
      [address]
    );

    const stats = songsResult.rows[0];

    res.json({
      artistAddress: address,
      totalSongs: parseInt(stats.count) || 0,
      totalPlays: parseInt(stats.total_plays) || 0,
      totalEarnings: parseFloat(stats.total_earnings) || 0,
    });
  } catch (error: any) {
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
