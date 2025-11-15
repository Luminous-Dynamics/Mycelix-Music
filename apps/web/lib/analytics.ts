/**
 * Frontend Analytics
 * Track user interactions and events in the frontend
 */

// ============================================================================
// Analytics Event Types
// ============================================================================

export enum AnalyticsEvent {
  // User authentication
  WALLET_CONNECTED = 'wallet_connected',
  WALLET_DISCONNECTED = 'wallet_disconnected',
  USER_SIGNED_IN = 'user_signed_in',
  USER_SIGNED_OUT = 'user_signed_out',

  // Song interactions
  SONG_VIEWED = 'song_viewed',
  SONG_PLAYED = 'song_played',
  SONG_PAUSED = 'song_paused',
  SONG_COMPLETED = 'song_completed',
  SONG_SHARED = 'song_shared',

  // Artist actions
  SONG_UPLOAD_STARTED = 'song_upload_started',
  SONG_UPLOAD_COMPLETED = 'song_upload_completed',
  SONG_UPLOAD_FAILED = 'song_upload_failed',
  STRATEGY_SELECTED = 'strategy_selected',
  ROYALTY_CONFIGURED = 'royalty_configured',

  // Payments
  PAYMENT_INITIATED = 'payment_initiated',
  PAYMENT_CONFIRMED = 'payment_confirmed',
  PAYMENT_FAILED = 'payment_failed',

  // Discovery
  SEARCH_PERFORMED = 'search_performed',
  ARTIST_FOLLOWED = 'artist_followed',
  PLAYLIST_CREATED = 'playlist_created',

  // Errors
  ERROR_OCCURRED = 'error_occurred',
  NETWORK_ERROR = 'network_error',
}

// ============================================================================
// Analytics Event Interface
// ============================================================================

export interface AnalyticsEventData {
  event: AnalyticsEvent;
  properties?: Record<string, any>;
  userAddress?: string;
  timestamp?: number;
}

// ============================================================================
// Analytics Service
// ============================================================================

class Analytics {
  private enabled: boolean;
  private userId: string | null = null;
  private sessionId: string;

  constructor() {
    this.enabled = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true';
    this.sessionId = this.generateSessionId();
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Set user ID (wallet address)
   */
  setUserId(address: string) {
    this.userId = address;
  }

  /**
   * Clear user ID on logout
   */
  clearUserId() {
    this.userId = null;
  }

  /**
   * Track event
   */
  track(event: AnalyticsEvent, properties?: Record<string, any>) {
    if (!this.enabled) {
      return;
    }

    const eventData: AnalyticsEventData = {
      event,
      properties: {
        ...properties,
        sessionId: this.sessionId,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      },
      userAddress: this.userId || undefined,
      timestamp: Date.now(),
    };

    // Send to analytics backend
    this.send(eventData);

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', event, properties);
    }
  }

  /**
   * Track page view
   */
  pageView(path: string) {
    this.track(AnalyticsEvent.SONG_VIEWED, {
      path,
      title: typeof document !== 'undefined' ? document.title : undefined,
    });
  }

  /**
   * Track error
   */
  trackError(error: Error, context?: Record<string, any>) {
    this.track(AnalyticsEvent.ERROR_OCCURRED, {
      error: error.message,
      stack: error.stack,
      ...context,
    });
  }

  /**
   * Send event to backend
   */
  private async send(eventData: AnalyticsEventData) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      // Send to our API
      await fetch(`${apiUrl}/api/analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
        keepalive: true, // Ensure events are sent even on page unload
      });

      // Also send to Prometheus via /metrics endpoint
      // This is handled by incrementing counters on the backend
    } catch (error) {
      // Silently fail - don't disrupt user experience
      console.error('[Analytics] Failed to send event:', error);
    }
  }

  /**
   * Track song play with duration
   */
  trackSongPlay(songId: string, duration: number, completed: boolean) {
    this.track(completed ? AnalyticsEvent.SONG_COMPLETED : AnalyticsEvent.SONG_PAUSED, {
      songId,
      duration,
      completed,
    });
  }

  /**
   * Track payment flow
   */
  trackPayment(
    songId: string,
    strategy: string,
    amount: string,
    status: 'initiated' | 'confirmed' | 'failed'
  ) {
    const eventMap = {
      initiated: AnalyticsEvent.PAYMENT_INITIATED,
      confirmed: AnalyticsEvent.PAYMENT_CONFIRMED,
      failed: AnalyticsEvent.PAYMENT_FAILED,
    };

    this.track(eventMap[status], {
      songId,
      strategy,
      amount,
    });
  }

  /**
   * Track upload flow
   */
  trackUpload(
    status: 'started' | 'completed' | 'failed',
    metadata?: {
      songId?: string;
      strategy?: string;
      fileSize?: number;
      duration?: number;
      error?: string;
    }
  ) {
    const eventMap = {
      started: AnalyticsEvent.SONG_UPLOAD_STARTED,
      completed: AnalyticsEvent.SONG_UPLOAD_COMPLETED,
      failed: AnalyticsEvent.SONG_UPLOAD_FAILED,
    };

    this.track(eventMap[status], metadata);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const analytics = new Analytics();

// ============================================================================
// React Hook for Analytics
// ============================================================================

import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * Hook to track page views automatically
 */
export function useAnalytics() {
  const router = useRouter();

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      analytics.pageView(url);
    };

    // Track initial page view
    analytics.pageView(router.pathname);

    // Track subsequent route changes
    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);

  return analytics;
}

// ============================================================================
// Performance Monitoring
// ============================================================================

/**
 * Track Web Vitals (Core Web Vitals + custom metrics)
 */
export function trackWebVitals(metric: any) {
  analytics.track('web_vital' as AnalyticsEvent, {
    name: metric.name,
    value: metric.value,
    id: metric.id,
    label: metric.label,
  });
}
