/**
 * Analytics Middleware
 * Tracks API usage, performance metrics, and business events
 */

import { Request, Response, NextFunction } from 'express';
import { Counter, Histogram, register } from 'prom-client';

// ============================================================================
// Prometheus Metrics
// ============================================================================

// HTTP request counter
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

// HTTP request duration histogram
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

// Business metrics
export const songsUploaded = new Counter({
  name: 'songs_uploaded_total',
  help: 'Total number of songs uploaded',
  labelNames: ['artist'],
});

export const playsRecorded = new Counter({
  name: 'plays_total',
  help: 'Total number of plays recorded',
  labelNames: ['song_id', 'strategy'],
});

export const paymentsProcessed = new Counter({
  name: 'payments_processed_total',
  help: 'Total payments processed',
  labelNames: ['strategy', 'status'],
});

export const paymentAmount = new Counter({
  name: 'payment_amount_total',
  help: 'Total payment amount in wei',
  labelNames: ['strategy', 'token'],
});

export const uniqueListeners = new Counter({
  name: 'unique_listeners_total',
  help: 'Total unique listeners',
});

export const activeUsers = new Counter({
  name: 'active_users_total',
  help: 'Total active users (artists + listeners)',
  labelNames: ['role'],
});

// Database query metrics
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

export const dbQueriesTotal = new Counter({
  name: 'db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
});

// Cache metrics
export const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['key_prefix'],
});

export const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['key_prefix'],
});

// Error metrics
export const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'route'],
});

// ============================================================================
// Analytics Middleware
// ============================================================================

export const analyticsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();

  // Store original end function
  const originalEnd = res.end;

  // Override end function to capture metrics
  res.end = function (
    ...args: any[]
  ): Response {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    const method = req.method;
    const status = res.statusCode.toString();

    // Record metrics
    httpRequestsTotal.labels(method, route, status).inc();
    httpRequestDuration.labels(method, route, status).observe(duration);

    // Track errors
    if (res.statusCode >= 400) {
      const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error';
      errorsTotal.labels(errorType, route).inc();
    }

    // Call original end function
    return originalEnd.apply(res, args);
  };

  next();
};

// ============================================================================
// Business Event Tracking
// ============================================================================

export class AnalyticsService {
  /**
   * Track song upload event
   */
  static trackSongUpload(artistAddress: string, songId: string) {
    songsUploaded.labels(artistAddress).inc();
    activeUsers.labels('artist').inc();
  }

  /**
   * Track play event
   */
  static trackPlay(songId: string, strategy: string, listenerAddress: string) {
    playsRecorded.labels(songId, strategy).inc();
    activeUsers.labels('listener').inc();
  }

  /**
   * Track payment event
   */
  static trackPayment(
    strategy: string,
    token: string,
    amount: string,
    status: 'success' | 'failed'
  ) {
    paymentsProcessed.labels(strategy, status).inc();

    if (status === 'success') {
      paymentAmount.labels(strategy, token).inc(parseFloat(amount));
    }
  }

  /**
   * Track database query
   */
  static trackDbQuery(
    operation: string,
    table: string,
    duration: number,
    status: 'success' | 'error'
  ) {
    dbQueryDuration.labels(operation, table).observe(duration / 1000);
    dbQueriesTotal.labels(operation, table, status).inc();
  }

  /**
   * Track cache operation
   */
  static trackCache(keyPrefix: string, hit: boolean) {
    if (hit) {
      cacheHits.labels(keyPrefix).inc();
    } else {
      cacheMisses.labels(keyPrefix).inc();
    }
  }

  /**
   * Track error
   */
  static trackError(errorType: string, route: string) {
    errorsTotal.labels(errorType, route).inc();
  }
}

// ============================================================================
// Metrics Endpoint
// ============================================================================

export const metricsHandler = async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error);
  }
};
