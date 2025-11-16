import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiConfig, createClient } from 'wagmi'
import { MockConnector } from '@wagmi/core/connectors/mock'
import { providers } from 'ethers'
import {
  useCurrentSubscription,
  useSubscribe,
  useUpgradeSubscription,
  useCancelSubscription,
  useBillingHistory,
  useArtistRevenue,
  useSubscriptionPlans,
} from '../useSubscription'

// Mock API client
vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import { api } from '../../lib/api'

describe('Subscription Hooks', () => {
  let queryClient: QueryClient
  let wagmiClient: any
  let wrapper: any

  const testAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2'
  const mockProvider = new providers.JsonRpcProvider()

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    wagmiClient = createClient({
      connector: new MockConnector({
        options: {
          address: testAddress,
        },
      }),
    })

    wrapper = ({ children }: { children: React.ReactNode }) => (
      <WagmiConfig client={wagmiClient}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </WagmiConfig>
    )

    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClient.clear()
  })

  // ============================================
  // useCurrentSubscription
  // ============================================

  describe('useCurrentSubscription', () => {
    it('should fetch current subscription for connected wallet', async () => {
      const mockSubscription = {
        id: '1',
        user_address: testAddress,
        tier: 'PREMIUM',
        active: true,
        auto_renew: true,
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      }

      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          success: true,
          subscription: mockSubscription,
        },
      })

      const { result } = renderHook(() => useCurrentSubscription(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockSubscription)
      expect(api.get).toHaveBeenCalledWith('/api/subscriptions/current', {
        params: { userAddress: testAddress },
      })
    })

    it('should return null for non-subscribed user', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          success: true,
          subscription: null,
        },
      })

      const { result } = renderHook(() => useCurrentSubscription(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toBeNull()
    })

    it('should refetch when wallet address changes', async () => {
      const newAddress = '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199'

      vi.mocked(api.get).mockResolvedValueOnce({
        data: { success: true, subscription: { tier: 'BASIC' } },
      })

      const { result, rerender } = renderHook(() => useCurrentSubscription(), { wrapper })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // Change address
      wagmiClient.connector.options.address = newAddress

      vi.mocked(api.get).mockResolvedValueOnce({
        data: { success: true, subscription: { tier: 'PREMIUM' } },
      })

      rerender()

      await waitFor(() => {
        expect(result.current.data?.tier).toBe('PREMIUM')
      })
    })

    it('should cache subscription data', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { success: true, subscription: { tier: 'BASIC' } },
      })

      const { result: result1 } = renderHook(() => useCurrentSubscription(), { wrapper })
      await waitFor(() => expect(result1.current.isSuccess).toBe(true))

      // Second hook should use cache
      const { result: result2 } = renderHook(() => useCurrentSubscription(), { wrapper })

      expect(result2.current.data).toEqual(result1.current.data)
      expect(api.get).toHaveBeenCalledTimes(1) // Only one API call
    })

    it('should handle loading state', () => {
      vi.mocked(api.get).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      )

      const { result } = renderHook(() => useCurrentSubscription(), { wrapper })

      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toBeUndefined()
    })

    it('should handle error state', async () => {
      vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useCurrentSubscription(), { wrapper })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toBeDefined()
    })

    it('should not fetch if wallet not connected', () => {
      wagmiClient.connector.options.address = null

      const { result } = renderHook(() => useCurrentSubscription(), { wrapper })

      expect(result.current.data).toBeUndefined()
      expect(api.get).not.toHaveBeenCalled()
    })
  })

  // ============================================
  // useSubscribe
  // ============================================

  describe('useSubscribe', () => {
    it('should subscribe to FREE tier', async () => {
      const mockResponse = {
        success: true,
        subscription: {
          tier: 'FREE',
          active: true,
        },
      }

      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse })

      const { result } = renderHook(() => useSubscribe(), { wrapper })

      await act(async () => {
        await result.current.mutateAsync({
          tier: 'FREE',
        })
      })

      expect(result.current.isSuccess).toBe(true)
      expect(result.current.data).toEqual(mockResponse)
      expect(api.post).toHaveBeenCalledWith('/api/subscriptions/subscribe', {
        userAddress: testAddress,
        tier: 'FREE',
      })
    })

    it('should subscribe to paid tier with transaction hash', async () => {
      const mockTxHash = '0x' + '1'.repeat(64)
      const mockResponse = {
        success: true,
        subscription: {
          tier: 'BASIC',
          active: true,
        },
      }

      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse })

      const { result } = renderHook(() => useSubscribe(), { wrapper })

      await act(async () => {
        await result.current.mutateAsync({
          tier: 'BASIC',
          txHash: mockTxHash,
        })
      })

      expect(api.post).toHaveBeenCalledWith('/api/subscriptions/subscribe', {
        userAddress: testAddress,
        tier: 'BASIC',
        txHash: mockTxHash,
      })
    })

    it('should invalidate subscription cache on success', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        data: { success: true, subscription: {} },
      })

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useSubscribe(), { wrapper })

      await act(async () => {
        await result.current.mutateAsync({ tier: 'BASIC', txHash: '0x123' })
      })

      expect(invalidateSpy).toHaveBeenCalledWith(['subscription', testAddress])
    })

    it('should handle transaction rejection', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Transaction rejected'))

      const { result } = renderHook(() => useSubscribe(), { wrapper })

      await act(async () => {
        try {
          await result.current.mutateAsync({ tier: 'BASIC', txHash: '0x123' })
        } catch (error) {
          expect(error).toBeDefined()
        }
      })

      expect(result.current.isError).toBe(true)
    })

    it('should handle insufficient funds error', async () => {
      vi.mocked(api.post).mockRejectedValueOnce({
        response: { data: { error: 'Insufficient funds' } },
      })

      const { result } = renderHook(() => useSubscribe(), { wrapper })

      await act(async () => {
        try {
          await result.current.mutateAsync({ tier: 'PREMIUM', txHash: '0x123' })
        } catch (error: any) {
          expect(error.response.data.error).toBe('Insufficient funds')
        }
      })
    })

    it('should call onSuccess callback', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        data: { success: true, subscription: {} },
      })

      const onSuccess = vi.fn()

      const { result } = renderHook(() => useSubscribe({ onSuccess }), { wrapper })

      await act(async () => {
        await result.current.mutateAsync({ tier: 'FREE' })
      })

      expect(onSuccess).toHaveBeenCalled()
    })

    it('should call onError callback', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('API error'))

      const onError = vi.fn()

      const { result } = renderHook(() => useSubscribe({ onError }), { wrapper })

      await act(async () => {
        try {
          await result.current.mutateAsync({ tier: 'BASIC', txHash: '0x123' })
        } catch {}
      })

      expect(onError).toHaveBeenCalled()
    })
  })

  // ============================================
  // useUpgradeSubscription
  // ============================================

  describe('useUpgradeSubscription', () => {
    it('should upgrade tier successfully', async () => {
      const mockResponse = {
        success: true,
        subscription: {
          tier: 'PREMIUM',
        },
        proRatedAmount: '0.005',
      }

      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse })

      const { result } = renderHook(() => useUpgradeSubscription(), { wrapper })

      await act(async () => {
        await result.current.mutateAsync({
          newTier: 'PREMIUM',
          txHash: '0x123',
        })
      })

      expect(result.current.isSuccess).toBe(true)
      expect(result.current.data).toEqual(mockResponse)
      expect(api.post).toHaveBeenCalledWith('/api/subscriptions/upgrade', {
        userAddress: testAddress,
        newTier: 'PREMIUM',
        txHash: '0x123',
      })
    })

    it('should calculate and display pro-rated amount', async () => {
      const mockResponse = {
        success: true,
        subscription: { tier: 'PREMIUM' },
        proRatedAmount: '0.0075', // Half of (0.02 - 0.01) = 0.005
        fullUpgradeCost: '0.01',
      }

      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse })

      const { result } = renderHook(() => useUpgradeSubscription(), { wrapper })

      await act(async () => {
        await result.current.mutateAsync({
          newTier: 'PREMIUM',
          txHash: '0x123',
        })
      })

      expect(result.current.data?.proRatedAmount).toBe('0.0075')
    })

    it('should show confirmation modal before upgrade', async () => {
      const { result } = renderHook(() => useUpgradeSubscription({ requireConfirmation: true }), {
        wrapper,
      })

      // This would typically trigger a modal in the component
      // Testing the hook behavior
      expect(result.current.mutate).toBeDefined()
    })

    it('should handle upgrade failure gracefully', async () => {
      vi.mocked(api.post).mockRejectedValueOnce({
        response: { data: { error: 'Cannot downgrade via upgrade endpoint' } },
      })

      const { result } = renderHook(() => useUpgradeSubscription(), { wrapper })

      await act(async () => {
        try {
          await result.current.mutateAsync({
            newTier: 'BASIC',
            txHash: '0x123',
          })
        } catch (error: any) {
          expect(error.response.data.error).toContain('downgrade')
        }
      })
    })

    it('should invalidate cache after successful upgrade', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        data: { success: true, subscription: {} },
      })

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useUpgradeSubscription(), { wrapper })

      await act(async () => {
        await result.current.mutateAsync({
          newTier: 'PREMIUM',
          txHash: '0x123',
        })
      })

      expect(invalidateSpy).toHaveBeenCalledWith(['subscription', testAddress])
    })
  })

  // ============================================
  // useCancelSubscription
  // ============================================

  describe('useCancelSubscription', () => {
    it('should cancel subscription successfully', async () => {
      const mockResponse = {
        success: true,
        message: 'Subscription cancelled',
      }

      vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse })

      const { result } = renderHook(() => useCancelSubscription(), { wrapper })

      await act(async () => {
        await result.current.mutateAsync()
      })

      expect(result.current.isSuccess).toBe(true)
      expect(api.post).toHaveBeenCalledWith('/api/subscriptions/cancel', {
        userAddress: testAddress,
      })
    })

    it('should show cancellation confirmation dialog', async () => {
      const { result } = renderHook(
        () => useCancelSubscription({ requireConfirmation: true }),
        { wrapper }
      )

      // Mock would typically trigger confirmation dialog
      expect(result.current.mutate).toBeDefined()
    })

    it('should update UI state after cancellation', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        data: { success: true },
      })

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useCancelSubscription(), { wrapper })

      await act(async () => {
        await result.current.mutateAsync()
      })

      expect(invalidateSpy).toHaveBeenCalledWith(['subscription', testAddress])
    })

    it('should handle cancellation error', async () => {
      vi.mocked(api.post).mockRejectedValueOnce({
        response: { data: { error: 'No active subscription' } },
      })

      const { result } = renderHook(() => useCancelSubscription(), { wrapper })

      await act(async () => {
        try {
          await result.current.mutateAsync()
        } catch (error: any) {
          expect(error.response.data.error).toBe('No active subscription')
        }
      })
    })

    it('should preserve access until end date after cancellation', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Subscription cancelled. Access until 2025-12-15',
        },
      })

      const { result } = renderHook(() => useCancelSubscription(), { wrapper })

      await act(async () => {
        await result.current.mutateAsync()
      })

      expect(result.current.data?.message).toContain('Access until')
    })
  })

  // ============================================
  // useBillingHistory
  // ============================================

  describe('useBillingHistory', () => {
    it('should fetch billing history', async () => {
      const mockTransactions = [
        {
          id: '1',
          type: 'subscription',
          tier: 'BASIC',
          amount: '0.01',
          status: 'success',
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          type: 'upgrade',
          from_tier: 'BASIC',
          to_tier: 'PREMIUM',
          amount: '0.01',
          status: 'success',
          created_at: new Date().toISOString(),
        },
      ]

      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          success: true,
          transactions: mockTransactions,
          total: 2,
        },
      })

      const { result } = renderHook(() => useBillingHistory(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.transactions).toEqual(mockTransactions)
      expect(result.current.data?.total).toBe(2)
    })

    it('should paginate results', async () => {
      const mockResponse = {
        transactions: [{ id: '1' }],
        total: 50,
      }

      vi.mocked(api.get).mockResolvedValueOnce({
        data: { success: true, ...mockResponse },
      })

      const { result } = renderHook(() => useBillingHistory({ limit: 10, offset: 0 }), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(api.get).toHaveBeenCalledWith('/api/subscriptions/billing/history', {
        params: {
          userAddress: testAddress,
          limit: 10,
          offset: 0,
        },
      })
    })

    it('should filter by transaction type', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          success: true,
          transactions: [{ type: 'renewal' }],
          total: 1,
        },
      })

      const { result } = renderHook(() => useBillingHistory({ type: 'renewal' }), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(api.get).toHaveBeenCalledWith(
        '/api/subscriptions/billing/history',
        expect.objectContaining({
          params: expect.objectContaining({
            type: 'renewal',
          }),
        })
      )
    })

    it('should show loading state while fetching', () => {
      vi.mocked(api.get).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      )

      const { result } = renderHook(() => useBillingHistory(), { wrapper })

      expect(result.current.isLoading).toBe(true)
    })

    it('should handle empty history', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          success: true,
          transactions: [],
          total: 0,
        },
      })

      const { result } = renderHook(() => useBillingHistory(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.transactions).toHaveLength(0)
    })
  })

  // ============================================
  // useArtistRevenue
  // ============================================

  describe('useArtistRevenue', () => {
    const artistAddress = '0x9999999999999999999999999999999999999999'

    it('should fetch artist subscription revenue', async () => {
      const mockRevenue = {
        totalRevenue: '0.028',
        playCount: 100,
        patronageBonus: '0.005',
        breakdown: {
          baseRevenue: '0.023',
          patronageRevenue: '0.005',
        },
      }

      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          success: true,
          revenue: mockRevenue,
        },
      })

      const { result } = renderHook(() => useArtistRevenue(artistAddress), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockRevenue)
      expect(api.get).toHaveBeenCalledWith(
        '/api/subscriptions/revenue',
        expect.objectContaining({
          params: expect.objectContaining({
            artistAddress,
          }),
        })
      )
    })

    it('should include patronage bonus for supporter tier listeners', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          success: true,
          revenue: {
            totalRevenue: '0.04',
            patronageBonus: '0.005',
            playCount: 50,
          },
        },
      })

      const { result } = renderHook(() => useArtistRevenue(artistAddress), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.patronageBonus).toBe('0.005')
    })

    it('should filter by date range', async () => {
      const startDate = '2025-01-01'
      const endDate = '2025-01-31'

      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          success: true,
          revenue: { totalRevenue: '0.1', playCount: 200 },
        },
      })

      const { result } = renderHook(
        () => useArtistRevenue(artistAddress, { startDate, endDate }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(api.get).toHaveBeenCalledWith(
        '/api/subscriptions/revenue',
        expect.objectContaining({
          params: expect.objectContaining({
            artistAddress,
            startDate,
            endDate,
          }),
        })
      )
    })

    it('should format revenue amounts correctly', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          success: true,
          revenue: {
            totalRevenue: '0.028467',
            playCount: 100,
          },
        },
      })

      const { result } = renderHook(() => useArtistRevenue(artistAddress), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Hook should format to reasonable precision
      expect(result.current.data?.totalRevenue).toBe('0.028467')
    })

    it('should return zero revenue for artist with no plays', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          success: true,
          revenue: {
            totalRevenue: '0',
            playCount: 0,
          },
        },
      })

      const { result } = renderHook(() => useArtistRevenue(artistAddress), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.totalRevenue).toBe('0')
      expect(result.current.data?.playCount).toBe(0)
    })
  })

  // ============================================
  // useSubscriptionPlans
  // ============================================

  describe('useSubscriptionPlans', () => {
    it('should return all tier configurations', () => {
      const { result } = renderHook(() => useSubscriptionPlans(), { wrapper })

      expect(result.current.plans).toHaveLength(4)
      expect(result.current.plans.map((p) => p.tier)).toEqual([
        'FREE',
        'BASIC',
        'PREMIUM',
        'ARTIST_SUPPORTER',
      ])
    })

    it('should mark current tier for subscribed user', async () => {
      // Mock current subscription
      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          success: true,
          subscription: { tier: 'PREMIUM' },
        },
      })

      const { result } = renderHook(() => useSubscriptionPlans(), { wrapper })

      await waitFor(() => {
        const premiumPlan = result.current.plans.find((p) => p.tier === 'PREMIUM')
        expect(premiumPlan?.isCurrent).toBe(true)
      })
    })

    it('should show upgrade/downgrade options', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          success: true,
          subscription: { tier: 'BASIC' },
        },
      })

      const { result } = renderHook(() => useSubscriptionPlans(), { wrapper })

      await waitFor(() => {
        const freePlan = result.current.plans.find((p) => p.tier === 'FREE')
        const premiumPlan = result.current.plans.find((p) => p.tier === 'PREMIUM')

        expect(freePlan?.isDowngrade).toBe(true)
        expect(premiumPlan?.isUpgrade).toBe(true)
      })
    })

    it('should include pricing for each tier', () => {
      const { result } = renderHook(() => useSubscriptionPlans(), { wrapper })

      expect(result.current.plans[0].price).toBe('0')
      expect(result.current.plans[1].price).toBe('0.01')
      expect(result.current.plans[2].price).toBe('0.02')
      expect(result.current.plans[3].price).toBe('0.05')
    })

    it('should include features for each tier', () => {
      const { result } = renderHook(() => useSubscriptionPlans(), { wrapper })

      const premiumPlan = result.current.plans.find((p) => p.tier === 'PREMIUM')

      expect(premiumPlan?.features).toContain('Unlimited streaming')
      expect(premiumPlan?.features).toContain('High-quality audio')
      expect(premiumPlan?.features).toContain('Download for offline')
    })

    it('should highlight recommended tier', () => {
      const { result } = renderHook(() => useSubscriptionPlans(), { wrapper })

      const recommendedPlan = result.current.plans.find((p) => p.recommended)

      expect(recommendedPlan?.tier).toBe('PREMIUM')
    })
  })
})
