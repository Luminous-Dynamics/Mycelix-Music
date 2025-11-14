# Mycelix Music API Documentation

## Base URL
```
Development: http://localhost:3100
Production: https://api.music.mycelix.net
```

## Authentication
Currently, the API does not require authentication for public endpoints. Artist-specific operations should be authenticated via wallet signatures (implementation pending).

## Rate Limiting
- **Limit**: 100 requests per minute per IP address
- **Response on limit**: HTTP 429 with `retryAfter` header

## Content Type
All requests and responses use `application/json`.

## Error Handling

### Error Response Format
```json
{
  "error": "Error message describing what went wrong"
}
```

### HTTP Status Codes
- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request parameters
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Service dependencies unavailable

---

## Endpoints

### Health Check

#### GET /health
Check API and dependency health status.

**Response** `200 OK` or `503 Service Unavailable`
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "uptime": 3600.5,
  "environment": "production",
  "dependencies": {
    "database": "connected",
    "redis": "connected"
  }
}
```

**Status Values:**
- `ok` - All systems operational
- `degraded` - Some dependencies unavailable

---

### Songs

#### GET /api/songs
Get all songs, ordered by creation date (newest first).

**Response** `200 OK`
```json
[
  {
    "id": "song-uuid-123",
    "title": "Cosmic Voyage",
    "artist": "DJ Mycelix",
    "artist_address": "0x1234567890abcdef1234567890abcdef12345678",
    "genre": "Electronic",
    "description": "A journey through space and time",
    "ipfs_hash": "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
    "payment_model": "pay_per_stream",
    "created_at": "2025-01-15T10:00:00.000Z",
    "plays": 1250,
    "earnings": "12.50"
  }
]
```

**Caching**: Cached for 30 seconds

---

#### GET /api/songs/:id
Get a single song by ID.

**Parameters:**
- `id` (string, required) - Song identifier

**Response** `200 OK`
```json
{
  "id": "song-uuid-123",
  "title": "Cosmic Voyage",
  "artist": "DJ Mycelix",
  "artist_address": "0x1234567890abcdef1234567890abcdef12345678",
  "genre": "Electronic",
  "description": "A journey through space and time",
  "ipfs_hash": "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
  "payment_model": "pay_per_stream",
  "created_at": "2025-01-15T10:00:00.000Z",
  "plays": 1250,
  "earnings": "12.50"
}
```

**Errors:**
- `400` - Invalid song ID
- `404` - Song not found

**Caching**: Cached for 60 seconds

---

#### POST /api/songs
Register a new song.

**Request Body:**
```json
{
  "id": "song-uuid-123",
  "title": "Cosmic Voyage",
  "artist": "DJ Mycelix",
  "artistAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "genre": "Electronic",
  "description": "A journey through space and time",
  "ipfsHash": "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
  "paymentModel": "pay_per_stream"
}
```

**Validation Rules:**
- `id` - Required, non-empty string
- `title` - Required, non-empty string
- `artist` - Required, non-empty string
- `artistAddress` - Required, valid Ethereum address (0x + 40 hex chars)
- `genre` - Required, non-empty string
- `ipfsHash` - Required, non-empty string
- `paymentModel` - Required, non-empty string
- `description` - Optional string

**Response** `201 Created`
```json
{
  "id": "song-uuid-123",
  "title": "Cosmic Voyage",
  "artist": "DJ Mycelix",
  "artist_address": "0x1234567890abcdef1234567890abcdef12345678",
  "genre": "Electronic",
  "description": "A journey through space and time",
  "ipfs_hash": "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
  "payment_model": "pay_per_stream",
  "created_at": "2025-01-15T10:00:00.000Z",
  "plays": 0,
  "earnings": "0"
}
```

**Errors:**
- `400` - Invalid or missing required fields
- `409` - Song with this ID already exists

---

#### POST /api/songs/:id/play
Record a play event for a song.

**Parameters:**
- `id` (string, required) - Song identifier

**Request Body:**
```json
{
  "listenerAddress": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  "amount": 0.01,
  "paymentType": "stream"
}
```

**Validation Rules:**
- `listenerAddress` - Optional, must be valid Ethereum address if provided
- `amount` - Optional number, must be >= 0
- `paymentType` - Optional, one of: `stream`, `download`, `tip`, `patronage`, `nft_access`

**Response** `200 OK`
```json
{
  "success": true
}
```

**Errors:**
- `400` - Invalid parameters
- `404` - Song not found

---

#### GET /api/songs/:id/plays
Get play history for a song.

**Parameters:**
- `id` (string, required) - Song identifier

**Response** `200 OK`
```json
[
  {
    "id": 1,
    "song_id": "song-uuid-123",
    "listener_address": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    "amount": "0.01",
    "payment_type": "stream",
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
]
```

**Errors:**
- `500` - Server error

---

### Artists

#### GET /api/artists/:address/stats
Get statistics for an artist.

**Parameters:**
- `address` (string, required) - Ethereum address of the artist

**Response** `200 OK`
```json
{
  "artistAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "totalSongs": 5,
  "totalPlays": 12500,
  "totalEarnings": 125.50
}
```

**Errors:**
- `400` - Invalid artist address
- `500` - Server error

---

### IPFS Upload

#### POST /api/upload-to-ipfs
Upload a file to IPFS (currently mocked).

**Note**: This endpoint currently returns mock data. Integrate with Web3.Storage for production.

**Response** `200 OK`
```json
{
  "ipfsHash": "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
  "gateway": "https://w3s.link/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"
}
```

---

### Decentralized Knowledge Graph

#### POST /api/create-dkg-claim
Create a DKG claim on Ceramic Network (currently mocked).

**Request Body:**
```json
{
  "songId": "song-uuid-123",
  "title": "Cosmic Voyage",
  "artist": "DJ Mycelix",
  "ipfsHash": "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
  "artistAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "epistemicTier": "epistemic",
  "networkTier": "network",
  "memoryTier": "memory"
}
```

**Response** `200 OK`
```json
{
  "streamId": "kjzl6cwe1jw14abc123...",
  "songId": "song-uuid-123",
  "epistemicTier": "epistemic",
  "networkTier": "network",
  "memoryTier": "memory",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

---

## Examples

### Register a Song and Record a Play

```bash
# 1. Register a song
curl -X POST http://localhost:3100/api/songs \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-song-1",
    "title": "Test Song",
    "artist": "Test Artist",
    "artistAddress": "0x1234567890abcdef1234567890abcdef12345678",
    "genre": "Electronic",
    "description": "A test song",
    "ipfsHash": "QmTest123",
    "paymentModel": "pay_per_stream"
  }'

# 2. Record a play
curl -X POST http://localhost:3100/api/songs/my-song-1/play \
  -H "Content-Type: application/json" \
  -d '{
    "listenerAddress": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    "amount": 0.01,
    "paymentType": "stream"
  }'

# 3. Get song details
curl http://localhost:3100/api/songs/my-song-1

# 4. Get artist stats
curl http://localhost:3100/api/artists/0x1234567890abcdef1234567890abcdef12345678/stats
```

### JavaScript/TypeScript Example

```typescript
const API_BASE_URL = 'http://localhost:3100';

// Register a song
async function registerSong(songData: any) {
  const response = await fetch(`${API_BASE_URL}/api/songs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(songData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return response.json();
}

// Get all songs
async function getAllSongs() {
  const response = await fetch(`${API_BASE_URL}/api/songs`);
  return response.json();
}

// Record a play
async function recordPlay(songId: string, playData: any) {
  const response = await fetch(`${API_BASE_URL}/api/songs/${songId}/play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(playData),
  });

  return response.json();
}
```

---

## Performance & Caching

### Caching Strategy
- **Songs list**: 30 second TTL
- **Individual songs**: 60 second TTL
- **Cache invalidation**: Automatic on mutations (song creation, play recording)

### Rate Limiting
- 100 requests per minute per IP address
- Returns HTTP 429 with `retryAfter` when exceeded
- Automatic cleanup of expired rate limit records

### Database Indexes
The following indexes are automatically created for optimal query performance:
- `idx_songs_artist_address` - Fast artist filtering
- `idx_songs_genre` - Fast genre filtering
- `idx_songs_payment_model` - Fast payment model filtering
- `idx_songs_created_at` - Fast chronological sorting
- `idx_plays_song_id` - Fast play history lookup
- `idx_plays_listener_address` - Fast listener history
- `idx_plays_timestamp` - Fast time-based queries

---

## Security

### Request Validation
All inputs are validated before processing:
- Type checking for all parameters
- Ethereum address format validation
- String length and emptiness checks
- Numeric range validation
- Payment type whitelisting

### Security Headers
The API automatically sets the following security headers:
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` - XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` (production only)

### Request Size Limits
- JSON payload limit: 10MB
- URL-encoded payload limit: 10MB

---

## Monitoring & Health

### Structured Logging
All logs are output in JSON format for easy parsing:
```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "level": "INFO",
  "message": "API server running on port 3100",
  "meta": {}
}
```

**Log Levels:**
- `INFO` - General information
- `WARN` - Warning messages
- `ERROR` - Error messages (includes stack traces in development)
- `DEBUG` - Debug messages (development only)

### Health Check
Use `/health` endpoint for monitoring:
- Returns `200` when all dependencies are healthy
- Returns `503` when any dependency is unavailable
- Includes uptime, environment, and dependency status

---

## Production Considerations

### Environment Variables
See `.env.example` for required configuration.

### Database
- Uses PostgreSQL with connection pooling
- Automatic reconnection on connection loss
- Graceful connection cleanup on shutdown

### Redis
- Used for caching and session management
- Automatic reconnection on connection loss
- Graceful connection cleanup on shutdown

### Graceful Shutdown
The API handles shutdown signals (SIGTERM, SIGINT) gracefully:
1. Stops accepting new connections
2. Completes in-flight requests
3. Closes database connections
4. Closes Redis connection
5. Exits cleanly

### Error Handling
- Uncaught exceptions trigger graceful shutdown
- Unhandled promise rejections trigger graceful shutdown
- All errors are logged with full context

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/luminous-dynamics/mycelix-music/issues
- Documentation: See `/docs` directory
- Migration Guide: See `MIGRATION_GUIDE.md`
