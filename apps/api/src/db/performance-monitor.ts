/**
 * Database Performance Monitoring
 * Tracks query performance and detects issues
 */

import { Pool } from 'pg';
import { EventEmitter } from 'events';

interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: number;
  rows?: number;
  error?: Error;
}

interface PerformanceThresholds {
  slowQueryMs: number;
  connectionPoolWarning: number;
  materialized_view_staleness_hours: number;
}

export class DatabasePerformanceMonitor extends EventEmitter {
  private metrics: QueryMetrics[] = [];
  private maxMetricsHistory = 1000;
  private thresholds: PerformanceThresholds = {
    slowQueryMs: 1000, // 1 second
    connectionPoolWarning: 80, // 80% of pool used
    materialized_view_staleness_hours: 2, // 2 hours
  };

  constructor(private pool: Pool) {
    super();
    this.setupPoolMonitoring();
  }

  /**
   * Wrap query execution with performance tracking
   */
  async trackQuery<T>(
    queryFn: () => Promise<T>,
    queryName: string
  ): Promise<T> {
    const start = Date.now();
    let error: Error | undefined;
    let result: T;

    try {
      result = await queryFn();
      return result;
    } catch (err) {
      error = err as Error;
      throw err;
    } finally {
      const duration = Date.now() - start;
      const metric: QueryMetrics = {
        query: queryName,
        duration,
        timestamp: Date.now(),
        error,
      };

      this.recordMetric(metric);

      // Emit slow query warning
      if (duration > this.thresholds.slowQueryMs) {
        this.emit('slowQuery', metric);
      }

      // Emit error
      if (error) {
        this.emit('queryError', metric);
      }
    }
  }

  /**
   * Record query metric
   */
  private recordMetric(metric: QueryMetrics) {
    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics.shift();
    }
  }

  /**
   * Get performance statistics
   */
  getStats(timeWindowMs: number = 60000) {
    const cutoff = Date.now() - timeWindowMs;
    const recentMetrics = this.metrics.filter((m) => m.timestamp >= cutoff);

    if (recentMetrics.length === 0) {
      return null;
    }

    const durations = recentMetrics.map((m) => m.duration);
    const errors = recentMetrics.filter((m) => m.error);

    return {
      totalQueries: recentMetrics.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      p50Duration: this.percentile(durations, 50),
      p95Duration: this.percentile(durations, 95),
      p99Duration: this.percentile(durations, 99),
      errorCount: errors.length,
      errorRate: errors.length / recentMetrics.length,
      slowQueryCount: recentMetrics.filter(
        (m) => m.duration > this.thresholds.slowQueryMs
      ).length,
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(arr: number[], p: number): number {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Get slow queries
   */
  getSlowQueries(limit: number = 10): QueryMetrics[] {
    return this.metrics
      .filter((m) => m.duration > this.thresholds.slowQueryMs)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get query errors
   */
  getErrors(limit: number = 10): QueryMetrics[] {
    return this.metrics
      .filter((m) => m.error)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Monitor connection pool health
   */
  private setupPoolMonitoring() {
    setInterval(() => {
      const poolStats = {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount,
        utilization: 0,
      };

      if (poolStats.total > 0) {
        poolStats.utilization =
          ((poolStats.total - poolStats.idle) / poolStats.total) * 100;
      }

      // Emit warning if pool is heavily utilized
      if (poolStats.utilization > this.thresholds.connectionPoolWarning) {
        this.emit('poolWarning', poolStats);
      }

      this.emit('poolStats', poolStats);
    }, 10000); // Every 10 seconds
  }

  /**
   * Check materialized view freshness
   */
  async checkViewFreshness(): Promise<
    Array<{ view: string; lastRefreshed: Date; hoursOld: number; stale: boolean }>
  > {
    const views = [
      'mv_artist_analytics',
      'mv_song_analytics',
      'mv_platform_stats',
      'mv_top_songs_week',
      'mv_listener_activity',
      'mv_genre_stats',
    ];

    const results = await Promise.all(
      views.map(async (view) => {
        const result = await this.pool.query(
          `SELECT last_refreshed FROM ${view} LIMIT 1`
        );

        const lastRefreshed = result.rows[0]?.last_refreshed || new Date(0);
        const hoursOld =
          (Date.now() - new Date(lastRefreshed).getTime()) / (1000 * 60 * 60);
        const stale = hoursOld > this.thresholds.materialized_view_staleness_hours;

        return {
          view,
          lastRefreshed,
          hoursOld,
          stale,
        };
      })
    );

    // Emit warnings for stale views
    results.forEach((result) => {
      if (result.stale) {
        this.emit('staleView', result);
      }
    });

    return results;
  }

  /**
   * Get database connection info
   */
  async getDatabaseInfo() {
    const versionResult = await this.pool.query('SELECT version()');
    const sizeResult = await this.pool.query(
      `SELECT pg_size_pretty(pg_database_size(current_database())) as size`
    );
    const connectionsResult = await this.pool.query(
      `SELECT count(*) as connections FROM pg_stat_activity WHERE datname = current_database()`
    );

    return {
      version: versionResult.rows[0].version,
      size: sizeResult.rows[0].size,
      connections: parseInt(connectionsResult.rows[0].connections),
      poolStats: {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount,
      },
    };
  }

  /**
   * Get table bloat information
   */
  async getTableBloat() {
    const result = await this.pool.query(`
      SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 10
    `);

    return result.rows;
  }

  /**
   * Get index usage statistics
   */
  async getIndexUsage() {
    const result = await this.pool.query(`
      SELECT
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch,
        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      ORDER BY idx_scan DESC
      LIMIT 20
    `);

    return result.rows;
  }

  /**
   * Find unused indexes
   */
  async getUnusedIndexes() {
    const result = await this.pool.query(`
      SELECT
        schemaname,
        tablename,
        indexname,
        idx_scan,
        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
        pg_relation_size(indexrelid) AS index_size_bytes
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
        AND idx_scan = 0
        AND indexrelname NOT LIKE '%_pkey'
      ORDER BY pg_relation_size(indexrelid) DESC
    `);

    return result.rows;
  }

  /**
   * Get cache hit ratio
   */
  async getCacheHitRatio() {
    const result = await this.pool.query(`
      SELECT
        sum(heap_blks_read) as heap_read,
        sum(heap_blks_hit) as heap_hit,
        sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100 AS cache_hit_ratio
      FROM pg_statio_user_tables
    `);

    return {
      heapRead: parseInt(result.rows[0].heap_read || '0'),
      heapHit: parseInt(result.rows[0].heap_hit || '0'),
      cacheHitRatio: parseFloat(result.rows[0].cache_hit_ratio || '0'),
    };
  }

  /**
   * Get long-running queries
   */
  async getLongRunningQueries() {
    const result = await this.pool.query(`
      SELECT
        pid,
        now() - pg_stat_activity.query_start AS duration,
        query,
        state
      FROM pg_stat_activity
      WHERE (now() - pg_stat_activity.query_start) > interval '1 minute'
        AND state != 'idle'
      ORDER BY duration DESC
    `);

    return result.rows;
  }

  /**
   * Analyze table statistics
   */
  async analyzeTable(tableName: string) {
    await this.pool.query(`ANALYZE ${tableName}`);
  }

  /**
   * Vacuum table
   */
  async vacuumTable(tableName: string, full: boolean = false) {
    const command = full ? `VACUUM FULL ${tableName}` : `VACUUM ${tableName}`;
    await this.pool.query(command);
  }

  /**
   * Get table statistics
   */
  async getTableStats(tableName: string) {
    const result = await this.pool.query(
      `SELECT
        schemaname,
        tablename,
        n_live_tup,
        n_dead_tup,
        n_mod_since_analyze,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables
      WHERE tablename = $1`,
      [tableName]
    );

    return result.rows[0] || null;
  }

  /**
   * Export metrics for Prometheus
   */
  getPrometheusMetrics(): string {
    const stats = this.getStats();
    if (!stats) return '';

    const metrics = [
      `# HELP db_query_total Total database queries`,
      `# TYPE db_query_total counter`,
      `db_query_total ${stats.totalQueries}`,
      ``,
      `# HELP db_query_duration_seconds Database query duration`,
      `# TYPE db_query_duration_seconds summary`,
      `db_query_duration_seconds{quantile="0.5"} ${stats.p50Duration / 1000}`,
      `db_query_duration_seconds{quantile="0.95"} ${stats.p95Duration / 1000}`,
      `db_query_duration_seconds{quantile="0.99"} ${stats.p99Duration / 1000}`,
      ``,
      `# HELP db_query_errors_total Total database query errors`,
      `# TYPE db_query_errors_total counter`,
      `db_query_errors_total ${stats.errorCount}`,
      ``,
      `# HELP db_slow_queries_total Total slow database queries`,
      `# TYPE db_slow_queries_total counter`,
      `db_slow_queries_total ${stats.slowQueryCount}`,
      ``,
      `# HELP db_pool_connections Database connection pool status`,
      `# TYPE db_pool_connections gauge`,
      `db_pool_connections{state="total"} ${this.pool.totalCount}`,
      `db_pool_connections{state="idle"} ${this.pool.idleCount}`,
      `db_pool_connections{state="waiting"} ${this.pool.waitingCount}`,
    ];

    return metrics.join('\n');
  }

  /**
   * Clear metrics history
   */
  clearMetrics() {
    this.metrics = [];
  }

  /**
   * Set performance thresholds
   */
  setThresholds(thresholds: Partial<PerformanceThresholds>) {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }
}

/**
 * Query plan analyzer
 */
export class QueryPlanAnalyzer {
  constructor(private pool: Pool) {}

  /**
   * Explain query plan
   */
  async explain(query: string, params: any[] = []) {
    const result = await this.pool.query(`EXPLAIN ${query}`, params);
    return result.rows.map((r) => r['QUERY PLAN']).join('\n');
  }

  /**
   * Explain analyze (actually executes query)
   */
  async explainAnalyze(query: string, params: any[] = []) {
    const result = await this.pool.query(`EXPLAIN ANALYZE ${query}`, params);
    return result.rows.map((r) => r['QUERY PLAN']).join('\n');
  }

  /**
   * Explain with detailed format
   */
  async explainDetailed(query: string, params: any[] = []) {
    const result = await this.pool.query(
      `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON) ${query}`,
      params
    );
    return result.rows[0]['QUERY PLAN'][0];
  }

  /**
   * Suggest indexes based on query plan
   */
  async suggestIndexes(query: string, params: any[] = []) {
    const plan = await this.explainDetailed(query, params);
    const suggestions: string[] = [];

    // Look for sequential scans in plan
    const findSeqScans = (node: any) => {
      if (node['Node Type'] === 'Seq Scan') {
        suggestions.push(
          `Consider adding index on ${node['Relation Name']} for columns in WHERE/JOIN clauses`
        );
      }

      if (node.Plans) {
        node.Plans.forEach(findSeqScans);
      }
    };

    findSeqScans(plan.Plan);

    return suggestions;
  }
}
