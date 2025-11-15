/**
 * Search and Discovery Hooks
 * React hooks for search, recommendations, trending, and discovery
 */

import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useState, useCallback, useEffect } from 'react';
import { debounce } from 'lodash';

// ============================================================================
// TYPES
// ============================================================================

export interface SearchResult {
  result_type: 'song' | 'artist' | 'playlist' | 'user';
  result_id: string;
  title: string;
  subtitle: string;
  image_url?: string;
  relevance: number;
}

export interface Song {
  song_id: string;
  title: string;
  artist_address: string;
  artist_name: string;
  genre: string;
  strategy: string;
  cover_art_url?: string;
  play_count?: number;
  total_earnings?: string;
}

export interface TrendingSong extends Song {
  trending_score: number;
  play_count_7d: number;
  comment_count_7d: number;
  playlist_adds_7d: number;
}

export interface RisingArtist {
  artist_address: string;
  artist_name: string;
  follower_count: number;
  song_count: number;
  play_count_7d: number;
  new_followers_7d: number;
  rising_score: number;
  artist_since: string;
}

export interface Recommendation {
  song_id: string;
  title: string;
  artist_name: string;
  genre: string;
  recommendation_score: number;
  reason: string;
}

export interface SearchSuggestion {
  suggestion: string;
  suggestion_type: 'artist' | 'genre' | 'tag';
  popularity_score: number;
}

export interface UserPreferences {
  user_address: string;
  favorite_genres: string[];
  favorite_strategies: string[];
  blocked_artists: string[];
  discovery_mode: 'conservative' | 'balanced' | 'adventurous';
}

export interface AdvancedSearchFilters {
  query?: string;
  genres?: string[];
  strategies?: string[];
  minPlays?: number;
  maxPlays?: number;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'title' | 'created_at' | 'play_count' | 'total_earnings';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// ============================================================================
// API CLIENT
// ============================================================================

class SearchAPI {
  private baseUrl = '/api/search';

  async search(
    query: string,
    type: 'all' | 'songs' | 'artists' | 'playlists' | 'users' = 'all',
    limit = 20,
    userAddress?: string
  ) {
    const params = new URLSearchParams({
      q: query,
      type,
      limit: limit.toString(),
    });

    if (userAddress) {
      params.append('userAddress', userAddress);
    }

    const res = await fetch(`${this.baseUrl}?${params}`);
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  }

  async getSuggestions(query: string, limit = 10) {
    const params = new URLSearchParams({
      q: query,
      limit: limit.toString(),
    });

    const res = await fetch(`${this.baseUrl}/suggestions?${params}`);
    if (!res.ok) throw new Error('Failed to fetch suggestions');
    return res.json();
  }

  async getSearchHistory(userAddress: string, limit = 20) {
    const res = await fetch(`${this.baseUrl}/history/${userAddress}?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch search history');
    return res.json();
  }

  async getTrending(genre?: string, limit = 20) {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (genre) params.append('genre', genre);

    const res = await fetch(`${this.baseUrl}/trending?${params}`);
    if (!res.ok) throw new Error('Failed to fetch trending');
    return res.json();
  }

  async getRising(limit = 20) {
    const res = await fetch(`${this.baseUrl}/rising?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch rising artists');
    return res.json();
  }

  async getRecommendations(userAddress: string, limit = 20) {
    const res = await fetch(`${this.baseUrl}/recommendations/${userAddress}?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch recommendations');
    return res.json();
  }

  async getSimilar(songId: string, limit = 10) {
    const res = await fetch(`${this.baseUrl}/similar/${songId}?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch similar songs');
    return res.json();
  }

  async getGenreTrends() {
    const res = await fetch(`${this.baseUrl}/genres/trending`);
    if (!res.ok) throw new Error('Failed to fetch genre trends');
    return res.json();
  }

  async getDiscover(
    userAddress: string,
    mode: 'conservative' | 'balanced' | 'adventurous' = 'balanced',
    limit = 30
  ) {
    const params = new URLSearchParams({
      mode,
      limit: limit.toString(),
    });

    const res = await fetch(`${this.baseUrl}/discover/${userAddress}?${params}`);
    if (!res.ok) throw new Error('Failed to fetch discovery feed');
    return res.json();
  }

  async advancedSearch(filters: AdvancedSearchFilters) {
    const res = await fetch(`${this.baseUrl}/advanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters),
    });
    if (!res.ok) throw new Error('Advanced search failed');
    return res.json();
  }

  async recordListen(data: {
    listenerAddress: string;
    songId: string;
    artistAddress: string;
    genre: string;
    strategy: string;
    playDuration: number;
    completed: boolean;
    skipped: boolean;
    liked: boolean;
  }) {
    const res = await fetch(`${this.baseUrl}/listen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to record listen');
    return res.json();
  }

  async updatePreferences(userAddress: string, preferences: Partial<UserPreferences>) {
    const res = await fetch(`${this.baseUrl}/preferences/${userAddress}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preferences),
    });
    if (!res.ok) throw new Error('Failed to update preferences');
    return res.json();
  }
}

const api = new SearchAPI();

// ============================================================================
// SEARCH HOOKS
// ============================================================================

/**
 * Search with automatic debouncing
 */
export function useSearch(
  initialQuery = '',
  type: 'all' | 'songs' | 'artists' | 'playlists' | 'users' = 'all',
  userAddress?: string
) {
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  // Debounce search query
  const debouncedSetQuery = useCallback(
    debounce((value: string) => {
      setDebouncedQuery(value);
    }, 300),
    []
  );

  useEffect(() => {
    if (query) {
      debouncedSetQuery(query);
    }
  }, [query, debouncedSetQuery]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['search', debouncedQuery, type, userAddress],
    queryFn: () => api.search(debouncedQuery, type, 20, userAddress),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30000, // 30 seconds
  });

  return {
    query,
    setQuery,
    results: data?.results || [],
    count: data?.count || 0,
    isLoading,
    isError,
    error,
  };
}

/**
 * Search suggestions/autocomplete
 */
export function useSearchSuggestions(query: string, limit = 10) {
  return useQuery({
    queryKey: ['search-suggestions', query],
    queryFn: () => api.getSuggestions(query, limit),
    enabled: query.length >= 1,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Search history
 */
export function useSearchHistory(userAddress: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ['search-history', userAddress],
    queryFn: () => api.getSearchHistory(userAddress!, limit),
    enabled: !!userAddress,
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Advanced search with filters
 */
export function useAdvancedSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (filters: AdvancedSearchFilters) => api.advancedSearch(filters),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search'] });
    },
  });
}

// ============================================================================
// DISCOVERY HOOKS
// ============================================================================

/**
 * Trending songs
 */
export function useTrending(genre?: string, limit = 20) {
  return useQuery({
    queryKey: ['trending', genre, limit],
    queryFn: () => api.getTrending(genre, limit),
    staleTime: 120000, // 2 minutes
    refetchInterval: 300000, // Auto-refresh every 5 minutes
  });
}

/**
 * Rising artists
 */
export function useRising(limit = 20) {
  return useQuery({
    queryKey: ['rising-artists', limit],
    queryFn: () => api.getRising(limit),
    staleTime: 300000, // 5 minutes
    refetchInterval: 600000, // Auto-refresh every 10 minutes
  });
}

/**
 * Personalized recommendations
 */
export function useRecommendations(userAddress: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ['recommendations', userAddress, limit],
    queryFn: () => api.getRecommendations(userAddress!, limit),
    enabled: !!userAddress,
    staleTime: 600000, // 10 minutes
  });
}

/**
 * Similar songs
 */
export function useSimilarSongs(songId: string | undefined, limit = 10) {
  return useQuery({
    queryKey: ['similar-songs', songId, limit],
    queryFn: () => api.getSimilar(songId!, limit),
    enabled: !!songId,
    staleTime: 600000, // 10 minutes
  });
}

/**
 * Genre trends
 */
export function useGenreTrends() {
  return useQuery({
    queryKey: ['genre-trends'],
    queryFn: () => api.getGenreTrends(),
    staleTime: 600000, // 10 minutes
  });
}

/**
 * Personalized discovery feed
 */
export function useDiscoverFeed(
  userAddress: string | undefined,
  mode: 'conservative' | 'balanced' | 'adventurous' = 'balanced',
  limit = 30
) {
  return useQuery({
    queryKey: ['discover-feed', userAddress, mode, limit],
    queryFn: () => api.getDiscover(userAddress!, mode, limit),
    enabled: !!userAddress,
    staleTime: 300000, // 5 minutes
    refetchInterval: 600000, // Auto-refresh every 10 minutes
  });
}

// ============================================================================
// TRACKING HOOKS
// ============================================================================

/**
 * Record listening event
 */
export function useRecordListen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      listenerAddress: string;
      songId: string;
      artistAddress: string;
      genre: string;
      strategy: string;
      playDuration: number;
      completed: boolean;
      skipped: boolean;
      liked: boolean;
    }) => api.recordListen(data),
    onSuccess: (_, variables) => {
      // Invalidate recommendations and discovery
      queryClient.invalidateQueries({ queryKey: ['recommendations', variables.listenerAddress] });
      queryClient.invalidateQueries({ queryKey: ['discover-feed', variables.listenerAddress] });
    },
  });
}

/**
 * Update user preferences
 */
export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userAddress, preferences }: {
      userAddress: string;
      preferences: Partial<UserPreferences>;
    }) => api.updatePreferences(userAddress, preferences),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences', variables.userAddress] });
      queryClient.invalidateQueries({ queryKey: ['recommendations', variables.userAddress] });
      queryClient.invalidateQueries({ queryKey: ['discover-feed', variables.userAddress] });
    },
  });
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Combined discovery hook - trending + recommendations + rising
 */
export function useDiscoveryPage(userAddress?: string) {
  const trending = useTrending(undefined, 20);
  const rising = useRising(10);
  const recommendations = useRecommendations(userAddress, 20);
  const genreTrends = useGenreTrends();

  return {
    trending: trending.data?.trending || [],
    rising: rising.data?.rising || [],
    recommendations: recommendations.data?.recommendations || [],
    genres: genreTrends.data?.genres || [],
    isLoading: trending.isLoading || rising.isLoading || recommendations.isLoading,
    isError: trending.isError || rising.isError || recommendations.isError,
  };
}

/**
 * Search everything hook - combines search with suggestions
 */
export function useSearchEverything(userAddress?: string) {
  const [query, setQuery] = useState('');
  const search = useSearch(query, 'all', userAddress);
  const suggestions = useSearchSuggestions(query, 10);

  return {
    query,
    setQuery,
    results: search.results,
    suggestions: suggestions.data?.suggestions || [],
    isLoading: search.isLoading || suggestions.isLoading,
    isError: search.isError || suggestions.isError,
  };
}

/**
 * Smart search with history
 */
export function useSmartSearch(userAddress?: string) {
  const [query, setQuery] = useState('');
  const search = useSearch(query, 'all', userAddress);
  const history = useSearchHistory(userAddress);
  const suggestions = useSearchSuggestions(query);

  const recentSearches = history.data?.history || [];

  return {
    query,
    setQuery,
    results: search.results,
    suggestions: suggestions.data?.suggestions || [],
    recentSearches,
    isLoading: search.isLoading,
  };
}

/**
 * Filter options from data
 */
export function useSearchFilters() {
  const genreTrends = useGenreTrends();

  const genres = genreTrends.data?.genres.map((g: any) => g.genre) || [];
  const strategies = ['pay-per-stream', 'gift-economy', 'patronage', 'auction'];

  return {
    genres,
    strategies,
    isLoading: genreTrends.isLoading,
  };
}
