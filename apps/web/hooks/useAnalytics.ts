/**
 * Analytics Hooks
 * React hooks for fetching analytics data from optimized queries
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useCallback } from 'react';

// Types
export interface ArtistAnalytics {
  artist_address: string;
  artist_name: string;
  total_songs: number;
  total_plays: number;
  unique_listeners: number;
  total_earnings: string;
  avg_earning_per_play: string;
  last_play_date: string | null;
  plays_last_30_days: number;
  plays_last_7_days: number;
  last_refreshed: string;
}

export interface SongAnalytics {
  song_id: string;
  title: string;
  artist_address: string;
  genre: string;
  strategy: string;
  play_count: number;
  unique_listeners: number;
  total_earnings: string;
  avg_play_duration: number;
  avg_earning_per_play: string;
  last_played: string | null;
  first_played: string | null;
  plays_last_7_days: number;
  plays_last_30_days: number;
  trending_score: number;
  last_refreshed: string;
}

export interface PlatformStats {
  total_artists: number;
  total_songs: number;
  total_plays: number;
  total_listeners: number;
  total_volume: string;
  avg_payment: string;
  songs_pay_per_stream: number;
  songs_gift_economy: number;
  songs_patronage: number;
  songs_auction: number;
  plays_last_24h: number;
  plays_last_7d: number;
  plays_last_30d: number;
  new_songs_last_7d: number;
  new_songs_last_30d: number;
  last_refreshed: string;
}

export interface ListenerActivity {
  listener_address: string;
  total_plays: number;
  unique_songs_played: number;
  unique_artists: number;
  total_spent: string;
  avg_spent_per_play: string;
  last_active: string;
  first_active: string;
  favorite_genre: string;
  favorite_strategy: string;
  plays_last_7d: number;
  plays_last_30d: number;
  last_refreshed: string;
}

export interface GenreStats {
  genre: string;
  total_songs: number;
  total_artists: number;
  total_plays: number;
  total_earnings: string;
  avg_earning_per_play: string;
  unique_listeners: number;
  plays_last_7d: number;
  popularity_rank: number;
}

// API Client
class AnalyticsAPI {
  private baseUrl = '/api/analytics';

  async getArtistAnalytics(address: string): Promise<ArtistAnalytics> {
    const res = await fetch(`${this.baseUrl}/artists/${address}`);
    if (!res.ok) throw new Error('Failed to fetch artist analytics');
    return res.json();
  }

  async getTopArtistsByEarnings(
    limit = 10,
    offset = 0
  ): Promise<ArtistAnalytics[]> {
    const res = await fetch(
      `${this.baseUrl}/artists/top?limit=${limit}&offset=${offset}`
    );
    if (!res.ok) throw new Error('Failed to fetch top artists');
    return res.json();
  }

  async getSongAnalytics(songId: string): Promise<SongAnalytics> {
    const res = await fetch(`${this.baseUrl}/songs/${songId}`);
    if (!res.ok) throw new Error('Failed to fetch song analytics');
    return res.json();
  }

  async getTrendingSongs(
    limit = 20,
    genre?: string
  ): Promise<SongAnalytics[]> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (genre) params.append('genre', genre);

    const res = await fetch(`${this.baseUrl}/songs/trending?${params}`);
    if (!res.ok) throw new Error('Failed to fetch trending songs');
    return res.json();
  }

  async getPopularSongs(
    limit = 20,
    strategy?: string
  ): Promise<SongAnalytics[]> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (strategy) params.append('strategy', strategy);

    const res = await fetch(`${this.baseUrl}/songs/popular?${params}`);
    if (!res.ok) throw new Error('Failed to fetch popular songs');
    return res.json();
  }

  async getPlatformStats(): Promise<PlatformStats> {
    const res = await fetch(`${this.baseUrl}/platform`);
    if (!res.ok) throw new Error('Failed to fetch platform stats');
    return res.json();
  }

  async getListenerActivity(address: string): Promise<ListenerActivity> {
    const res = await fetch(`${this.baseUrl}/listeners/${address}`);
    if (!res.ok) throw new Error('Failed to fetch listener activity');
    return res.json();
  }

  async getGenreStats(): Promise<GenreStats[]> {
    const res = await fetch(`${this.baseUrl}/genres`);
    if (!res.ok) throw new Error('Failed to fetch genre stats');
    return res.json();
  }

  async searchSongs(query: string, limit = 20): Promise<SongAnalytics[]> {
    const params = new URLSearchParams({ q: query, limit: limit.toString() });
    const res = await fetch(`${this.baseUrl}/search?${params}`);
    if (!res.ok) throw new Error('Failed to search songs');
    return res.json();
  }
}

const api = new AnalyticsAPI();

// React Query Hooks

/**
 * Get artist analytics
 */
export function useArtistAnalytics(
  address: string | undefined
): UseQueryResult<ArtistAnalytics> {
  return useQuery({
    queryKey: ['artist-analytics', address],
    queryFn: () => api.getArtistAnalytics(address!),
    enabled: !!address,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Get top artists by earnings
 */
export function useTopArtists(limit = 10, offset = 0) {
  return useQuery({
    queryKey: ['top-artists', limit, offset],
    queryFn: () => api.getTopArtistsByEarnings(limit, offset),
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Get song analytics
 */
export function useSongAnalytics(
  songId: string | undefined
): UseQueryResult<SongAnalytics> {
  return useQuery({
    queryKey: ['song-analytics', songId],
    queryFn: () => api.getSongAnalytics(songId!),
    enabled: !!songId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Get trending songs
 */
export function useTrendingSongs(limit = 20, genre?: string) {
  return useQuery({
    queryKey: ['trending-songs', limit, genre],
    queryFn: () => api.getTrendingSongs(limit, genre),
    staleTime: 120000, // 2 minutes
  });
}

/**
 * Get popular songs
 */
export function usePopularSongs(limit = 20, strategy?: string) {
  return useQuery({
    queryKey: ['popular-songs', limit, strategy],
    queryFn: () => api.getPopularSongs(limit, strategy),
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Get platform statistics
 */
export function usePlatformStats(): UseQueryResult<PlatformStats> {
  return useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => api.getPlatformStats(),
    staleTime: 60000, // 1 minute
    refetchInterval: 60000, // Auto-refresh every minute
  });
}

/**
 * Get listener activity
 */
export function useListenerActivity(
  address: string | undefined
): UseQueryResult<ListenerActivity> {
  return useQuery({
    queryKey: ['listener-activity', address],
    queryFn: () => api.getListenerActivity(address!),
    enabled: !!address,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Get genre statistics
 */
export function useGenreStats() {
  return useQuery({
    queryKey: ['genre-stats'],
    queryFn: () => api.getGenreStats(),
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Search songs
 */
export function useSearchSongs(query: string, limit = 20) {
  return useQuery({
    queryKey: ['search-songs', query, limit],
    queryFn: () => api.searchSongs(query, limit),
    enabled: query.length >= 2,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Real-time analytics hook with auto-refresh
 */
export function useRealtimeAnalytics<T>(
  fetchFn: () => Promise<T>,
  refreshInterval = 30000 // 30 seconds
) {
  return useQuery({
    queryKey: ['realtime', fetchFn.name],
    queryFn: fetchFn,
    refetchInterval: refreshInterval,
    staleTime: refreshInterval,
  });
}

/**
 * Custom hook for analytics with caching
 */
export function useAnalyticsWithCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options?: {
    staleTime?: number;
    cacheTime?: number;
    refetchInterval?: number;
  }
) {
  return useQuery({
    queryKey: [key],
    queryFn: fetchFn,
    staleTime: options?.staleTime || 60000,
    gcTime: options?.cacheTime || 300000,
    refetchInterval: options?.refetchInterval,
  });
}

/**
 * Hook for dashboard data (combines multiple queries)
 */
export function useArtistDashboard(address: string | undefined) {
  const analytics = useArtistAnalytics(address);
  const topSongs = useQuery({
    queryKey: ['artist-top-songs', address],
    queryFn: async () => {
      if (!address) return [];
      const res = await fetch(`/api/analytics/artists/${address}/top-songs`);
      return res.json();
    },
    enabled: !!address,
    staleTime: 120000,
  });

  const recentPlays = useQuery({
    queryKey: ['artist-recent-plays', address],
    queryFn: async () => {
      if (!address) return [];
      const res = await fetch(`/api/analytics/artists/${address}/recent-plays`);
      return res.json();
    },
    enabled: !!address,
    staleTime: 60000,
  });

  return {
    analytics,
    topSongs,
    recentPlays,
    isLoading: analytics.isLoading || topSongs.isLoading || recentPlays.isLoading,
    isError: analytics.isError || topSays.isError || recentPlays.isError,
  };
}

/**
 * Hook for listener dashboard data
 */
export function useListenerDashboard(address: string | undefined) {
  const activity = useListenerActivity(address);
  const recentPlays = useQuery({
    queryKey: ['listener-recent-plays', address],
    queryFn: async () => {
      if (!address) return [];
      const res = await fetch(`/api/analytics/listeners/${address}/recent-plays`);
      return res.json();
    },
    enabled: !!address,
    staleTime: 60000,
  });

  const favoriteArtists = useQuery({
    queryKey: ['listener-favorite-artists', address],
    queryFn: async () => {
      if (!address) return [];
      const res = await fetch(
        `/api/analytics/listeners/${address}/favorite-artists`
      );
      return res.json();
    },
    enabled: !!address,
    staleTime: 120000,
  });

  return {
    activity,
    recentPlays,
    favoriteArtists,
    isLoading:
      activity.isLoading || recentPlays.isLoading || favoriteArtists.isLoading,
    isError:
      activity.isError || recentPlays.isError || favoriteArtists.isError,
  };
}

/**
 * Utility: Format currency
 */
export function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
}

/**
 * Utility: Format large numbers
 */
export function formatNumber(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K';
  }
  return value.toString();
}

/**
 * Utility: Format date
 */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

/**
 * Utility: Format relative time
 */
export function formatRelativeTime(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}
