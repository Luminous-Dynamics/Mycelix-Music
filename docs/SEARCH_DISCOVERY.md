# Search & Discovery System Documentation

**Version:** 1.0
**Last Updated:** November 2025
**Phase:** 19 - Advanced Search & Discovery Engine

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Search Features](#search-features)
5. [Discovery Features](#discovery-features)
6. [Recommendation Engine](#recommendation-engine)
7. [API Reference](#api-reference)
8. [React Hooks](#react-hooks)
9. [UI Components](#ui-components)
10. [Performance Optimization](#performance-optimization)
11. [Best Practices](#best-practices)

---

## Overview

The Search & Discovery system provides comprehensive search capabilities and personalized music discovery features for the Mycelix Music platform. It includes:

- **Full-text search** with PostgreSQL's advanced text search capabilities
- **Intelligent autocomplete** with search suggestions
- **Trending songs** with recency-weighted scoring
- **Rising artists** detection based on growth metrics
- **Personalized recommendations** using collaborative and content-based filtering
- **Discovery modes** (conservative, balanced, adventurous)
- **Genre-based discovery** with trending genres
- **Similar song detection** using multiple similarity factors
- **Listening history tracking** for improved recommendations
- **Search history** for user convenience

### Key Benefits

- **Fast Search**: GIN indexes enable sub-100ms full-text search
- **Personalized**: Recommendations adapt to user listening behavior
- **Real-time Trends**: Auto-refreshing trending data (5-minute intervals)
- **Smart Caching**: React Query optimizes data fetching and reduces API calls
- **Scalable**: Materialized views handle complex aggregations efficiently

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
├─────────────────────────────────────────────────────────────┤
│  Components:                                                 │
│  - SearchBar (autocomplete, keyboard nav)                   │
│  - SearchResults (songs, artists, playlists, users)         │
│  - DiscoveryFeed (trending, recommendations, rising)        │
│  - AdvancedSearchFilters (genre, strategy, date, plays)     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ React Query Hooks
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    API Layer (Express)                       │
├─────────────────────────────────────────────────────────────┤
│  Endpoints:                                                  │
│  - GET /api/search (universal search)                       │
│  - GET /api/search/suggestions (autocomplete)               │
│  - GET /api/search/trending (trending songs)                │
│  - GET /api/search/rising (rising artists)                  │
│  - GET /api/search/recommendations/:user (personalized)     │
│  - POST /api/search/advanced (filtered search)              │
│  - POST /api/search/listen (track listening events)         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ SQL Queries
                     │
┌────────────────────▼────────────────────────────────────────┐
│                 Database (PostgreSQL)                        │
├─────────────────────────────────────────────────────────────┤
│  Tables:                                                     │
│  - search_history (user searches)                           │
│  - listening_history (play tracking)                        │
│  - user_preferences (genres, discovery mode)                │
│  - song_similarities (similar songs)                        │
│                                                              │
│  Materialized Views:                                         │
│  - mv_trending_songs (trending with decay)                  │
│  - mv_genre_trends (popular genres)                         │
│  - mv_rising_artists (fastest growing)                      │
│                                                              │
│  Functions:                                                  │
│  - search_all() (full-text search)                          │
│  - get_personalized_recommendations() (ML-style recs)       │
│  - get_similar_songs() (content similarity)                 │
│  - refresh_discovery_views() (update materialized views)    │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**Search Flow:**
1. User types in SearchBar
2. Debounced query (300ms) triggers `useSearch` hook
3. Hook checks React Query cache
4. If not cached, API request to `/api/search`
5. Backend performs full-text search with `search_all()` function
6. Results ranked by relevance using `ts_rank`
7. Results cached for 30 seconds
8. Search recorded in `search_history`

**Discovery Flow:**
1. User loads DiscoveryFeed component
2. Multiple hooks fire in parallel: `useTrending`, `useRising`, `useRecommendations`
3. Each hook checks cache (stale times: 2-10 minutes)
4. If stale, fetch from respective endpoints
5. Backend queries materialized views for fast response
6. Auto-refresh every 5-10 minutes in background
7. Results displayed with loading skeletons

**Recommendation Flow:**
1. User plays a song
2. `useRecordListen` mutation tracks: duration, completion, liked status
3. Data inserted into `listening_history`
4. Recommendation cache invalidated
5. Next recommendation fetch uses updated history
6. `get_personalized_recommendations()` function analyzes:
   - Genre preferences (40% weight)
   - Followed artists (30% weight)
   - Trending scores (20% weight)
   - Popularity (10% weight)
7. Results filtered by discovery mode (conservative/balanced/adventurous)

---

## Database Schema

### Tables

#### search_history
Tracks all user searches for autocomplete and analytics.

```sql
CREATE TABLE search_history (
    id BIGSERIAL PRIMARY KEY,
    user_address VARCHAR(42) NOT NULL,
    search_query TEXT NOT NULL,
    search_type VARCHAR(50) NOT NULL, -- 'all', 'songs', 'artists', etc.
    result_count INTEGER DEFAULT 0,
    searched_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_search_history_user (user_address, searched_at DESC),
    INDEX idx_search_history_query (search_query)
);
```

#### listening_history
Records every song play for recommendation engine.

```sql
CREATE TABLE listening_history (
    id BIGSERIAL PRIMARY KEY,
    listener_address VARCHAR(42) NOT NULL,
    song_id VARCHAR(255) NOT NULL,
    artist_address VARCHAR(42) NOT NULL,
    genre VARCHAR(100),
    strategy VARCHAR(50),
    play_duration INTEGER, -- seconds
    completed BOOLEAN DEFAULT FALSE, -- played >80%
    skipped BOOLEAN DEFAULT FALSE, -- stopped <30%
    liked BOOLEAN DEFAULT FALSE,
    played_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_listening_history_user (listener_address, played_at DESC),
    INDEX idx_listening_history_song (song_id)
);
```

#### user_preferences
Stores user discovery settings and preferences.

```sql
CREATE TABLE user_preferences (
    user_address VARCHAR(42) PRIMARY KEY,
    favorite_genres TEXT[], -- array of preferred genres
    favorite_strategies TEXT[], -- preferred economic strategies
    blocked_artists TEXT[], -- artists to exclude
    discovery_mode VARCHAR(20) DEFAULT 'balanced', -- conservative/balanced/adventurous
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### song_similarities
Pre-computed song similarity scores for fast recommendations.

```sql
CREATE TABLE song_similarities (
    song_id_a VARCHAR(255) NOT NULL,
    song_id_b VARCHAR(255) NOT NULL,
    similarity_score DECIMAL(5,4), -- 0.0000 to 1.0000
    similarity_type VARCHAR(50), -- 'genre', 'artist', 'collaborative', 'content'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (song_id_a, song_id_b),
    INDEX idx_song_similarities_a (song_id_a, similarity_score DESC)
);
```

### Materialized Views

#### mv_trending_songs
Songs ranked by trending score with recency decay.

```sql
CREATE MATERIALIZED VIEW mv_trending_songs AS
SELECT
    s.song_id,
    s.title,
    s.artist_address,
    a.name as artist_name,
    s.genre,
    s.strategy,
    s.cover_art_url,
    COUNT(DISTINCT lh.id) as play_count_7d,
    COUNT(DISTINCT sc.id) as comment_count_7d,
    COUNT(DISTINCT ps.id) as playlist_adds_7d,
    (
        -- Weighted engagement score
        (COUNT(DISTINCT lh.id) * 0.5) +           -- plays: 50%
        (COUNT(DISTINCT sc.id) * 5 * 0.2) +      -- comments: 20% (5x weight)
        (COUNT(DISTINCT ps.id) * 10 * 0.2) +     -- playlist adds: 20% (10x weight)
        (COUNT(DISTINCT af.id) * 2 * 0.1)        -- artist follows: 10% (2x weight)
    ) * POWER(0.95, EXTRACT(DAY FROM NOW() - s.created_at)) as trending_score
    -- Decay: 5% per day since creation
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
WHERE s.created_at >= NOW() - INTERVAL '90 days'
GROUP BY s.song_id, a.name
HAVING COUNT(DISTINCT lh.id) > 0
ORDER BY trending_score DESC;
```

**Refresh Strategy:** Auto-refresh every 5 minutes via cron job or trigger.

#### mv_genre_trends
Popular genres with engagement metrics.

```sql
CREATE MATERIALIZED VIEW mv_genre_trends AS
SELECT
    s.genre,
    COUNT(DISTINCT s.song_id) as song_count,
    COUNT(DISTINCT s.artist_address) as artist_count,
    SUM(CASE WHEN lh.played_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) as total_plays_7d,
    SUM(CASE WHEN lh.played_at >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END) as total_plays_30d,
    AVG(CASE WHEN lh.played_at >= NOW() - INTERVAL '7 days' THEN lh.play_duration END) as avg_play_duration_7d
FROM songs s
LEFT JOIN listening_history lh ON s.song_id = lh.song_id
WHERE s.genre IS NOT NULL
GROUP BY s.genre
HAVING COUNT(DISTINCT s.song_id) >= 5 -- minimum 5 songs
ORDER BY total_plays_7d DESC;
```

#### mv_rising_artists
Artists with fastest growth in followers and engagement.

```sql
CREATE MATERIALIZED VIEW mv_rising_artists AS
SELECT
    a.artist_address,
    a.name as artist_name,
    COUNT(DISTINCT af.follower_address) as follower_count,
    COUNT(DISTINCT s.song_id) as song_count,
    COUNT(DISTINCT lh.id) FILTER (WHERE lh.played_at >= NOW() - INTERVAL '7 days') as play_count_7d,
    COUNT(DISTINCT af.follower_address) FILTER (WHERE af.followed_at >= NOW() - INTERVAL '7 days') as new_followers_7d,
    (
        (COUNT(DISTINCT af.follower_address) FILTER (WHERE af.followed_at >= NOW() - INTERVAL '7 days') * 10) +
        (COUNT(DISTINCT lh.id) FILTER (WHERE lh.played_at >= NOW() - INTERVAL '7 days') * 1) +
        (COUNT(DISTINCT s.song_id) FILTER (WHERE s.created_at >= NOW() - INTERVAL '30 days') * 50)
    ) as rising_score,
    MIN(a.created_at) as artist_since
FROM artists a
LEFT JOIN artist_followers af ON a.artist_address = af.artist_address
LEFT JOIN songs s ON a.artist_address = s.artist_address
LEFT JOIN listening_history lh ON s.song_id = lh.song_id
WHERE a.created_at >= NOW() - INTERVAL '365 days' -- active within last year
GROUP BY a.artist_address, a.name
HAVING COUNT(DISTINCT af.follower_address) FILTER (WHERE af.followed_at >= NOW() - INTERVAL '7 days') > 0
ORDER BY rising_score DESC;
```

### Full-Text Search Configuration

```sql
-- Custom search configuration optimized for music
CREATE TEXT SEARCH CONFIGURATION music_search (COPY = english);

-- Add custom stop words (optional)
-- ALTER TEXT SEARCH CONFIGURATION music_search DROP MAPPING FOR asciiword;

-- Create GIN indexes for fast full-text search
CREATE INDEX idx_songs_fts ON songs
USING gin(to_tsvector('music_search',
    coalesce(title, '') || ' ' ||
    coalesce(genre, '') || ' ' ||
    coalesce(description, '')
));

CREATE INDEX idx_artists_fts ON artists
USING gin(to_tsvector('music_search',
    coalesce(name, '') || ' ' ||
    coalesce(bio, '')
));

CREATE INDEX idx_playlists_fts ON playlists
USING gin(to_tsvector('music_search',
    coalesce(name, '') || ' ' ||
    coalesce(description, '')
));
```

**Index Performance:**
- GIN index size: ~10-20% of table size
- Search query time: 10-100ms for millions of records
- Index build time: ~1 second per 10,000 records

---

## Search Features

### Universal Search

Search across all content types (songs, artists, playlists, users) with a single query.

**API Endpoint:**
```
GET /api/search?q={query}&type={type}&limit={limit}&userAddress={address}
```

**Parameters:**
- `q` (required): Search query string (min 2 characters)
- `type` (optional): `all`, `songs`, `artists`, `playlists`, `users` (default: `all`)
- `limit` (optional): Results per type (default: 20, max: 100)
- `userAddress` (optional): For personalized ranking

**Example Response:**
```json
{
  "query": "electronic beats",
  "results": [
    {
      "result_type": "song",
      "result_id": "song_123",
      "title": "Electronic Symphony",
      "subtitle": "DJ Producer",
      "image_url": "https://...",
      "relevance": 0.8542
    },
    {
      "result_type": "artist",
      "result_id": "0x1234...",
      "title": "The Electronic Collective",
      "subtitle": "12 songs • 1.5K followers",
      "relevance": 0.7231
    }
  ],
  "count": 45,
  "searchTime": 87
}
```

### Search Suggestions (Autocomplete)

Provides real-time search suggestions based on popular searches and content.

**API Endpoint:**
```
GET /api/search/suggestions?q={query}&limit={limit}
```

**Suggestion Types:**
- `artist`: Artist names
- `genre`: Music genres
- `tag`: Popular tags/keywords

**Example Response:**
```json
{
  "suggestions": [
    {
      "suggestion": "electronic",
      "suggestion_type": "genre",
      "popularity_score": 8542
    },
    {
      "suggestion": "Electronic Dreams",
      "suggestion_type": "artist",
      "popularity_score": 1234
    }
  ]
}
```

### Search History

Tracks user searches for convenience and autocomplete improvements.

**API Endpoints:**
```
GET /api/search/history/:userAddress?limit={limit}
DELETE /api/search/history/:userAddress
```

**Features:**
- Last 50 searches stored per user
- Duplicate searches update timestamp
- Privacy-conscious: user can clear history anytime
- Used to improve autocomplete suggestions

### Advanced Search

Filtered search with multiple criteria.

**API Endpoint:**
```
POST /api/search/advanced
Content-Type: application/json

{
  "query": "summer vibes",
  "genres": ["pop", "indie"],
  "strategies": ["pay-per-stream"],
  "minPlays": 1000,
  "maxPlays": 100000,
  "dateFrom": "2024-01-01",
  "dateTo": "2024-12-31",
  "sortBy": "play_count",
  "sortOrder": "desc",
  "limit": 50,
  "offset": 0
}
```

**Filterable Fields:**
- `genres`: Array of genre strings
- `strategies`: Economic strategies
- `minPlays`/`maxPlays`: Play count range
- `dateFrom`/`dateTo`: Creation date range
- `sortBy`: `title`, `created_at`, `play_count`, `total_earnings`
- `sortOrder`: `asc` or `desc`

---

## Discovery Features

### Trending Songs

Songs with highest engagement in recent days, with recency decay.

**API Endpoint:**
```
GET /api/search/trending?genre={genre}&limit={limit}
```

**Trending Score Formula:**
```
trending_score = (
  (plays_7d × 0.5) +
  (comments_7d × 5 × 0.2) +
  (playlist_adds_7d × 10 × 0.2) +
  (artist_follows_7d × 2 × 0.1)
) × 0.95^days_since_creation
```

**Weighting Rationale:**
- Plays (50%): Primary engagement metric
- Comments (20%): Strong engagement signal, 5x weight
- Playlist adds (20%): High intent action, 10x weight
- Artist follows (10%): Secondary metric, 2x weight
- Decay (5% per day): Ensures fresh content surfaces

**Example Response:**
```json
{
  "trending": [
    {
      "song_id": "song_456",
      "title": "Summer Nights",
      "artist_name": "Coastal Waves",
      "genre": "indie",
      "trending_score": 1247.82,
      "play_count_7d": 4521,
      "comment_count_7d": 43,
      "playlist_adds_7d": 89
    }
  ]
}
```

### Rising Artists

Artists with fastest growth in followers and engagement.

**API Endpoint:**
```
GET /api/search/rising?limit={limit}
```

**Rising Score Formula:**
```
rising_score = (
  (new_followers_7d × 10) +
  (plays_7d × 1) +
  (new_songs_30d × 50)
)
```

**Criteria:**
- Artist active within last year
- At least 1 new follower in last 7 days
- Minimum 1 song published

**Example Response:**
```json
{
  "rising": [
    {
      "artist_address": "0xabc...",
      "artist_name": "Luna Eclipse",
      "follower_count": 342,
      "new_followers_7d": 87,
      "song_count": 12,
      "play_count_7d": 1249,
      "rising_score": 2119,
      "artist_since": "2024-03-15T00:00:00Z"
    }
  ]
}
```

### Genre Trends

Popular genres with engagement metrics.

**API Endpoint:**
```
GET /api/search/genres/trending
```

**Example Response:**
```json
{
  "genres": [
    {
      "genre": "electronic",
      "song_count": 1247,
      "artist_count": 342,
      "total_plays_7d": 45231,
      "total_plays_30d": 178942,
      "avg_play_duration_7d": 187.5
    }
  ]
}
```

---

## Recommendation Engine

### Personalized Recommendations

Hybrid recommendation system combining collaborative and content-based filtering.

**API Endpoint:**
```
GET /api/search/recommendations/:userAddress?limit={limit}
```

**Algorithm Components:**

1. **Genre Matching (40% weight)**
   - Analyzes listening history genres
   - Identifies top 3 preferred genres
   - Finds songs in those genres not yet heard

2. **Followed Artists (30% weight)**
   - Prioritizes new songs from followed artists
   - Includes similar artists based on genre/style

3. **Trending Score (20% weight)**
   - Incorporates current trending songs
   - Ensures fresh, popular content surfaces

4. **Popularity Baseline (10% weight)**
   - Includes well-established songs
   - Balances discovery with proven quality

**Discovery Modes:**

- **Conservative**: Only recommend genres user has listened to, higher weight on followed artists
  - Genre match: 50%, Followed artists: 40%, Trending: 5%, Popularity: 5%

- **Balanced**: Mix of familiar and new genres
  - Genre match: 40%, Followed artists: 30%, Trending: 20%, Popularity: 10% (default)

- **Adventurous**: Explore new genres, prioritize trending and rising content
  - Genre match: 20%, Followed artists: 20%, Trending: 40%, Popularity: 20%

**Example Response:**
```json
{
  "recommendations": [
    {
      "song_id": "song_789",
      "title": "Midnight Drive",
      "artist_name": "Neon Pulse",
      "genre": "synthwave",
      "recommendation_score": 0.8734,
      "reason": "Based on your love for synthwave"
    },
    {
      "song_id": "song_012",
      "title": "New Dawn",
      "artist_name": "Sunrise Collective",
      "genre": "indie",
      "recommendation_score": 0.8412,
      "reason": "You follow Sunrise Collective"
    }
  ],
  "personalized": true,
  "discovery_mode": "balanced"
}
```

### Similar Songs

Content-based similarity using multiple factors.

**API Endpoint:**
```
GET /api/search/similar/:songId?limit={limit}
```

**Similarity Factors:**
- Same genre (0.5 weight)
- Same artist (0.3 weight)
- Same strategy (0.1 weight)
- Collaborative filtering: users who liked X also liked Y (0.1 weight)

**Example Response:**
```json
{
  "similar": [
    {
      "song_id": "song_345",
      "title": "Ocean Waves",
      "artist_name": "Coastal Dreams",
      "similarity_score": 0.8923,
      "similarity_reasons": ["Same genre: ambient", "Popular with same listeners"]
    }
  ]
}
```

### Discovery Feed

Personalized mix combining recommendations, trending, and rising content.

**API Endpoint:**
```
GET /api/search/discover/:userAddress?mode={mode}&limit={limit}
```

**Feed Composition:**
- 40% personalized recommendations
- 30% trending songs
- 20% songs from followed artists
- 10% rising artists' songs

**Modes:** conservative, balanced, adventurous (affects recommendation weights)

---

## API Reference

### Complete Endpoint List

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search` | Universal search |
| GET | `/api/search/suggestions` | Search autocomplete |
| GET | `/api/search/history/:userAddress` | User search history |
| DELETE | `/api/search/history/:userAddress` | Clear search history |
| GET | `/api/search/trending` | Trending songs |
| GET | `/api/search/rising` | Rising artists |
| GET | `/api/search/recommendations/:userAddress` | Personalized recommendations |
| GET | `/api/search/similar/:songId` | Similar songs |
| GET | `/api/search/genres/trending` | Trending genres |
| GET | `/api/search/discover/:userAddress` | Discovery feed |
| POST | `/api/search/advanced` | Advanced filtered search |
| POST | `/api/search/listen` | Record listening event |
| GET | `/api/search/preferences/:userAddress` | Get user preferences |
| PUT | `/api/search/preferences/:userAddress` | Update preferences |

### Error Responses

All endpoints use consistent error format:

```json
{
  "error": "Error message",
  "details": "Additional context",
  "code": "ERROR_CODE"
}
```

**Common Error Codes:**
- `INVALID_QUERY`: Search query too short or invalid
- `USER_NOT_FOUND`: User address doesn't exist
- `SONG_NOT_FOUND`: Song ID doesn't exist
- `RATE_LIMITED`: Too many requests
- `SERVER_ERROR`: Internal server error

---

## React Hooks

### useSearch

Main search hook with automatic debouncing.

```typescript
import { useSearch } from '@/hooks/useSearch';

function SearchComponent() {
  const { query, setQuery, results, count, isLoading } = useSearch(
    '', // initial query
    'all', // type: 'all' | 'songs' | 'artists' | 'playlists' | 'users'
    userAddress // optional for personalization
  );

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
      />
      {isLoading && <Spinner />}
      {results.map(result => <ResultCard key={result.result_id} {...result} />)}
    </div>
  );
}
```

**Features:**
- Automatic 300ms debouncing
- Minimum 2 characters before search
- 30-second cache
- Returns: `query`, `setQuery`, `results`, `count`, `isLoading`, `isError`, `error`

### useSearchSuggestions

Autocomplete suggestions hook.

```typescript
const { data, isLoading } = useSearchSuggestions(query, 10);
const suggestions = data?.suggestions || [];
```

**Features:**
- 1-minute cache
- Activates with 1+ characters
- Returns popular artist names, genres, tags

### useTrending

Trending songs with auto-refresh.

```typescript
const { data, isLoading } = useTrending(
  'electronic', // optional genre filter
  20 // limit
);
const trending = data?.trending || [];
```

**Features:**
- 2-minute cache (staleTime)
- Auto-refresh every 5 minutes (refetchInterval)
- Genre filtering support

### useRising

Rising artists hook.

```typescript
const { data, isLoading } = useRising(10);
const rising = data?.rising || [];
```

**Features:**
- 5-minute cache
- Auto-refresh every 10 minutes

### useRecommendations

Personalized recommendations.

```typescript
const { data, isLoading } = useRecommendations(userAddress, 20);
const recommendations = data?.recommendations || [];
```

**Features:**
- 10-minute cache
- Requires user address
- Returns recommendation reasons

### useDiscoverFeed

Complete discovery feed.

```typescript
const { data, isLoading } = useDiscoverFeed(
  userAddress,
  'balanced', // mode: 'conservative' | 'balanced' | 'adventurous'
  30
);
const discover = data?.discover || [];
```

**Features:**
- 5-minute cache
- Auto-refresh every 10 minutes
- Respects discovery mode preference

### useRecordListen

Track listening events for recommendations.

```typescript
const recordListen = useRecordListen();

const handlePlay = async (song) => {
  await recordListen.mutateAsync({
    listenerAddress: userAddress,
    songId: song.id,
    artistAddress: song.artist_address,
    genre: song.genre,
    strategy: song.strategy,
    playDuration: 187, // seconds
    completed: true,
    skipped: false,
    liked: false
  });
};
```

**Features:**
- Automatically invalidates recommendation cache
- Updates discovery feed cache
- Tracks detailed listening metrics

### useUpdatePreferences

Update user discovery preferences.

```typescript
const updatePreferences = useUpdatePreferences();

const handleModeChange = async (mode) => {
  await updatePreferences.mutateAsync({
    userAddress,
    preferences: {
      discovery_mode: mode,
      favorite_genres: ['electronic', 'ambient']
    }
  });
};
```

**Features:**
- Invalidates all recommendation caches
- Updates discovery feed
- Partial updates supported

### Utility Hooks

**useDiscoveryPage**: Combined hook for discovery page
```typescript
const {
  trending,
  rising,
  recommendations,
  genres,
  isLoading,
  isError
} = useDiscoveryPage(userAddress);
```

**useSearchEverything**: Search with suggestions
```typescript
const {
  query,
  setQuery,
  results,
  suggestions,
  isLoading
} = useSearchEverything(userAddress);
```

**useSmartSearch**: Search with history
```typescript
const {
  query,
  setQuery,
  results,
  suggestions,
  recentSearches,
  isLoading
} = useSmartSearch(userAddress);
```

---

## UI Components

### SearchBar

Universal search input with autocomplete dropdown.

**Props:**
```typescript
interface SearchBarProps {
  placeholder?: string;
  userAddress?: string;
  autoFocus?: boolean;
  variant?: 'default' | 'compact';
  onResultClick?: (result: SearchResult) => void;
}
```

**Usage:**
```tsx
import { SearchBar } from '@/components/search/SearchBar';

<SearchBar
  placeholder="Search songs, artists, playlists..."
  userAddress={currentUser}
  autoFocus={true}
  onResultClick={(result) => router.push(`/${result.result_type}/${result.result_id}`)}
/>
```

**Features:**
- Keyboard navigation (Arrow Up/Down, Enter, Escape)
- Click-outside to close dropdown
- Recent searches display
- Search suggestions
- Result icons and images
- Loading states
- Responsive design

### SearchResults

Display search results with filtering.

**Props:**
```typescript
interface SearchResultsProps {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  onLoadMore?: () => void;
}
```

**Features:**
- Type filtering tabs (All, Songs, Artists, Playlists)
- Infinite scroll support
- Empty states
- Loading skeletons

### DiscoveryFeed

Main discovery page component.

**Props:**
```typescript
interface DiscoveryFeedProps {
  userAddress?: string;
}
```

**Usage:**
```tsx
import { DiscoveryFeed } from '@/components/search/DiscoveryFeed';

<DiscoveryFeed userAddress={currentUser} />
```

**Sections:**
1. Recommended For You (personalized)
2. Trending Now (with genre filter)
3. Rising Artists
4. Popular Genres
5. Your Discovery Mix (personalized)

**Features:**
- Discovery mode toggle (conservative/balanced/adventurous)
- Genre filtering for trending
- Responsive grid layouts
- Loading skeletons
- Play button overlays

### AdvancedSearchFilters

Filter panel for advanced search.

**Props:**
```typescript
interface AdvancedSearchFiltersProps {
  filters: AdvancedSearchFilters;
  onFilterChange: (filters: AdvancedSearchFilters) => void;
}
```

**Features:**
- Genre multi-select
- Strategy checkboxes
- Play count range sliders
- Date range pickers
- Sort options
- Reset filters button

---

## Performance Optimization

### Database Optimization

**1. GIN Indexes for Full-Text Search**
- Index size: ~15% of table size
- Search query time: 10-100ms
- Rebuild index periodically: `REINDEX INDEX idx_songs_fts;`

**2. Materialized Views**
- Refresh strategy: Every 5 minutes via cron
- Concurrent refresh to avoid locks: `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trending_songs;`
- Create unique indexes on materialized views for concurrent refresh

**3. Query Optimization**
- Use `EXPLAIN ANALYZE` to check query plans
- Add indexes on foreign keys
- Use `LIMIT` to prevent large result sets
- Implement cursor-based pagination for large datasets

**4. Connection Pooling**
```typescript
// pg Pool configuration
const pool = new Pool({
  max: 20, // maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Frontend Optimization

**1. React Query Caching**
```typescript
// Stale times by data type
- Search results: 30 seconds
- Trending songs: 2 minutes
- Rising artists: 5 minutes
- Recommendations: 10 minutes
- User preferences: Infinity (until invalidated)
```

**2. Debouncing**
- Search input: 300ms debounce
- Filter changes: 500ms debounce
- Prevents excessive API calls

**3. Code Splitting**
```typescript
// Lazy load search components
const SearchResults = lazy(() => import('@/components/search/SearchResults'));
const DiscoveryFeed = lazy(() => import('@/components/search/DiscoveryFeed'));
```

**4. Image Optimization**
- Use Next.js `<Image>` component for cover art
- Implement lazy loading for images
- Provide placeholder images

**5. Virtual Scrolling**
For long result lists (100+ items), use virtual scrolling:
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';
```

### Caching Strategy

**Redis Caching (Future Enhancement)**
```
Cache Key Structure:
- search:{query}:{type} → 30s TTL
- trending:{genre} → 2min TTL
- rising:artists → 5min TTL
- recommendations:{userAddress} → 10min TTL
- discover:{userAddress}:{mode} → 5min TTL
```

### Monitoring

**Key Metrics to Track:**
- Search query latency (p50, p95, p99)
- Cache hit rate
- Trending view refresh time
- Recommendation generation time
- API error rate
- Database connection pool usage

**Example Monitoring Query:**
```sql
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%search%'
ORDER BY mean_exec_time DESC
LIMIT 20;
```

---

## Best Practices

### For Backend Developers

**1. Search Query Validation**
```typescript
// Always validate and sanitize search queries
const query = req.query.q?.toString().trim();
if (!query || query.length < 2) {
  return res.status(400).json({ error: 'Query must be at least 2 characters' });
}
```

**2. Parameterized Queries**
```typescript
// ALWAYS use parameterized queries to prevent SQL injection
const result = await pool.query(
  'SELECT * FROM search_all($1, $2, $3)',
  [searchQuery, userAddress, limit]
);

// NEVER concatenate user input
// BAD: `SELECT * FROM songs WHERE title LIKE '%${query}%'`
```

**3. Rate Limiting**
```typescript
// Implement rate limiting on search endpoints
import rateLimit from 'express-rate-limit';

const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many search requests'
});

app.use('/api/search', searchLimiter);
```

**4. Error Handling**
```typescript
try {
  const result = await pool.query('SELECT * FROM mv_trending_songs LIMIT $1', [limit]);
  res.json({ trending: result.rows });
} catch (error) {
  console.error('Trending query failed:', error);
  res.status(500).json({
    error: 'Failed to fetch trending songs',
    code: 'TRENDING_FETCH_ERROR'
  });
}
```

**5. Materialized View Maintenance**
```sql
-- Create cron job to refresh views
SELECT cron.schedule(
  'refresh-trending',
  '*/5 * * * *', -- every 5 minutes
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trending_songs$$
);
```

### For Frontend Developers

**1. Debounce Search Input**
```typescript
// Always debounce search to avoid excessive API calls
const debouncedSearch = useMemo(
  () => debounce((value: string) => setQuery(value), 300),
  []
);
```

**2. Handle Loading States**
```typescript
// Show loading indicators for better UX
if (isLoading) return <SearchSkeleton />;
if (isError) return <ErrorMessage error={error} />;
if (!results.length) return <EmptyState />;
```

**3. Keyboard Navigation**
```typescript
// Implement keyboard shortcuts for search
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === '/' && !isSearchFocused) {
      e.preventDefault();
      searchInputRef.current?.focus();
    }
  };
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

**4. Optimistic Updates**
```typescript
// Update UI immediately, rollback on error
const recordListen = useRecordListen();

const handlePlay = async (song) => {
  // Optimistically update play count
  queryClient.setQueryData(['song', song.id], (old) => ({
    ...old,
    play_count: old.play_count + 1
  }));

  try {
    await recordListen.mutateAsync({ songId: song.id, ... });
  } catch (error) {
    // Rollback on error
    queryClient.invalidateQueries(['song', song.id]);
  }
};
```

**5. Cache Invalidation**
```typescript
// Invalidate related caches after mutations
onSuccess: (_, variables) => {
  queryClient.invalidateQueries({ queryKey: ['recommendations', variables.userAddress] });
  queryClient.invalidateQueries({ queryKey: ['discover-feed', variables.userAddress] });
}
```

### For Data Scientists / ML Engineers

**1. Recommendation Algorithm Tuning**
- Monitor click-through rates (CTR) for recommendations
- A/B test different weighting formulas
- Track skip rates to identify poor recommendations
- Implement feedback loops (likes improve future recommendations)

**2. Similarity Scoring**
```sql
-- Pre-compute similarities for popular songs
INSERT INTO song_similarities (song_id_a, song_id_b, similarity_score, similarity_type)
SELECT
  s1.song_id,
  s2.song_id,
  (
    CASE WHEN s1.genre = s2.genre THEN 0.5 ELSE 0 END +
    CASE WHEN s1.artist_address = s2.artist_address THEN 0.3 ELSE 0 END +
    -- Add more factors...
  ) as similarity_score,
  'content' as similarity_type
FROM songs s1
CROSS JOIN songs s2
WHERE s1.song_id < s2.song_id -- avoid duplicates
  AND s1.play_count > 100 -- only popular songs
HAVING similarity_score > 0.3;
```

**3. Cold Start Problem**
For new users with no listening history:
- Show global trending content
- Ask for genre preferences during onboarding
- Use location-based trending (if available)
- Default to "adventurous" discovery mode

**4. Diversity in Recommendations**
Avoid filter bubbles by ensuring variety:
```sql
-- Ensure at least 30% of recommendations are outside top 3 genres
WITH user_top_genres AS (
  SELECT genre, COUNT(*) as listen_count
  FROM listening_history
  WHERE listener_address = $1
  GROUP BY genre
  ORDER BY listen_count DESC
  LIMIT 3
)
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY (genre IN (SELECT genre FROM user_top_genres)) ORDER BY recommendation_score DESC) as rn
  FROM candidate_recommendations
) WHERE rn <= 7 -- 7 familiar + 3 exploratory
```

### Security Best Practices

**1. Input Sanitization**
```typescript
import validator from 'validator';

const query = validator.escape(req.query.q?.toString() || '');
```

**2. SQL Injection Prevention**
- Always use parameterized queries
- Never concatenate user input into SQL
- Use ORM/query builder when possible

**3. Rate Limiting**
- Implement per-user and per-IP rate limits
- Use exponential backoff for repeated violations

**4. Privacy**
- Allow users to clear search history
- Don't expose other users' listening history
- Anonymize data for analytics

**5. XSS Prevention**
```typescript
// Sanitize content before rendering
import DOMPurify from 'dompurify';

<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />
```

---

## Troubleshooting

### Common Issues

**1. Slow Search Queries**

Problem: Search taking >1 second

Solutions:
- Check GIN index exists: `\d songs` in psql
- Rebuild index: `REINDEX INDEX idx_songs_fts;`
- Check query plan: `EXPLAIN ANALYZE SELECT ...`
- Reduce result limit
- Add covering indexes for frequently sorted columns

**2. Stale Trending Data**

Problem: Trending songs not updating

Solutions:
- Check materialized view refresh: `SELECT * FROM pg_stat_all_tables WHERE relname = 'mv_trending_songs';`
- Manual refresh: `REFRESH MATERIALIZED VIEW mv_trending_songs;`
- Check cron job: `SELECT * FROM cron.job;`
- Verify data freshness: `SELECT MAX(played_at) FROM listening_history;`

**3. Empty Recommendations**

Problem: User gets no recommendations

Solutions:
- Check listening history exists: `SELECT COUNT(*) FROM listening_history WHERE listener_address = $1;`
- Verify user preferences: `SELECT * FROM user_preferences WHERE user_address = $1;`
- Fallback to trending: Show global trending if <10 plays in history
- Check discovery mode: Try "adventurous" mode for more results

**4. High Database CPU**

Problem: PostgreSQL using >80% CPU

Solutions:
- Check long-running queries: `SELECT pid, query, state, query_start FROM pg_stat_activity WHERE state = 'active';`
- Kill slow queries: `SELECT pg_terminate_backend(pid);`
- Increase connection pool size
- Add missing indexes
- Schedule heavy materialized view refreshes during off-peak hours

---

## Future Enhancements

### Phase 1 (Next 2-4 weeks)
- [ ] Collaborative filtering using matrix factorization
- [ ] User feedback collection (thumbs up/down on recommendations)
- [ ] Search filters in autocomplete dropdown
- [ ] Voice search support

### Phase 2 (1-2 months)
- [ ] Machine learning models for recommendations (TensorFlow.js)
- [ ] Real-time search using Elasticsearch
- [ ] Playlist radio (endless play from seed song/playlist)
- [ ] "Users also searched for" suggestions

### Phase 3 (2-3 months)
- [ ] Social search (see what friends are listening to)
- [ ] Smart playlists (auto-updating based on criteria)
- [ ] Search analytics dashboard for artists
- [ ] Multi-language search support

### Phase 4 (3-6 months)
- [ ] Audio fingerprinting for duplicate detection
- [ ] Mood-based discovery ("energetic", "chill", "focus")
- [ ] Time-based recommendations (morning vs evening)
- [ ] Genre blending (discover music between two genres)

---

## Conclusion

The Search & Discovery system provides a comprehensive, performant foundation for music discovery on the Mycelix Music platform. By combining full-text search, intelligent recommendations, and real-time trending data, users can easily find both familiar and new music tailored to their tastes.

**Key Strengths:**
- ⚡ Fast: Sub-100ms search with GIN indexes
- 🎯 Personalized: Multi-factor recommendation algorithm
- 📈 Real-time: Auto-refreshing trending data
- 🔧 Maintainable: Well-documented API and hooks
- 🎨 User-friendly: Intuitive UI components

**Metrics to Track:**
- Search-to-play conversion rate
- Recommendation click-through rate
- Average session duration after discovery
- User retention impact

For questions or support, contact the development team or consult the API documentation at `/api/docs`.

---

**Document Version:** 1.0
**Last Updated:** November 15, 2025
**Contributors:** Claude Development Team
**License:** MIT
