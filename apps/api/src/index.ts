import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { createClient } from 'redis';
import * as dotenv from 'dotenv';

dotenv.config();

// ============================================================
// Environment Variable Validation
// ============================================================

interface EnvironmentConfig {
  API_PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  NODE_ENV: string;
}

function validateEnvironment(): EnvironmentConfig {
  const requiredVars = ['DATABASE_URL', 'REDIS_URL'];
  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please check your .env file or environment configuration.');
    process.exit(1);
  }

  const port = parseInt(process.env.API_PORT || '3100', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error('❌ Invalid API_PORT. Must be a number between 1 and 65535.');
    process.exit(1);
  }

  return {
    API_PORT: port,
    DATABASE_URL: process.env.DATABASE_URL!,
    REDIS_URL: process.env.REDIS_URL!,
    NODE_ENV: process.env.NODE_ENV || 'development',
  };
}

const config = validateEnvironment();

const app = express();
const PORT = config.API_PORT;

// Middleware
app.use(cors());

// Security headers
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy (adjust as needed for your frontend)
  if (config.NODE_ENV === 'production') {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
    );
  }

  next();
});

// Request size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// ============================================================
// Structured Logging
// ============================================================

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  meta?: any;
}

const logger = {
  info: (message: string, meta?: any) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      meta,
    };
    console.log(JSON.stringify(entry));
  },
  warn: (message: string, meta?: any) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message,
      meta,
    };
    console.warn(JSON.stringify(entry));
  },
  error: (message: string, error?: any) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      meta: config.NODE_ENV === 'development' && error ? {
        message: error.message,
        stack: error.stack,
        ...error,
      } : { message: error?.message },
    };
    console.error(JSON.stringify(entry));
  },
  debug: (message: string, meta?: any) => {
    if (config.NODE_ENV === 'development') {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'DEBUG',
        message,
        meta,
      };
      console.debug(JSON.stringify(entry));
    }
  },
};

// Database connection
const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

pool.on('connect', () => {
  logger.info('PostgreSQL client connected');
});

pool.on('error', (err) => {
  logger.error('PostgreSQL client error', err);
});

// Redis connection
const redis = createClient({
  url: config.REDIS_URL,
});

redis.on('error', (err) => logger.error('Redis client error', err));
redis.on('connect', () => logger.info('Redis client connected'));
redis.on('ready', () => logger.info('Redis client ready'));

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

    logger.info('Database tables initialized');
    logger.info('Database indexes created');
  } finally {
    client.release();
  }
}

// ============================================================
// API Routes
// ============================================================

// Enhanced health check with dependency status
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV,
    dependencies: {
      database: 'unknown',
      redis: 'unknown',
    },
  };

  // Check database connection
  try {
    await pool.query('SELECT 1');
    health.dependencies.database = 'connected';
  } catch (error) {
    health.dependencies.database = 'disconnected';
    health.status = 'degraded';
  }

  // Check Redis connection
  try {
    await redis.ping();
    health.dependencies.redis = 'connected';
  } catch (error) {
    health.dependencies.redis = 'disconnected';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
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

let server: any;

async function startServer() {
  try {
    // Connect to Redis
    await redis.connect();
    logger.info('Connected to Redis');

    // Initialize database
    await initDatabase();

    // Start Express server
    server = app.listen(PORT, () => {
      logger.info(`API server running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// ============================================================
// Graceful Shutdown
// ============================================================

async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, starting graceful shutdown`);

  // Stop accepting new connections
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  try {
    // Close database connections
    await pool.end();
    logger.info('Database connections closed');

    // Close Redis connection
    await redis.quit();
    logger.info('Redis connection closed');

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  gracefulShutdown('unhandledRejection');
});

startServer();
