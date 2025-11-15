# 🔌 API Usage Guide

Complete guide to using the Mycelix Music REST API.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Authentication](#authentication)
3. [Common Operations](#common-operations)
4. [Economic Strategies](#economic-strategies)
5. [Rate Limiting](#rate-limiting)
6. [Error Handling](#error-handling)
7. [SDKs & Clients](#sdks--clients)

---

## Quick Start

### Base URLs

- **Local Development**: `http://localhost:3100`
- **Testnet**: `https://api-testnet.mycelix.com`
- **Production**: `https://api.mycelix.com`

### Interactive Documentation

Visit `/api-docs` for interactive Swagger UI:
```
http://localhost:3100/api-docs
```

### Example Request

```bash
# Get all songs
curl http://localhost:3100/api/songs

# Search for songs
curl "http://localhost:3100/api/songs/search?q=electronic"

# Get song details
curl http://localhost:3100/api/songs/song-123
```

---

## Authentication

Most endpoints require wallet-based authentication via Privy.

### Get JWT Token

1. Connect wallet using Privy on the frontend
2. Get JWT token from Privy session
3. Include in Authorization header

```javascript
// Frontend: Get token from Privy
const { getAccessToken } = usePrivy();
const token = await getAccessToken();

// Make authenticated request
const response = await fetch('http://localhost:3100/api/songs', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});
```

### cURL with Authentication

```bash
TOKEN="your-jwt-token"

curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3100/api/artists/0x.../stats
```

---

## Common Operations

### List Songs

```http
GET /api/songs?page=1&limit=20&strategy=pay-per-stream
```

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20, max: 100)
- `strategy` (string): Filter by strategy (pay-per-stream, gift-economy, patronage, auction)
- `genre` (string): Filter by genre
- `sort` (string): Sort order (newest, oldest, popular, trending)

**Response:**
```json
{
  "songs": [
    {
      "songId": "song-123",
      "title": "Blockchain Symphony",
      "artist": "Crypto Composer",
      "artistAddress": "0x...",
      "genre": "Electronic",
      "strategy": "pay-per-stream",
      "price": "0.01",
      "playCount": 150,
      "createdAt": "2025-11-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Upload Song

```http
POST /api/songs
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "My New Song",
  "artist": "Artist Name",
  "genre": "Electronic",
  "duration": 240,
  "ipfsHash": "QmXXXXXXXXXXXXXXXXXXX",
  "strategy": "pay-per-stream",
  "price": "0.01",
  "splits": [
    {
      "recipient": "0x...",
      "basisPoints": 9500,
      "role": "artist"
    },
    {
      "recipient": "0x...",
      "basisPoints": 500,
      "role": "platform"
    }
  ]
}
```

**Response:**
```json
{
  "songId": "song-456",
  "title": "My New Song",
  "transactionHash": "0x...",
  "createdAt": "2025-11-15T10:30:00Z"
}
```

### Play a Song

```http
POST /api/songs/{songId}/play
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "duration": 180
}
```

**Response:**
```json
{
  "playId": "play-789",
  "transactionHash": "0x...",
  "amountPaid": "0.01"
}
```

### Search Songs

```http
GET /api/songs/search?q=electronic&limit=20
```

**Response:**
```json
{
  "results": [
    {
      "songId": "song-123",
      "title": "Electronic Dreams",
      "artist": "DJ Nova",
      "score": 0.95
    }
  ],
  "total": 42
}
```

### Get Artist Statistics

```http
GET /api/artists/{address}/stats
```

**Response:**
```json
{
  "address": "0x...",
  "totalPlays": 1500,
  "totalEarnings": "15.5",
  "uniqueListeners": 320,
  "avgEarningsPerPlay": "0.0103",
  "topSongs": [
    {
      "songId": "song-123",
      "title": "Hit Song",
      "playCount": 800
    }
  ]
}
```

---

## Economic Strategies

### Pay-Per-Stream

Listener pays fixed amount per play.

```json
{
  "strategy": "pay-per-stream",
  "price": "0.01",
  "splits": [
    { "recipient": "0x...", "basisPoints": 10000, "role": "artist" }
  ]
}
```

### Gift Economy

Free listening with CGC rewards.

```json
{
  "strategy": "gift-economy",
  "giftEconomyConfig": {
    "cgcPerListen": "1.0",
    "earlyListenerBonus": "0.5",
    "earlyListenerThreshold": 1000,
    "repeatListenerMultiplier": 15000
  }
}
```

### Patronage

Monthly subscription model.

```json
{
  "strategy": "patronage",
  "patronageConfig": {
    "monthlyFee": "10.0",
    "minimumDuration": 0,
    "allowCancellation": true,
    "tierBonuses": [0, 500, 1000, 2000]
  }
}
```

### Auction

Dutch auction for limited releases.

```json
{
  "strategy": "auction",
  "auctionConfig": {
    "startPrice": "100.0",
    "endPrice": "10.0",
    "duration": 604800,
    "totalSupply": 100
  }
}
```

---

## Rate Limiting

**Limits:**
- Unauthenticated: 100 requests per 15 minutes
- Authenticated: 1000 requests per hour

**Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1699564800
```

**Response when rate limited:**
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "error": "Rate limit exceeded",
  "message": "Too many requests, please try again later",
  "retryAfter": 60
}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": "Validation Error",
  "message": "Invalid song ID format",
  "statusCode": 400
}
```

### Status Codes

- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

### Common Errors

**Invalid Song ID:**
```json
{
  "error": "Not Found",
  "message": "Song not found",
  "statusCode": 404
}
```

**Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token",
  "statusCode": 401
}
```

**Validation Error:**
```json
{
  "error": "Validation Error",
  "message": "Price must be a positive number",
  "statusCode": 400
}
```

---

## SDKs & Clients

### TypeScript/JavaScript

```bash
npm install @mycelix/sdk
```

```typescript
import { MycelixSDK } from '@mycelix/sdk';

const sdk = new MycelixSDK({
  apiUrl: 'http://localhost:3100',
  provider,
  signer,
});

// Get songs
const songs = await sdk.getSongs({ limit: 20 });

// Upload song
const tx = await sdk.uploadSong({
  title: 'My Song',
  // ...
});
```

### Python (Community)

```bash
pip install mycelix-python
```

```python
from mycelix import MycelixClient

client = MycelixClient(api_url='http://localhost:3100')

# Get songs
songs = client.get_songs(limit=20)

# Search
results = client.search_songs(query='electronic')
```

### Generate Custom Client

Using OpenAPI Generator:

```bash
# TypeScript/Axios
npx openapi-generator-cli generate \
  -i docs/openapi.yaml \
  -g typescript-axios \
  -o packages/api-client

# Python
npx openapi-generator-cli generate \
  -i docs/openapi.yaml \
  -g python \
  -o clients/python

# Java
npx openapi-generator-cli generate \
  -i docs/openapi.yaml \
  -g java \
  -o clients/java
```

---

## Webhook Integration

### Subscribe to Events

```http
POST /api/webhooks
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "url": "https://your-app.com/webhook",
  "events": ["song.played", "payment.completed"]
}
```

### Webhook Payload

```json
{
  "event": "song.played",
  "data": {
    "songId": "song-123",
    "listener": "0x...",
    "timestamp": 1699564800
  },
  "signature": "..."
}
```

---

## Best Practices

### 1. Use Pagination

Always use pagination for large datasets:

```javascript
async function getAllSongs() {
  let allSongs = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `http://localhost:3100/api/songs?page=${page}&limit=100`
    );
    const data = await response.json();

    allSongs = allSongs.concat(data.songs);
    hasMore = data.pagination.page < data.pagination.totalPages;
    page++;
  }

  return allSongs;
}
```

### 2. Handle Rate Limiting

Implement exponential backoff:

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);

    if (response.status !== 429) {
      return response;
    }

    // Wait before retrying (exponential backoff)
    const delay = Math.pow(2, i) * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  throw new Error('Max retries exceeded');
}
```

### 3. Cache Responses

Cache frequently accessed data:

```javascript
const cache = new Map();

async function getCachedSong(songId) {
  if (cache.has(songId)) {
    return cache.get(songId);
  }

  const response = await fetch(`http://localhost:3100/api/songs/${songId}`);
  const song = await response.json();

  cache.set(songId, song);
  setTimeout(() => cache.delete(songId), 5 * 60 * 1000); // 5 min cache

  return song;
}
```

### 4. Validate Input

Always validate before sending:

```javascript
function validateSongData(data) {
  const errors = [];

  if (!data.title || data.title.length < 1) {
    errors.push('Title is required');
  }

  if (!data.ipfsHash || !/^Qm[a-zA-Z0-9]{44}$/.test(data.ipfsHash)) {
    errors.push('Invalid IPFS hash');
  }

  if (data.price && parseFloat(data.price) <= 0) {
    errors.push('Price must be positive');
  }

  return errors;
}
```

---

## Examples

### Complete Upload Flow

```javascript
async function uploadSong(file, metadata) {
  // 1. Upload to IPFS
  const formData = new FormData();
  formData.append('file', file);

  const uploadResponse = await fetch('http://localhost:3100/api/upload/ipfs', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  const { ipfsHash } = await uploadResponse.json();

  // 2. Register song
  const songResponse = await fetch('http://localhost:3100/api/songs', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...metadata,
      ipfsHash,
    }),
  });

  return await songResponse.json();
}
```

### Play and Pay Flow

```javascript
async function playSong(songId, duration) {
  // Record play
  const response = await fetch(`http://localhost:3100/api/songs/${songId}/play`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ duration }),
  });

  const { transactionHash, amountPaid } = await response.json();

  console.log(`Paid ${amountPaid} FLOW, tx: ${transactionHash}`);

  // Track analytics
  await fetch('http://localhost:3100/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'song_completed',
      properties: { songId, duration },
    }),
  });
}
```

---

## Troubleshooting

**Q: Getting 401 Unauthorized**
A: Check that your JWT token is valid and not expired. Get a fresh token from Privy.

**Q: CORS errors**
A: Make sure your frontend URL is in the CORS_ORIGINS environment variable.

**Q: Rate limited**
A: Implement exponential backoff or upgrade to authenticated requests for higher limits.

**Q: Uploads failing**
A: Check file size (max 50MB) and format (MP3, FLAC, WAV supported).

---

## Resources

- [OpenAPI Specification](./openapi.yaml)
- [Interactive Docs](/api-docs)
- [SDK Documentation](./INTEGRATION_GUIDE.md)
- [Support](mailto:hello@mycelix.com)

---

**Last Updated**: 2025-11-15
