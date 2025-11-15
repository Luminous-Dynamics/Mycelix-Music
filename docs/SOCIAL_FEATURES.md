# 🎵 Social Features Guide

Complete guide to social features in Mycelix Music - building a vibrant music community.

## Table of Contents

1. [Overview](#overview)
2. [Following System](#following-system)
3. [Comments & Reactions](#comments--reactions)
4. [Playlists](#playlists)
5. [User Profiles](#user-profiles)
6. [Activity Feed](#activity-feed)
7. [Notifications](#notifications)
8. [API Reference](#api-reference)
9. [React Components](#react-components)
10. [Database Schema](#database-schema)

---

## Overview

Mycelix Music's social features transform the platform into a vibrant community where artists and listeners connect, interact, and discover music together.

### Key Features

- **Following System** - Follow favorite artists and get updates
- **Comments & Reactions** - Discuss songs with the community
- **Playlists** - Create and share custom playlists
- **User Profiles** - Customizable profiles with social links
- **Activity Feed** - Personalized feed of followed activity
- **Notifications** - Stay updated on new releases and interactions

### Technology Stack

- **Backend**: PostgreSQL, Express.js
- **Frontend**: React, React Query, TypeScript
- **Real-time**: Webhook-based notifications
- **Caching**: React Query with smart invalidation

---

## Following System

### Overview

Users can follow their favorite artists to get updates on new releases, activity, and build connections.

### Features

- **Follow/Unfollow** artists
- **Follower counts** and lists
- **Notification preferences** per artist
- **Follower/Following lists**
- **New follower notifications**

### Database Schema

```sql
CREATE TABLE artist_followers (
    id BIGSERIAL PRIMARY KEY,
    follower_address VARCHAR(42) NOT NULL,
    artist_address VARCHAR(42) NOT NULL,
    followed_at TIMESTAMPTZ DEFAULT NOW(),
    notifications_enabled BOOLEAN DEFAULT TRUE,
    UNIQUE(follower_address, artist_address)
);
```

### API Endpoints

#### Follow an Artist

```http
POST /api/social/follow/:artistAddress
Content-Type: application/json

{
  "followerAddress": "0x...",
  "notificationsEnabled": true
}
```

**Response**:
```json
{
  "success": true,
  "follow": {
    "id": 123,
    "followed_at": "2025-11-15T10:00:00Z"
  }
}
```

#### Unfollow an Artist

```http
DELETE /api/social/follow/:artistAddress?followerAddress=0x...
```

#### Get Artist Followers

```http
GET /api/social/followers/:artistAddress?limit=50&offset=0
```

**Response**:
```json
{
  "followers": [
    {
      "follower_address": "0x...",
      "followed_at": "2025-11-15T10:00:00Z",
      "display_name": "Music Lover",
      "avatar_url": "https://..."
    }
  ],
  "total": 1234,
  "limit": 50,
  "offset": 0
}
```

#### Get User's Following List

```http
GET /api/social/following/:userAddress
```

### React Hooks

```typescript
import { useFollowArtist, useUnfollowArtist, useFollowers, useFollowing } from '@/hooks/useSocial';

// Follow an artist
const followArtist = useFollowArtist();
await followArtist.mutateAsync({
  followerAddress: '0x...',
  artistAddress: '0x...',
  notificationsEnabled: true,
});

// Get followers
const { data, isLoading } = useFollowers('0x...');
console.log(data.followers);

// Get following
const { data } = useFollowing('0x...');
console.log(data.following);
```

### UI Components

```typescript
import { FollowButton, FollowerList } from '@/components/social/FollowButton';

// Follow button
<FollowButton
  artistAddress="0x..."
  currentUserAddress="0x..."
  variant="default"  // or "compact"
  showCount={true}
  followerCount={1234}
/>

// Follower list
<FollowerList artistAddress="0x..." />
```

---

## Comments & Reactions

### Overview

Rich commenting system with nested replies, reactions, and moderation.

### Features

- **Top-level comments** on songs
- **Threaded replies** to comments
- **Like/React** to comments (like, love, fire, laugh)
- **Edit history** tracking
- **Soft delete** for moderation
- **Comment counts** and engagement metrics

### Database Schema

```sql
CREATE TABLE song_comments (
    id BIGSERIAL PRIMARY KEY,
    song_id VARCHAR(255) NOT NULL,
    commenter_address VARCHAR(42) NOT NULL,
    parent_comment_id BIGINT REFERENCES song_comments(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    CHECK (LENGTH(content) <= 5000)
);

CREATE TABLE comment_likes (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT REFERENCES song_comments(id),
    liker_address VARCHAR(42) NOT NULL,
    reaction_type VARCHAR(20) DEFAULT 'like',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, liker_address)
);
```

### API Endpoints

#### Post a Comment

```http
POST /api/social/comments
Content-Type: application/json

{
  "songId": "song-123",
  "commenterAddress": "0x...",
  "content": "Great song!",
  "parentCommentId": null  // or number for reply
}
```

#### Get Comments for a Song

```http
GET /api/social/comments/:songId?limit=50&offset=0
```

**Response**:
```json
{
  "comments": [
    {
      "id": 1,
      "song_id": "song-123",
      "commenter_address": "0x...",
      "content": "Amazing track!",
      "created_at": "2025-11-15T10:00:00Z",
      "commenter_name": "Music Fan",
      "commenter_avatar": "https://...",
      "like_count": 42,
      "reply_count": 3
    }
  ],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

#### Get Replies to a Comment

```http
GET /api/social/comments/:commentId/replies
```

#### Like a Comment

```http
POST /api/social/comments/:commentId/like
Content-Type: application/json

{
  "likerAddress": "0x...",
  "reactionType": "like"  // like, love, fire, laugh
}
```

#### Unlike a Comment

```http
DELETE /api/social/comments/:commentId/like?likerAddress=0x...
```

#### Delete a Comment

```http
DELETE /api/social/comments/:commentId?commenterAddress=0x...
```

### React Hooks

```typescript
import {
  useComments,
  usePostComment,
  useLikeComment,
  useUnlikeComment,
  useReplies,
} from '@/hooks/useSocial';

// Get comments
const { data, isLoading } = useComments('song-123');

// Post comment
const postComment = usePostComment();
await postComment.mutateAsync({
  songId: 'song-123',
  commenterAddress: '0x...',
  content: 'Great song!',
});

// Like comment
const likeComment = useLikeComment();
await likeComment.mutateAsync({
  commentId: 1,
  likerAddress: '0x...',
  reactionType: 'like',
});

// Get replies
const { data: replies } = useReplies(commentId);
```

### UI Components

```typescript
import { CommentSection } from '@/components/social/CommentSection';

<CommentSection
  songId="song-123"
  currentUserAddress="0x..."
/>
```

**Features**:
- Comment form with character counter
- Threaded replies
- Like/react buttons
- Delete for comment owners
- Loading states
- Dark mode support

---

## Playlists

### Overview

User-created playlists with collaborative features and sharing.

### Features

- **Create playlists** with custom names/descriptions
- **Public/Private** visibility
- **Collaborative** playlists (others can add songs)
- **Ordered song lists** with positions
- **Playlist followers**
- **Cover images**
- **Share playlists**

### Database Schema

```sql
CREATE TABLE playlists (
    id BIGSERIAL PRIMARY KEY,
    playlist_id VARCHAR(255) UNIQUE NOT NULL,
    owner_address VARCHAR(42) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    is_collaborative BOOLEAN DEFAULT FALSE,
    cover_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE playlist_songs (
    id BIGSERIAL PRIMARY KEY,
    playlist_id VARCHAR(255) REFERENCES playlists(playlist_id),
    song_id VARCHAR(255) NOT NULL,
    added_by_address VARCHAR(42) NOT NULL,
    position INTEGER NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(playlist_id, position)
);
```

### API Endpoints

#### Create a Playlist

```http
POST /api/social/playlists
Content-Type: application/json

{
  "ownerAddress": "0x...",
  "name": "My Favorite Tracks",
  "description": "The best songs ever",
  "isPublic": true,
  "isCollaborative": false
}
```

**Response**:
```json
{
  "success": true,
  "playlist": {
    "playlist_id": "playlist-1234567890",
    "name": "My Favorite Tracks",
    "owner_address": "0x...",
    "created_at": "2025-11-15T10:00:00Z"
  }
}
```

#### Get a Playlist

```http
GET /api/social/playlists/:playlistId
```

**Response**:
```json
{
  "playlist": {
    "playlist_id": "playlist-123",
    "name": "My Favorites",
    "owner_address": "0x...",
    "is_public": true,
    "song_count": 25,
    "follower_count": 10
  },
  "songs": [
    {
      "song_id": "song-1",
      "title": "Amazing Song",
      "artist_name": "Great Artist",
      "position": 0,
      "added_at": "2025-11-15T10:00:00Z"
    }
  ]
}
```

#### Get User's Playlists

```http
GET /api/social/playlists/user/:userAddress
```

#### Add Song to Playlist

```http
POST /api/social/playlists/:playlistId/songs
Content-Type: application/json

{
  "songId": "song-123",
  "addedByAddress": "0x..."
}
```

#### Remove Song from Playlist

```http
DELETE /api/social/playlists/:playlistId/songs/:songId
```

### React Hooks

```typescript
import {
  usePlaylist,
  useUserPlaylists,
  useCreatePlaylist,
  useAddSongToPlaylist,
  useRemoveSongFromPlaylist,
} from '@/hooks/useSocial';

// Get playlist
const { data, isLoading } = usePlaylist('playlist-123');

// Create playlist
const createPlaylist = useCreatePlaylist();
await createPlaylist.mutateAsync({
  ownerAddress: '0x...',
  name: 'My Playlist',
  description: 'Cool songs',
  isPublic: true,
});

// Add song
const addSong = useAddSongToPlaylist();
await addSong.mutateAsync({
  playlistId: 'playlist-123',
  songId: 'song-456',
  addedByAddress: '0x...',
});
```

### UI Components

```typescript
import {
  PlaylistCard,
  PlaylistView,
  UserPlaylistsGrid,
  CreatePlaylistModal,
} from '@/components/social/PlaylistCard';

// Playlist card
<PlaylistCard
  playlist={playlist}
  onClick={() => navigate(`/playlist/${playlist.playlist_id}`)}
/>

// Full playlist view
<PlaylistView
  playlistId="playlist-123"
  currentUserAddress="0x..."
/>

// User's playlists grid
<UserPlaylistsGrid userAddress="0x..." />

// Create playlist modal
<CreatePlaylistModal
  isOpen={true}
  onClose={() => setShowModal(false)}
  currentUserAddress="0x..."
/>
```

---

## User Profiles

### Overview

Extended user profiles with social links and customizable information.

### Features

- **Display name** and bio
- **Avatar** and banner images
- **Social links** (Twitter, Instagram, Spotify, website)
- **Location**
- **Auto-creation** on first access

### Database Schema

```sql
CREATE TABLE user_profiles (
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
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Endpoints

#### Get User Profile

```http
GET /api/social/profile/:walletAddress
```

**Response**:
```json
{
  "profile": {
    "wallet_address": "0x...",
    "display_name": "Music Lover",
    "bio": "I love discovering new music!",
    "avatar_url": "https://...",
    "twitter_handle": "musiclover",
    "location": "New York, NY"
  }
}
```

#### Update User Profile

```http
PUT /api/social/profile/:walletAddress
Content-Type: application/json

{
  "displayName": "New Name",
  "bio": "Updated bio",
  "avatarUrl": "https://...",
  "twitterHandle": "myhandle"
}
```

### React Hooks

```typescript
import { useUserProfile, useUpdateProfile } from '@/hooks/useSocial';

// Get profile
const { data, isLoading } = useUserProfile('0x...');

// Update profile
const updateProfile = useUpdateProfile();
await updateProfile.mutateAsync({
  walletAddress: '0x...',
  updates: {
    displayName: 'New Name',
    bio: 'My new bio',
  },
});
```

---

## Activity Feed

### Overview

Personalized activity feed showing actions from followed artists.

### Features

- **Personalized feed** based on following
- **Activity types**: play, comment, follow, release
- **Metadata** for rich context
- **Pagination** support
- **Real-time** updates

### Database Schema

```sql
CREATE TABLE activity_feed (
    id BIGSERIAL PRIMARY KEY,
    actor_address VARCHAR(42) NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Endpoints

#### Get User's Feed

```http
GET /api/social/feed/:userAddress?limit=50&offset=0
```

**Response**:
```json
{
  "feed": [
    {
      "id": 1,
      "actor_address": "0x...",
      "activity_type": "release",
      "target_type": "song",
      "target_id": "song-123",
      "metadata": {
        "title": "New Song",
        "genre": "Electronic"
      },
      "created_at": "2025-11-15T10:00:00Z"
    }
  ],
  "limit": 50,
  "offset": 0
}
```

### React Hooks

```typescript
import { useActivityFeed } from '@/hooks/useSocial';

const { data, isLoading } = useActivityFeed('0x...', 50, 0);

// Auto-refreshes every 60 seconds
```

### Activity Types

- `play` - User played a song
- `comment` - User commented on a song
- `follow` - User followed an artist
- `release` - Artist released a new song
- `playlist_create` - User created a playlist
- `playlist_add` - User added song to playlist

---

## Notifications

### Overview

Real-time notifications for social events.

### Features

- **New follower** notifications
- **New comment** on your songs
- **New release** from followed artists
- **Unread** badge
- **Mark as read**
- **Notification preferences**

### Database Schema

```sql
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    recipient_address VARCHAR(42) NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);
```

### API Endpoints

#### Get Notifications

```http
GET /api/social/notifications/:userAddress?unreadOnly=false
```

**Response**:
```json
{
  "notifications": [
    {
      "id": 1,
      "notification_type": "new_follower",
      "title": "New Follower",
      "message": "You have a new follower!",
      "is_read": false,
      "created_at": "2025-11-15T10:00:00Z"
    }
  ]
}
```

#### Mark as Read

```http
PUT /api/social/notifications/:notificationId/read
```

### React Hooks

```typescript
import { useNotifications, useMarkNotificationAsRead } from '@/hooks/useSocial';

// Get notifications
const { data } = useNotifications('0x...', false);

// Get unread only
const { data: unread } = useNotifications('0x...', true);

// Mark as read
const markAsRead = useMarkNotificationAsRead();
await markAsRead.mutateAsync(notificationId);
```

### Notification Types

- `new_follower` - Someone followed you
- `new_comment` - Comment on your song
- `new_release` - Followed artist released song
- `comment_reply` - Reply to your comment
- `comment_like` - Someone liked your comment

---

## Performance & Optimization

### Materialized Views

```sql
-- Artist social stats (refreshed hourly)
CREATE MATERIALIZED VIEW mv_artist_social_stats AS
SELECT
    artist_address,
    COUNT(DISTINCT follower_address) as follower_count,
    COUNT(DISTINCT comment_id) as total_comments_received,
    MAX(followed_at) as last_new_follower
FROM artist_followers
GROUP BY artist_address;

-- Song engagement (refreshed hourly)
CREATE MATERIALIZED VIEW mv_song_engagement AS
SELECT
    song_id,
    COUNT(DISTINCT comment_id) as comment_count,
    COUNT(DISTINCT liker_address) as total_likes,
    COUNT(DISTINCT playlist_id) as playlist_adds
FROM song_comments
GROUP BY song_id;
```

### Indexing Strategy

- **Following**: Indexed on both follower and artist
- **Comments**: Indexed on song_id and created_at
- **Playlists**: Indexed on owner and public status
- **Activity**: Indexed on actor and created_at
- **Notifications**: Partial index on unread

### Caching Strategy

- **React Query**: 30-60 second stale times
- **Auto-refresh**: Activity feed and notifications
- **Optimistic updates**: Follow/like actions
- **Smart invalidation**: Related queries invalidated

---

## Best Practices

### 1. Always Check Permissions

```typescript
// Check if user owns comment before delete
const isOwner = currentUserAddress === comment.commenter_address;

if (isOwner) {
  // Show delete button
}
```

### 2. Handle Loading States

```typescript
if (isLoading) return <Skeleton />;
if (isError) return <ErrorMessage />;

return <Content data={data} />;
```

### 3. Optimistic Updates

```typescript
const followArtist = useFollowArtist();

// Optimistic UI update
setIsFollowing(true);

try {
  await followArtist.mutateAsync({...});
} catch (error) {
  // Revert on error
  setIsFollowing(false);
}
```

### 4. Validate Input

```typescript
// Client-side
if (content.length > 5000) {
  return 'Comment too long';
}

// Server-side
body('content').isLength({ min: 1, max: 5000 })
```

### 5. Rate Limiting

Implement rate limiting on:
- Comment posting (5 per minute)
- Following (10 per minute)
- Playlist creation (2 per minute)

---

## Security Considerations

### SQL Injection Prevention

- Use parameterized queries
- Validate all inputs
- Sanitize user content

### XSS Prevention

- Escape HTML in comments
- Validate URLs
- Sanitize markdown

### CSRF Protection

- Require authentication
- Verify wallet signatures
- Use CSRF tokens

### Privacy

- Respect private playlists
- Hide deleted content
- Don't expose email addresses

---

## Troubleshooting

### Comments Not Showing

1. Check soft delete flag: `is_deleted = FALSE`
2. Verify parent_comment_id for replies
3. Check pagination limits

### Followers Not Updating

1. Invalidate React Query cache
2. Refresh materialized views
3. Check unique constraints

### Notifications Not Appearing

1. Check notification_enabled flag
2. Verify trigger functions
3. Check notification preferences

---

## Future Enhancements

### Planned Features

- **Direct Messages** between users
- **Mentions** in comments (@username)
- **Hashtags** for discovery
- **Collaborative Filtering** recommendations
- **Playlist Folders** for organization
- **Song Requests** in collaborative playlists
- **User Badges** and achievements
- **Verified Artist** badges

---

## Resources

- [API Routes](../apps/api/src/routes/social.ts)
- [React Hooks](../apps/web/hooks/useSocial.ts)
- [Database Migration](../apps/api/migrations/003_social_features.sql)
- [UI Components](../apps/web/components/social/)

---

**Last Updated**: 2025-11-15
**Version**: 1.0.0
