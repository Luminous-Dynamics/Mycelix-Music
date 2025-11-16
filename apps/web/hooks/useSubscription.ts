/**
 * Platform Subscription React Hooks
 * React Query hooks for platform-wide subscriptions (5th economic model)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================
// TYPES
// ============================================================

export interface SubscriptionTier {
  id: number;
  name: string;
  price: number;
  features: string[];
}

export interface Subscription {
  id: number;
  subscriber_address: string;
  tier: 'BASIC' | 'PREMIUM' | 'ARTIST_SUPPORTER';
  start_date: string;
  last_billing_date: string;
  next_billing_date: string;
  status: 'active' | 'cancelled' | 'expired' | 'paused';
  payment_method?: string;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: number;
  subscription_id: number;
  transaction_type: 'charge' | 'renewal' | 'upgrade' | 'downgrade' | 'refund';
  amount: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  transaction_hash?: string;
  created_at: string;
}

export interface PlatformStats {
  tierStats: Array<{
    tier: string;
    subscriber_count: number;
    monthly_revenue: string;
  }>;
  revenue: {
    total_revenue: string;
    total_transactions: number;
    avg_transaction: string;
  };
  churnRate: number;
  totalActiveSubscribers: number;
}

export interface ArtistRevenue {
  distributions: Array<{
    month: string;
    play_count: number;
    total_plays: number;
    share_percentage: string;
    earnings: string;
    distributed: boolean;
  }>;
  totalEarnings: number;
  monthCount: number;
}

// ============================================================
// API CLIENT
// ============================================================

const api = {
  // Subscription management
  getTiers: async () => {
    const res = await fetch('/api/subscriptions/tiers');
    if (!res.ok) throw new Error('Failed to fetch tiers');
    return res.json();
  },

  getSubscription: async (userAddress: string) => {
    const res = await fetch(`/api/subscriptions/${userAddress}`);
    if (!res.ok) throw new Error('Failed to fetch subscription');
    return res.json();
  },

  subscribe: async (data: {
    userAddress: string;
    tier: string;
    paymentMethod?: string;
    transactionHash?: string;
    autoRenew?: boolean;
  }) => {
    const res = await fetch('/api/subscriptions/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to subscribe');
    }
    return res.json();
  },

  renew: async (userAddress: string, transactionHash?: string) => {
    const res = await fetch(`/api/subscriptions/${userAddress}/renew`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionHash }),
    });
    if (!res.ok) throw new Error('Failed to renew subscription');
    return res.json();
  },

  cancel: async (userAddress: string) => {
    const res = await fetch(`/api/subscriptions/${userAddress}/cancel`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to cancel subscription');
    return res.json();
  },

  upgrade: async (userAddress: string, newTier: string, transactionHash?: string) => {
    const res = await fetch(`/api/subscriptions/${userAddress}/upgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newTier, transactionHash }),
    });
    if (!res.ok) throw new Error('Failed to upgrade subscription');
    return res.json();
  },

  downgrade: async (userAddress: string, newTier: string) => {
    const res = await fetch(`/api/subscriptions/${userAddress}/downgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newTier }),
    });
    if (!res.ok) throw new Error('Failed to downgrade subscription');
    return res.json();
  },

  setAutoRenew: async (userAddress: string, enabled: boolean) => {
    const res = await fetch(`/api/subscriptions/${userAddress}/auto-renew`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) throw new Error('Failed to update auto-renew');
    return res.json();
  },

  // Analytics
  getPlatformStats: async () => {
    const res = await fetch('/api/subscriptions/stats/platform');
    if (!res.ok) throw new Error('Failed to fetch platform stats');
    return res.json();
  },

  getTransactions: async (userAddress: string, limit = 20) => {
    const res = await fetch(`/api/subscriptions/${userAddress}/transactions?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch transactions');
    return res.json();
  },

  getArtistRevenue: async (artistAddress: string, limit = 12) => {
    const res = await fetch(`/api/subscriptions/revenue/artist/${artistAddress}?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch artist revenue');
    return res.json();
  },

  // Access control
  canPlay: async (userAddress: string) => {
    const res = await fetch(`/api/subscriptions/${userAddress}/can-play`);
    if (!res.ok) throw new Error('Failed to check play access');
    return res.json();
  },
};

// ============================================================
// SUBSCRIPTION HOOKS
// ============================================================

/**
 * Get all available subscription tiers
 */
export function useSubscriptionTiers() {
  return useQuery({
    queryKey: ['subscription-tiers'],
    queryFn: api.getTiers,
    staleTime: Infinity, // Tiers don't change
  });
}

/**
 * Get user's subscription details
 */
export function useSubscription(userAddress: string | undefined) {
  return useQuery({
    queryKey: ['subscription', userAddress],
    queryFn: () => api.getSubscription(userAddress!),
    enabled: !!userAddress,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Subscribe to a tier
 */
export function useSubscribe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.subscribe,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subscription', variables.userAddress] });
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
    },
  });
}

/**
 * Renew subscription
 */
export function useRenewSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userAddress, transactionHash }: {
      userAddress: string;
      transactionHash?: string;
    }) => api.renew(userAddress, transactionHash),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subscription', variables.userAddress] });
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.userAddress] });
    },
  });
}

/**
 * Cancel subscription
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.cancel,
    onSuccess: (_, userAddress) => {
      queryClient.invalidateQueries({ queryKey: ['subscription', userAddress] });
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
    },
  });
}

/**
 * Upgrade subscription tier
 */
export function useUpgradeSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userAddress, newTier, transactionHash }: {
      userAddress: string;
      newTier: string;
      transactionHash?: string;
    }) => api.upgrade(userAddress, newTier, transactionHash),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subscription', variables.userAddress] });
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.userAddress] });
    },
  });
}

/**
 * Downgrade subscription tier
 */
export function useDowngradeSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userAddress, newTier }: {
      userAddress: string;
      newTier: string;
    }) => api.downgrade(userAddress, newTier),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subscription', variables.userAddress] });
    },
  });
}

/**
 * Toggle auto-renewal
 */
export function useSetAutoRenew() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userAddress, enabled }: {
      userAddress: string;
      enabled: boolean;
    }) => api.setAutoRenew(userAddress, enabled),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subscription', variables.userAddress] });
    },
  });
}

// ============================================================
// ANALYTICS HOOKS
// ============================================================

/**
 * Get platform-wide subscription statistics
 */
export function usePlatformStats() {
  return useQuery<PlatformStats>({
    queryKey: ['platform-stats'],
    queryFn: api.getPlatformStats,
    staleTime: 120000, // 2 minutes
  });
}

/**
 * Get user's transaction history
 */
export function useTransactions(userAddress: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ['transactions', userAddress, limit],
    queryFn: () => api.getTransactions(userAddress!, limit),
    enabled: !!userAddress,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Get artist's revenue from subscriptions
 */
export function useArtistRevenue(artistAddress: string | undefined, limit = 12) {
  return useQuery<ArtistRevenue>({
    queryKey: ['artist-revenue', artistAddress, limit],
    queryFn: () => api.getArtistRevenue(artistAddress!, limit),
    enabled: !!artistAddress,
    staleTime: 300000, // 5 minutes
  });
}

// ============================================================
// ACCESS CONTROL HOOKS
// ============================================================

/**
 * Check if user can play songs
 */
export function useCanPlay(userAddress: string | undefined) {
  return useQuery({
    queryKey: ['can-play', userAddress],
    queryFn: () => api.canPlay(userAddress!),
    enabled: !!userAddress,
    staleTime: 60000, // 1 minute
  });
}

// ============================================================
// COMBINED HOOKS
// ============================================================

/**
 * Get complete subscription data for user
 */
export function useSubscriptionData(userAddress: string | undefined) {
  const subscription = useSubscription(userAddress);
  const transactions = useTransactions(userAddress, 10);
  const canPlay = useCanPlay(userAddress);

  return {
    subscription: subscription.data,
    transactions: transactions.data?.transactions || [],
    canPlay: canPlay.data,
    isLoading: subscription.isLoading || transactions.isLoading || canPlay.isLoading,
    isError: subscription.isError || transactions.isError || canPlay.isError,
  };
}

/**
 * Get subscription management functions
 */
export function useSubscriptionManagement(userAddress: string | undefined) {
  const subscribe = useSubscribe();
  const renew = useRenewSubscription();
  const cancel = useCancelSubscription();
  const upgrade = useUpgradeSubscription();
  const downgrade = useDowngradeSubscription();
  const setAutoRenew = useSetAutoRenew();

  return {
    subscribe: (tier: string, transactionHash?: string) =>
      subscribe.mutateAsync({ userAddress: userAddress!, tier, transactionHash }),
    renew: (transactionHash?: string) =>
      renew.mutateAsync({ userAddress: userAddress!, transactionHash }),
    cancel: () => cancel.mutateAsync(userAddress!),
    upgrade: (newTier: string, transactionHash?: string) =>
      upgrade.mutateAsync({ userAddress: userAddress!, newTier, transactionHash }),
    downgrade: (newTier: string) =>
      downgrade.mutateAsync({ userAddress: userAddress!, newTier }),
    setAutoRenew: (enabled: boolean) =>
      setAutoRenew.mutateAsync({ userAddress: userAddress!, enabled }),
    isPending: subscribe.isPending || renew.isPending || cancel.isPending ||
               upgrade.isPending || downgrade.isPending || setAutoRenew.isPending,
  };
}

/**
 * Helper: Calculate days until renewal
 */
export function useDaysUntilRenewal(subscription: Subscription | null | undefined): number {
  if (!subscription || !subscription.next_billing_date) return 0;

  const nextBilling = new Date(subscription.next_billing_date);
  const now = new Date();
  const diff = nextBilling.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Helper: Check if subscription needs renewal soon
 */
export function useNeedsRenewal(subscription: Subscription | null | undefined): boolean {
  const daysUntil = useDaysUntilRenewal(subscription);
  return daysUntil >= 0 && daysUntil <= 7; // Within 7 days
}

/**
 * Helper: Get tier display name and features
 */
export function useTierInfo(tier: string | undefined) {
  const { data: tiersData } = useSubscriptionTiers();

  if (!tier || !tiersData) return null;

  const allTiers: Record<string, SubscriptionTier> = {
    FREE: { id: 0, name: 'Free', price: 0, features: ['Pay-per-stream', 'Ads'] },
    BASIC: { id: 1, name: 'Basic', price: 5, features: ['Unlimited plays', 'No ads'] },
    PREMIUM: { id: 2, name: 'Premium', price: 10, features: ['High quality', 'Offline', 'Ad-free'] },
    ARTIST_SUPPORTER: { id: 3, name: 'Artist Supporter', price: 15, features: ['Premium', 'Support artists'] },
  };

  return allTiers[tier] || allTiers.FREE;
}

export default {
  // Subscription management
  useSubscriptionTiers,
  useSubscription,
  useSubscribe,
  useRenewSubscription,
  useCancelSubscription,
  useUpgradeSubscription,
  useDowngradeSubscription,
  useSetAutoRenew,

  // Analytics
  usePlatformStats,
  useTransactions,
  useArtistRevenue,

  // Access control
  useCanPlay,

  // Combined
  useSubscriptionData,
  useSubscriptionManagement,

  // Helpers
  useDaysUntilRenewal,
  useNeedsRenewal,
  useTierInfo,
};
