/**
 * Social Features Hooks
 * React hooks for following, comments, playlists, profiles
 */

import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';

// ============================================================================
// TYPES
// ============================================================================

export interface Follow {
  id: number;
  follower_address: string;
  artist_address: string;
  followed_at: string;
  notifications_enabled: boolean;
}

export interface Follower {
  follower_address: string;
  followed_at: string;
  display_name?: string;
  avatar_url?: string;
}

export interface Comment {
  id: number;
  song_id: string;
  commenter_address: string;
  parent_comment_id?: number;
  content: string;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
  commenter_name?: string;
  commenter_avatar?: string;
  like_count: number;
  reply_count: number;
}

export interface Playlist {
  id: number;
  playlist_id: string;
  owner_address: string;
  name: string;
  description?: string;
  is_public: boolean;
  is_collaborative: boolean;
  cover_image_url?: string;
  created_at: string;
  updated_at: string;
  owner_name?: string;
  owner_avatar?: string;
  follower_count?: number;
  song_count?: number;
}

export interface PlaylistSong {
  song_id: string;
  position: number;
  added_at: string;
  added_by_address: string;
  title: string;
  artist_address: string;
  artist_name: string;
  added_by_name?: string;
}

export interface UserProfile {
  id: number;
  wallet_address: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  banner_url?: string;
  website_url?: string;
  twitter_handle?: string;
  instagram_handle?: string;
  spotify_url?: string;
  location?: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityFeedItem {
  id: number;
  actor_address: string;
  activity_type: string;
  target_type: string;
  target_id: string;
  metadata: any;
  created_at: string;
}

export interface Notification {
  id: number;
  recipient_address: string;
  notification_type: string;
  title: string;
  message: string;
  action_url?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  metadata?: any;
}

// ============================================================================
// API CLIENT
// ============================================================================

class SocialAPI {
  private baseUrl = '/api/social';

  // Following
  async followArtist(followerAddress: string, artistAddress: string, notificationsEnabled = true) {
    const res = await fetch(`${this.baseUrl}/follow/${artistAddress}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followerAddress, notificationsEnabled }),
    });
    if (!res.ok) throw new Error('Failed to follow artist');
    return res.json();
  }

  async unfollowArtist(followerAddress: string, artistAddress: string) {
    const res = await fetch(
      `${this.baseUrl}/follow/${artistAddress}?followerAddress=${followerAddress}`,
      { method: 'DELETE' }
    );
    if (!res.ok) throw new Error('Failed to unfollow artist');
    return res.json();
  }

  async getFollowers(artistAddress: string, limit = 50, offset = 0) {
    const res = await fetch(
      `${this.baseUrl}/followers/${artistAddress}?limit=${limit}&offset=${offset}`
    );
    if (!res.ok) throw new Error('Failed to fetch followers');
    return res.json();
  }

  async getFollowing(userAddress: string) {
    const res = await fetch(`${this.baseUrl}/following/${userAddress}`);
    if (!res.ok) throw new Error('Failed to fetch following');
    return res.json();
  }

  // Comments
  async postComment(songId: string, commenterAddress: string, content: string, parentCommentId?: number) {
    const res = await fetch(`${this.baseUrl}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId, commenterAddress, content, parentCommentId }),
    });
    if (!res.ok) throw new Error('Failed to post comment');
    return res.json();
  }

  async getComments(songId: string, limit = 50, offset = 0) {
    const res = await fetch(
      `${this.baseUrl}/comments/${songId}?limit=${limit}&offset=${offset}`
    );
    if (!res.ok) throw new Error('Failed to fetch comments');
    return res.json();
  }

  async getReplies(commentId: number) {
    const res = await fetch(`${this.baseUrl}/comments/${commentId}/replies`);
    if (!res.ok) throw new Error('Failed to fetch replies');
    return res.json();
  }

  async likeComment(commentId: number, likerAddress: string, reactionType = 'like') {
    const res = await fetch(`${this.baseUrl}/comments/${commentId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ likerAddress, reactionType }),
    });
    if (!res.ok) throw new Error('Failed to like comment');
    return res.json();
  }

  async unlikeComment(commentId: number, likerAddress: string) {
    const res = await fetch(
      `${this.baseUrl}/comments/${commentId}/like?likerAddress=${likerAddress}`,
      { method: 'DELETE' }
    );
    if (!res.ok) throw new Error('Failed to unlike comment');
    return res.json();
  }

  async deleteComment(commentId: number, commenterAddress: string) {
    const res = await fetch(
      `${this.baseUrl}/comments/${commentId}?commenterAddress=${commenterAddress}`,
      { method: 'DELETE' }
    );
    if (!res.ok) throw new Error('Failed to delete comment');
    return res.json();
  }

  // Playlists
  async createPlaylist(
    ownerAddress: string,
    name: string,
    description?: string,
    isPublic = true,
    isCollaborative = false
  ) {
    const res = await fetch(`${this.baseUrl}/playlists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerAddress, name, description, isPublic, isCollaborative }),
    });
    if (!res.ok) throw new Error('Failed to create playlist');
    return res.json();
  }

  async getPlaylist(playlistId: string) {
    const res = await fetch(`${this.baseUrl}/playlists/${playlistId}`);
    if (!res.ok) throw new Error('Failed to fetch playlist');
    return res.json();
  }

  async getUserPlaylists(userAddress: string) {
    const res = await fetch(`${this.baseUrl}/playlists/user/${userAddress}`);
    if (!res.ok) throw new Error('Failed to fetch user playlists');
    return res.json();
  }

  async addSongToPlaylist(playlistId: string, songId: string, addedByAddress: string) {
    const res = await fetch(`${this.baseUrl}/playlists/${playlistId}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId, addedByAddress }),
    });
    if (!res.ok) throw new Error('Failed to add song to playlist');
    return res.json();
  }

  async removeSongFromPlaylist(playlistId: string, songId: string) {
    const res = await fetch(`${this.baseUrl}/playlists/${playlistId}/songs/${songId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to remove song from playlist');
    return res.json();
  }

  // Profiles
  async getProfile(walletAddress: string) {
    const res = await fetch(`${this.baseUrl}/profile/${walletAddress}`);
    if (!res.ok) throw new Error('Failed to fetch profile');
    return res.json();
  }

  async updateProfile(walletAddress: string, updates: Partial<UserProfile>) {
    const res = await fetch(`${this.baseUrl}/profile/${walletAddress}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return res.json();
  }

  // Activity Feed
  async getFeed(userAddress: string, limit = 50, offset = 0) {
    const res = await fetch(
      `${this.baseUrl}/feed/${userAddress}?limit=${limit}&offset=${offset}`
    );
    if (!res.ok) throw new Error('Failed to fetch feed');
    return res.json();
  }

  // Notifications
  async getNotifications(userAddress: string, unreadOnly = false) {
    const res = await fetch(
      `${this.baseUrl}/notifications/${userAddress}?unreadOnly=${unreadOnly}`
    );
    if (!res.ok) throw new Error('Failed to fetch notifications');
    return res.json();
  }

  async markNotificationAsRead(notificationId: number) {
    const res = await fetch(`${this.baseUrl}/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
    if (!res.ok) throw new Error('Failed to mark notification as read');
    return res.json();
  }
}

const api = new SocialAPI();

// ============================================================================
// FOLLOWING HOOKS
// ============================================================================

export function useFollowArtist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ followerAddress, artistAddress, notificationsEnabled }: {
      followerAddress: string;
      artistAddress: string;
      notificationsEnabled?: boolean;
    }) => api.followArtist(followerAddress, artistAddress, notificationsEnabled),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['followers', variables.artistAddress] });
      queryClient.invalidateQueries({ queryKey: ['following', variables.followerAddress] });
      queryClient.invalidateQueries({ queryKey: ['artist-social-stats', variables.artistAddress] });
    },
  });
}

export function useUnfollowArtist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ followerAddress, artistAddress }: {
      followerAddress: string;
      artistAddress: string;
    }) => api.unfollowArtist(followerAddress, artistAddress),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['followers', variables.artistAddress] });
      queryClient.invalidateQueries({ queryKey: ['following', variables.followerAddress] });
      queryClient.invalidateQueries({ queryKey: ['artist-social-stats', variables.artistAddress] });
    },
  });
}

export function useFollowers(artistAddress: string | undefined, limit = 50, offset = 0) {
  return useQuery({
    queryKey: ['followers', artistAddress, limit, offset],
    queryFn: () => api.getFollowers(artistAddress!, limit, offset),
    enabled: !!artistAddress,
    staleTime: 60000, // 1 minute
  });
}

export function useFollowing(userAddress: string | undefined) {
  return useQuery({
    queryKey: ['following', userAddress],
    queryFn: () => api.getFollowing(userAddress!),
    enabled: !!userAddress,
    staleTime: 60000,
  });
}

// ============================================================================
// COMMENTS HOOKS
// ============================================================================

export function usePostComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ songId, commenterAddress, content, parentCommentId }: {
      songId: string;
      commenterAddress: string;
      content: string;
      parentCommentId?: number;
    }) => api.postComment(songId, commenterAddress, content, parentCommentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.songId] });
      if (variables.parentCommentId) {
        queryClient.invalidateQueries({ queryKey: ['replies', variables.parentCommentId] });
      }
      queryClient.invalidateQueries({ queryKey: ['song-engagement', variables.songId] });
    },
  });
}

export function useComments(songId: string | undefined, limit = 50, offset = 0) {
  return useQuery({
    queryKey: ['comments', songId, limit, offset],
    queryFn: () => api.getComments(songId!, limit, offset),
    enabled: !!songId,
    staleTime: 30000, // 30 seconds
  });
}

export function useReplies(commentId: number | undefined) {
  return useQuery({
    queryKey: ['replies', commentId],
    queryFn: () => api.getReplies(commentId!),
    enabled: !!commentId,
    staleTime: 30000,
  });
}

export function useLikeComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, likerAddress, reactionType }: {
      commentId: number;
      likerAddress: string;
      reactionType?: string;
    }) => api.likeComment(commentId, likerAddress, reactionType),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      queryClient.invalidateQueries({ queryKey: ['replies'] });
    },
  });
}

export function useUnlikeComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, likerAddress }: {
      commentId: number;
      likerAddress: string;
    }) => api.unlikeComment(commentId, likerAddress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      queryClient.invalidateQueries({ queryKey: ['replies'] });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, commenterAddress }: {
      commentId: number;
      commenterAddress: string;
    }) => api.deleteComment(commentId, commenterAddress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}

// ============================================================================
// PLAYLISTS HOOKS
// ============================================================================

export function useCreatePlaylist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ownerAddress, name, description, isPublic, isCollaborative }: {
      ownerAddress: string;
      name: string;
      description?: string;
      isPublic?: boolean;
      isCollaborative?: boolean;
    }) => api.createPlaylist(ownerAddress, name, description, isPublic, isCollaborative),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-playlists', variables.ownerAddress] });
    },
  });
}

export function usePlaylist(playlistId: string | undefined): UseQueryResult<{
  playlist: Playlist;
  songs: PlaylistSong[];
}> {
  return useQuery({
    queryKey: ['playlist', playlistId],
    queryFn: () => api.getPlaylist(playlistId!),
    enabled: !!playlistId,
    staleTime: 60000,
  });
}

export function useUserPlaylists(userAddress: string | undefined) {
  return useQuery({
    queryKey: ['user-playlists', userAddress],
    queryFn: () => api.getUserPlaylists(userAddress!),
    enabled: !!userAddress,
    staleTime: 60000,
  });
}

export function useAddSongToPlaylist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ playlistId, songId, addedByAddress }: {
      playlistId: string;
      songId: string;
      addedByAddress: string;
    }) => api.addSongToPlaylist(playlistId, songId, addedByAddress),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['playlist', variables.playlistId] });
      queryClient.invalidateQueries({ queryKey: ['user-playlists'] });
    },
  });
}

export function useRemoveSongFromPlaylist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ playlistId, songId }: {
      playlistId: string;
      songId: string;
    }) => api.removeSongFromPlaylist(playlistId, songId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['playlist', variables.playlistId] });
    },
  });
}

// ============================================================================
// PROFILE HOOKS
// ============================================================================

export function useUserProfile(walletAddress: string | undefined): UseQueryResult<{ profile: UserProfile }> {
  return useQuery({
    queryKey: ['user-profile', walletAddress],
    queryFn: () => api.getProfile(walletAddress!),
    enabled: !!walletAddress,
    staleTime: 300000, // 5 minutes
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ walletAddress, updates }: {
      walletAddress: string;
      updates: Partial<UserProfile>;
    }) => api.updateProfile(walletAddress, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-profile', variables.walletAddress] });
    },
  });
}

// ============================================================================
// ACTIVITY FEED HOOKS
// ============================================================================

export function useActivityFeed(userAddress: string | undefined, limit = 50, offset = 0) {
  return useQuery({
    queryKey: ['activity-feed', userAddress, limit, offset],
    queryFn: () => api.getFeed(userAddress!, limit, offset),
    enabled: !!userAddress,
    staleTime: 30000,
    refetchInterval: 60000, // Auto-refresh every minute
  });
}

// ============================================================================
// NOTIFICATIONS HOOKS
// ============================================================================

export function useNotifications(userAddress: string | undefined, unreadOnly = false) {
  return useQuery({
    queryKey: ['notifications', userAddress, unreadOnly],
    queryFn: () => api.getNotifications(userAddress!, unreadOnly),
    enabled: !!userAddress,
    staleTime: 30000,
    refetchInterval: 60000, // Auto-refresh every minute
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: number) => api.markNotificationAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
