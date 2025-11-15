/**
 * Creator Tools React Hooks
 * Comprehensive hooks for artist dashboard, content management, and fan engagement
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

interface CreatorDashboard {
  overview: {
    total_songs: number;
    total_followers: number;
    total_patrons: number;
    total_plays: number;
    total_earnings: string;
    total_comments_received: number;
    scheduled_releases_count: number;
    active_campaigns_count: number;
  };
  periodMetrics?: {
    total_plays: number;
    total_earnings: string;
    unique_listeners: number;
    new_followers: number;
    new_patrons: number;
  };
  revenueByStrategy: Array<{
    strategy: string;
    play_count: number;
    total_earnings: string;
  }>;
  recentActivity: Array<{
    type: string;
    timestamp: string;
    user_address: string;
  }>;
}

interface SongDraft {
  id: number;
  artist_address: string;
  draft_name: string;
  song_metadata: any;
  audio_cid?: string;
  cover_art_cid?: string;
  status: 'draft' | 'review' | 'ready' | 'published';
  version_number: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface ScheduledRelease {
  id: number;
  artist_address: string;
  song_title: string;
  release_date: string;
  status: 'pending' | 'published' | 'cancelled' | 'failed';
  auto_publish: boolean;
  notify_followers: boolean;
  pre_save_count: number;
}

interface DiscountCampaign {
  id: number;
  artist_address: string;
  campaign_name: string;
  discount_code: string;
  discount_percentage?: number;
  discount_fixed?: string;
  valid_from: string;
  valid_until?: string;
  max_uses?: number;
  current_uses: number;
  status: 'active' | 'paused' | 'expired' | 'cancelled';
}

interface RevenueSplit {
  id: number;
  song_id: string;
  collaborator_address: string;
  collaborator_name?: string;
  split_percentage: number;
  role?: string;
  status: 'pending' | 'accepted' | 'rejected';
}

interface Patron {
  patron_address: string;
  tier: string;
  subscribed_at: string;
  display_name?: string;
  avatar_url?: string;
  total_plays: number;
  total_spent: string;
}

interface CalendarEvent {
  id: number;
  event_type: string;
  title: string;
  description?: string;
  event_date: string;
  all_day: boolean;
  status: string;
  color?: string;
}

// ============================================================
// API CLIENT
// ============================================================

const api = {
  // Dashboard
  getDashboard: async (artistAddress: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const queryString = params.toString();
    const res = await fetch(`/api/creator/${artistAddress}/dashboard${queryString ? `?${queryString}` : ''}`);
    if (!res.ok) throw new Error('Failed to fetch dashboard');
    return res.json();
  },

  // Drafts
  getDrafts: async (artistAddress: string, status?: string) => {
    const params = status ? `?status=${status}` : '';
    const res = await fetch(`/api/creator/${artistAddress}/drafts${params}`);
    if (!res.ok) throw new Error('Failed to fetch drafts');
    return res.json();
  },

  saveDraft: async (data: any) => {
    const res = await fetch('/api/creator/songs/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save draft');
    return res.json();
  },

  updateDraft: async (id: number, data: any) => {
    const res = await fetch(`/api/creator/songs/draft/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update draft');
    return res.json();
  },

  deleteDraft: async (id: number) => {
    const res = await fetch(`/api/creator/songs/draft/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete draft');
    return res.json();
  },

  // Scheduled Releases
  getScheduledReleases: async (artistAddress: string) => {
    const res = await fetch(`/api/creator/${artistAddress}/scheduled-releases`);
    if (!res.ok) throw new Error('Failed to fetch scheduled releases');
    return res.json();
  },

  scheduleRelease: async (data: any) => {
    const res = await fetch('/api/creator/songs/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to schedule release');
    return res.json();
  },

  cancelScheduledRelease: async (id: number) => {
    const res = await fetch(`/api/creator/scheduled-releases/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to cancel release');
    return res.json();
  },

  // Messages
  getMessages: async (artistAddress: string, limit = 50, offset = 0) => {
    const res = await fetch(`/api/creator/${artistAddress}/messages?limit=${limit}&offset=${offset}`);
    if (!res.ok) throw new Error('Failed to fetch messages');
    return res.json();
  },

  sendMessage: async (data: any) => {
    const res = await fetch('/api/creator/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
  },

  // Patrons
  getPatrons: async (artistAddress: string, tier?: string) => {
    const params = tier ? `?tier=${tier}` : '';
    const res = await fetch(`/api/creator/${artistAddress}/patrons${params}`);
    if (!res.ok) throw new Error('Failed to fetch patrons');
    return res.json();
  },

  // Moderation
  moderateComment: async (commentId: number, artistAddress: string, action: string, reason?: string) => {
    const res = await fetch(`/api/creator/moderate/comment/${commentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artistAddress, action, reason }),
    });
    if (!res.ok) throw new Error('Failed to moderate comment');
    return res.json();
  },

  banUser: async (userAddress: string, artistAddress: string, reason?: string, duration?: number) => {
    const res = await fetch(`/api/creator/ban/${userAddress}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artistAddress, reason, duration, banType: duration ? 'temporary' : 'permanent' }),
    });
    if (!res.ok) throw new Error('Failed to ban user');
    return res.json();
  },

  unbanUser: async (userAddress: string, artistAddress: string) => {
    const res = await fetch(`/api/creator/ban/${userAddress}?artistAddress=${artistAddress}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to unban user');
    return res.json();
  },

  // Campaigns
  getCampaigns: async (artistAddress: string, status?: string) => {
    const params = status ? `?status=${status}` : '';
    const res = await fetch(`/api/creator/${artistAddress}/campaigns${params}`);
    if (!res.ok) throw new Error('Failed to fetch campaigns');
    return res.json();
  },

  createCampaign: async (data: any) => {
    const res = await fetch('/api/creator/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create campaign');
    return res.json();
  },

  updateCampaign: async (id: number, data: any) => {
    const res = await fetch(`/api/creator/campaigns/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update campaign');
    return res.json();
  },

  getCampaignStats: async (id: number) => {
    const res = await fetch(`/api/creator/campaigns/${id}/stats`);
    if (!res.ok) throw new Error('Failed to fetch campaign stats');
    return res.json();
  },

  // Revenue Splits
  getSplits: async (songId: string) => {
    const res = await fetch(`/api/creator/splits/${songId}`);
    if (!res.ok) throw new Error('Failed to fetch splits');
    return res.json();
  },

  addSplit: async (songId: string, data: any) => {
    const res = await fetch(`/api/creator/splits/${songId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add split');
    return res.json();
  },

  updateSplitStatus: async (id: number, status: string, collaboratorAddress: string) => {
    const res = await fetch(`/api/creator/splits/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, collaboratorAddress }),
    });
    if (!res.ok) throw new Error('Failed to update split status');
    return res.json();
  },

  deleteSplit: async (id: number) => {
    const res = await fetch(`/api/creator/splits/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete split');
    return res.json();
  },

  // Analytics
  getRevenueAnalytics: async (artistAddress: string, params: any) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/creator/${artistAddress}/analytics/revenue?${query}`);
    if (!res.ok) throw new Error('Failed to fetch revenue analytics');
    return res.json();
  },

  getTopSongs: async (artistAddress: string, limit = 10, sortBy = 'plays') => {
    const res = await fetch(`/api/creator/${artistAddress}/analytics/top-songs?limit=${limit}&sortBy=${sortBy}`);
    if (!res.ok) throw new Error('Failed to fetch top songs');
    return res.json();
  },

  getAudienceAnalytics: async (artistAddress: string) => {
    const res = await fetch(`/api/creator/${artistAddress}/analytics/audience`);
    if (!res.ok) throw new Error('Failed to fetch audience analytics');
    return res.json();
  },

  exportAnalytics: async (artistAddress: string, format: string, dataType: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams({ format, dataType });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const res = await fetch(`/api/creator/${artistAddress}/analytics/export?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to export analytics');
    return format === 'csv' ? res.text() : res.json();
  },

  // Calendar
  getCalendar: async (artistAddress: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString();
    const res = await fetch(`/api/creator/${artistAddress}/calendar${query ? `?${query}` : ''}`);
    if (!res.ok) throw new Error('Failed to fetch calendar');
    return res.json();
  },

  addCalendarEvent: async (data: any) => {
    const res = await fetch('/api/creator/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add event');
    return res.json();
  },
};

// ============================================================
// DASHBOARD HOOKS
// ============================================================

export function useCreatorDashboard(artistAddress: string | undefined, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['creator-dashboard', artistAddress, startDate, endDate],
    queryFn: () => api.getDashboard(artistAddress!, startDate, endDate),
    enabled: !!artistAddress,
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // Auto-refresh every 5 minutes
  });
}

// ============================================================
// SONG MANAGEMENT HOOKS
// ============================================================

export function useSongDrafts(artistAddress: string | undefined, status?: string) {
  return useQuery({
    queryKey: ['song-drafts', artistAddress, status],
    queryFn: () => api.getDrafts(artistAddress!, status),
    enabled: !!artistAddress,
    staleTime: 30000,
  });
}

export function useSaveDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.saveDraft,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['song-drafts', variables.artistAddress] });
    },
  });
}

export function useUpdateDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateDraft(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['song-drafts'] });
    },
  });
}

export function useDeleteDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteDraft,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['song-drafts'] });
    },
  });
}

export function useScheduledReleases(artistAddress: string | undefined) {
  return useQuery({
    queryKey: ['scheduled-releases', artistAddress],
    queryFn: () => api.getScheduledReleases(artistAddress!),
    enabled: !!artistAddress,
    staleTime: 60000,
  });
}

export function useScheduleRelease() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.scheduleRelease,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-releases', variables.artistAddress] });
      queryClient.invalidateQueries({ queryKey: ['creator-dashboard', variables.artistAddress] });
    },
  });
}

export function useCancelScheduledRelease() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.cancelScheduledRelease,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-releases'] });
      queryClient.invalidateQueries({ queryKey: ['creator-dashboard'] });
    },
  });
}

// ============================================================
// FAN ENGAGEMENT HOOKS
// ============================================================

export function useCreatorMessages(artistAddress: string | undefined, limit = 50, offset = 0) {
  return useQuery({
    queryKey: ['creator-messages', artistAddress, limit, offset],
    queryFn: () => api.getMessages(artistAddress!, limit, offset),
    enabled: !!artistAddress,
    staleTime: 30000,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.sendMessage,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['creator-messages', variables.artistAddress] });
    },
  });
}

export function usePatrons(artistAddress: string | undefined, tier?: string) {
  return useQuery({
    queryKey: ['patrons', artistAddress, tier],
    queryFn: () => api.getPatrons(artistAddress!, tier),
    enabled: !!artistAddress,
    staleTime: 120000, // 2 minutes
  });
}

export function useModerateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, artistAddress, action, reason }: {
      commentId: number;
      artistAddress: string;
      action: string;
      reason?: string;
    }) => api.moderateComment(commentId, artistAddress, action, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}

export function useBanUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userAddress, artistAddress, reason, duration }: {
      userAddress: string;
      artistAddress: string;
      reason?: string;
      duration?: number;
    }) => api.banUser(userAddress, artistAddress, reason, duration),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}

export function useUnbanUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userAddress, artistAddress }: { userAddress: string; artistAddress: string }) =>
      api.unbanUser(userAddress, artistAddress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}

// ============================================================
// PROMOTIONAL CAMPAIGN HOOKS
// ============================================================

export function useCampaigns(artistAddress: string | undefined, status?: string) {
  return useQuery({
    queryKey: ['campaigns', artistAddress, status],
    queryFn: () => api.getCampaigns(artistAddress!, status),
    enabled: !!artistAddress,
    staleTime: 60000,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createCampaign,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', variables.artistAddress] });
      queryClient.invalidateQueries({ queryKey: ['creator-dashboard', variables.artistAddress] });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateCampaign(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useCampaignStats(campaignId: number | undefined) {
  return useQuery({
    queryKey: ['campaign-stats', campaignId],
    queryFn: () => api.getCampaignStats(campaignId!),
    enabled: !!campaignId,
    staleTime: 60000,
  });
}

// ============================================================
// REVENUE SPLIT HOOKS
// ============================================================

export function useRevenueSplits(songId: string | undefined) {
  return useQuery({
    queryKey: ['revenue-splits', songId],
    queryFn: () => api.getSplits(songId!),
    enabled: !!songId,
    staleTime: 120000,
  });
}

export function useAddSplit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ songId, data }: { songId: string; data: any }) => api.addSplit(songId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['revenue-splits', variables.songId] });
    },
  });
}

export function useUpdateSplitStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, collaboratorAddress }: {
      id: number;
      status: string;
      collaboratorAddress: string;
    }) => api.updateSplitStatus(id, status, collaboratorAddress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue-splits'] });
    },
  });
}

export function useDeleteSplit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteSplit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue-splits'] });
    },
  });
}

// ============================================================
// ANALYTICS HOOKS
// ============================================================

export function useRevenueAnalytics(
  artistAddress: string | undefined,
  params: { startDate?: string; endDate?: string; groupBy?: string }
) {
  return useQuery({
    queryKey: ['revenue-analytics', artistAddress, params],
    queryFn: () => api.getRevenueAnalytics(artistAddress!, params),
    enabled: !!artistAddress,
    staleTime: 120000,
  });
}

export function useTopSongs(artistAddress: string | undefined, limit = 10, sortBy: 'plays' | 'earnings' = 'plays') {
  return useQuery({
    queryKey: ['top-songs', artistAddress, limit, sortBy],
    queryFn: () => api.getTopSongs(artistAddress!, limit, sortBy),
    enabled: !!artistAddress,
    staleTime: 120000,
  });
}

export function useAudienceAnalytics(artistAddress: string | undefined) {
  return useQuery({
    queryKey: ['audience-analytics', artistAddress],
    queryFn: () => api.getAudienceAnalytics(artistAddress!),
    enabled: !!artistAddress,
    staleTime: 300000, // 5 minutes
  });
}

export function useExportAnalytics() {
  return useMutation({
    mutationFn: ({ artistAddress, format, dataType, startDate, endDate }: {
      artistAddress: string;
      format: string;
      dataType: string;
      startDate?: string;
      endDate?: string;
    }) => api.exportAnalytics(artistAddress, format, dataType, startDate, endDate),
  });
}

// ============================================================
// CONTENT CALENDAR HOOKS
// ============================================================

export function useContentCalendar(artistAddress: string | undefined, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['content-calendar', artistAddress, startDate, endDate],
    queryFn: () => api.getCalendar(artistAddress!, startDate, endDate),
    enabled: !!artistAddress,
    staleTime: 60000,
  });
}

export function useAddCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.addCalendarEvent,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['content-calendar', variables.artistAddress] });
    },
  });
}

// ============================================================
// COMBINED HOOKS
// ============================================================

/**
 * Combined hook for complete creator dashboard data
 */
export function useCreatorDashboardData(artistAddress: string | undefined) {
  const dashboard = useCreatorDashboard(artistAddress);
  const scheduledReleases = useScheduledReleases(artistAddress);
  const campaigns = useCampaigns(artistAddress, 'active');
  const topSongs = useTopSongs(artistAddress, 5);

  return {
    dashboard: dashboard.data,
    scheduledReleases: scheduledReleases.data?.scheduledReleases || [],
    activeCampaigns: campaigns.data?.campaigns || [],
    topSongs: topSongs.data?.topSongs || [],
    isLoading: dashboard.isLoading || scheduledReleases.isLoading || campaigns.isLoading || topSongs.isLoading,
    isError: dashboard.isError || scheduledReleases.isError || campaigns.isError || topSongs.isError,
  };
}

/**
 * Hook for song management operations
 */
export function useSongManagement(artistAddress: string | undefined) {
  const drafts = useSongDrafts(artistAddress);
  const scheduledReleases = useScheduledReleases(artistAddress);
  const saveDraft = useSaveDraft();
  const updateDraft = useUpdateDraft();
  const deleteDraft = useDeleteDraft();
  const scheduleRelease = useScheduleRelease();
  const cancelRelease = useCancelScheduledRelease();

  return {
    drafts: drafts.data?.drafts || [],
    scheduledReleases: scheduledReleases.data?.scheduledReleases || [],
    saveDraft: saveDraft.mutateAsync,
    updateDraft: updateDraft.mutateAsync,
    deleteDraft: deleteDraft.mutateAsync,
    scheduleRelease: scheduleRelease.mutateAsync,
    cancelRelease: cancelRelease.mutateAsync,
    isLoading: drafts.isLoading || scheduledReleases.isLoading,
    isSaving: saveDraft.isPending || updateDraft.isPending || scheduleRelease.isPending,
  };
}

export default {
  // Dashboard
  useCreatorDashboard,
  useCreatorDashboardData,

  // Song Management
  useSongDrafts,
  useSaveDraft,
  useUpdateDraft,
  useDeleteDraft,
  useScheduledReleases,
  useScheduleRelease,
  useCancelScheduledRelease,
  useSongManagement,

  // Fan Engagement
  useCreatorMessages,
  useSendMessage,
  usePatrons,
  useModerateComment,
  useBanUser,
  useUnbanUser,

  // Campaigns
  useCampaigns,
  useCreateCampaign,
  useUpdateCampaign,
  useCampaignStats,

  // Revenue Splits
  useRevenueSplits,
  useAddSplit,
  useUpdateSplitStatus,
  useDeleteSplit,

  // Analytics
  useRevenueAnalytics,
  useTopSongs,
  useAudienceAnalytics,
  useExportAnalytics,

  // Calendar
  useContentCalendar,
  useAddCalendarEvent,
};
