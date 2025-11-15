/**
 * Optimized Database Queries
 * Leverages materialized views for fast analytics
 */

import { Pool } from 'pg';

export class OptimizedQueries {
  constructor(private pool: Pool) {}

  /**
   * Get artist analytics from materialized view
   * Much faster than computing from raw tables
   */
  async getArtistAnalytics(artistAddress: string) {
    const result = await this.pool.query(
      `SELECT
        artist_address,
        artist_name,
        total_songs,
        total_plays,
        unique_listeners,
        total_earnings,
        avg_earning_per_play,
        last_play_date,
        plays_last_30_days,
        plays_last_7_days,
        last_refreshed
      FROM mv_artist_analytics
      WHERE artist_address = $1`,
      [artistAddress]
    );

    return result.rows[0] || null;
  }

  /**
   * Get top artists by earnings
   */
  async getTopArtistsByEarnings(limit: number = 10, offset: number = 0) {
    const result = await this.pool.query(
      `SELECT
        artist_address,
        artist_name,
        total_earnings,
        total_plays,
        unique_listeners,
        total_songs
      FROM mv_artist_analytics
      ORDER BY total_earnings DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return result.rows;
  }

  /**
   * Get song analytics from materialized view
   */
  async getSongAnalytics(songId: string) {
    const result = await this.pool.query(
      `SELECT
        song_id,
        title,
        artist_address,
        genre,
        strategy,
        play_count,
        unique_listeners,
        total_earnings,
        avg_play_duration,
        avg_earning_per_play,
        last_played,
        first_played,
        plays_last_7_days,
        plays_last_30_days,
        trending_score,
        last_refreshed
      FROM mv_song_analytics
      WHERE song_id = $1`,
      [songId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get trending songs (last 7 days)
   */
  async getTrendingSongs(limit: number = 20, genre?: string) {
    let query = `
      SELECT
        song_id,
        title,
        artist_address,
        genre,
        trending_score,
        play_count,
        plays_last_7_days
      FROM mv_song_analytics
      WHERE trending_score > 0
    `;

    const params: any[] = [];

    if (genre) {
      params.push(genre);
      query += ` AND genre = $${params.length}`;
    }

    params.push(limit);
    query += ` ORDER BY trending_score DESC LIMIT $${params.length}`;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Get popular songs by play count
   */
  async getPopularSongs(limit: number = 20, strategy?: string) {
    let query = `
      SELECT
        song_id,
        title,
        artist_address,
        genre,
        strategy,
        play_count,
        unique_listeners,
        total_earnings
      FROM mv_song_analytics
    `;

    const params: any[] = [];

    if (strategy) {
      params.push(strategy);
      query += ` WHERE strategy = $${params.length}`;
    }

    params.push(limit);
    query += ` ORDER BY play_count DESC LIMIT $${params.length}`;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Get platform statistics
   */
  async getPlatformStats() {
    const result = await this.pool.query(
      `SELECT
        total_artists,
        total_songs,
        total_plays,
        total_listeners,
        total_volume,
        avg_payment,
        songs_pay_per_stream,
        songs_gift_economy,
        songs_patronage,
        songs_auction,
        plays_last_24h,
        plays_last_7d,
        plays_last_30d,
        new_songs_last_7d,
        new_songs_last_30d,
        last_refreshed
      FROM mv_platform_stats
      LIMIT 1`
    );

    return result.rows[0] || null;
  }

  /**
   * Get top songs this week
   */
  async getTopSongsThisWeek(limit: number = 20) {
    const result = await this.pool.query(
      `SELECT
        song_id,
        title,
        artist_address,
        artist_name,
        genre,
        plays,
        rank
      FROM mv_top_songs_week
      WHERE rank <= $1
      ORDER BY rank ASC`,
      [limit]
    );

    return result.rows;
  }

  /**
   * Get listener activity and preferences
   */
  async getListenerActivity(listenerAddress: string) {
    const result = await this.pool.query(
      `SELECT
        listener_address,
        total_plays,
        unique_songs_played,
        unique_artists,
        total_spent,
        avg_spent_per_play,
        last_active,
        first_active,
        favorite_genre,
        favorite_strategy,
        plays_last_7d,
        plays_last_30d,
        last_refreshed
      FROM mv_listener_activity
      WHERE listener_address = $1`,
      [listenerAddress]
    );

    return result.rows[0] || null;
  }

  /**
   * Get most active listeners
   */
  async getMostActiveListeners(limit: number = 10) {
    const result = await this.pool.query(
      `SELECT
        listener_address,
        total_plays,
        unique_songs_played,
        unique_artists,
        total_spent,
        plays_last_30d
      FROM mv_listener_activity
      ORDER BY total_plays DESC
      LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  /**
   * Get genre statistics
   */
  async getGenreStats() {
    const result = await this.pool.query(
      `SELECT
        genre,
        total_songs,
        total_artists,
        total_plays,
        total_earnings,
        avg_earning_per_play,
        unique_listeners,
        plays_last_7d,
        popularity_rank
      FROM mv_genre_stats
      ORDER BY popularity_rank ASC`
    );

    return result.rows;
  }

  /**
   * Get songs by strategy
   */
  async getSongsByStrategy(strategy: string, limit: number = 20) {
    const result = await this.pool.query(
      `SELECT
        song_id,
        title,
        artist_address,
        genre,
        play_count,
        total_earnings,
        unique_listeners
      FROM mv_song_analytics
      WHERE strategy = $1
      ORDER BY play_count DESC
      LIMIT $2`,
      [strategy, limit]
    );

    return result.rows;
  }

  /**
   * Search songs with full-text search
   * Uses indexes for performance
   */
  async searchSongs(query: string, limit: number = 20) {
    const result = await this.pool.query(
      `SELECT
        s.song_id,
        s.title,
        s.artist_address,
        a.name as artist_name,
        s.genre,
        sa.play_count,
        sa.total_earnings
      FROM songs s
      LEFT JOIN artists a ON s.artist_address = a.artist_address
      LEFT JOIN mv_song_analytics sa ON s.song_id = sa.song_id
      WHERE
        s.title ILIKE $1 OR
        a.name ILIKE $1 OR
        s.genre ILIKE $1
      ORDER BY sa.play_count DESC NULLS LAST
      LIMIT $2`,
      [`%${query}%`, limit]
    );

    return result.rows;
  }

  /**
   * Get artist dashboard data (optimized single query)
   */
  async getArtistDashboard(artistAddress: string) {
    const [analytics, topSongs, recentPlays] = await Promise.all([
      // Artist analytics from materialized view
      this.getArtistAnalytics(artistAddress),

      // Top songs by this artist
      this.pool.query(
        `SELECT
          song_id,
          title,
          genre,
          strategy,
          play_count,
          total_earnings,
          plays_last_7_days,
          plays_last_30_days
        FROM mv_song_analytics
        WHERE artist_address = $1
        ORDER BY play_count DESC
        LIMIT 10`,
        [artistAddress]
      ),

      // Recent plays (last 50)
      this.pool.query(
        `SELECT
          p.id,
          p.song_id,
          s.title,
          p.listener_address,
          p.amount_paid,
          p.played_at
        FROM plays p
        JOIN songs s ON p.song_id = s.song_id
        WHERE s.artist_address = $1
        ORDER BY p.played_at DESC
        LIMIT 50`,
        [artistAddress]
      ),
    ]);

    return {
      analytics,
      topSongs: topSongs.rows,
      recentPlays: recentPlays.rows,
    };
  }

  /**
   * Get listener dashboard data (optimized single query)
   */
  async getListenerDashboard(listenerAddress: string) {
    const [activity, recentPlays, favoriteArtists] = await Promise.all([
      // Listener activity from materialized view
      this.getListenerActivity(listenerAddress),

      // Recent plays
      this.pool.query(
        `SELECT
          p.id,
          p.song_id,
          s.title,
          s.artist_address,
          a.name as artist_name,
          p.amount_paid,
          p.played_at,
          p.duration
        FROM plays p
        JOIN songs s ON p.song_id = s.song_id
        LEFT JOIN artists a ON s.artist_address = a.artist_address
        WHERE p.listener_address = $1
        ORDER BY p.played_at DESC
        LIMIT 50`,
        [listenerAddress]
      ),

      // Favorite artists (most played)
      this.pool.query(
        `SELECT
          s.artist_address,
          a.name as artist_name,
          COUNT(*) as play_count,
          SUM(p.amount_paid) as total_spent
        FROM plays p
        JOIN songs s ON p.song_id = s.song_id
        LEFT JOIN artists a ON s.artist_address = a.artist_address
        WHERE p.listener_address = $1
        GROUP BY s.artist_address, a.name
        ORDER BY play_count DESC
        LIMIT 10`,
        [listenerAddress]
      ),
    ]);

    return {
      activity,
      recentPlays: recentPlays.rows,
      favoriteArtists: favoriteArtists.rows,
    };
  }

  /**
   * Refresh all materialized views
   * Call this periodically (e.g., hourly via cron)
   */
  async refreshAllViews() {
    await this.pool.query('SELECT refresh_all_materialized_views()');
  }

  /**
   * Refresh artist-specific views
   * Call this after artist data changes
   */
  async refreshArtistViews(artistAddress: string) {
    await this.pool.query('SELECT refresh_artist_views($1)', [artistAddress]);
  }

  /**
   * Get query performance statistics
   */
  async getQueryStats() {
    const result = await this.pool.query(
      `SELECT
        schemaname,
        tablename,
        indexname,
        idx_scan as index_scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      ORDER BY idx_scan DESC
      LIMIT 20`
    );

    return result.rows;
  }

  /**
   * Get slow queries (requires pg_stat_statements extension)
   */
  async getSlowQueries(limit: number = 10) {
    try {
      const result = await this.pool.query(
        `SELECT
          query,
          calls,
          total_time,
          mean_time,
          max_time
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat_statements%'
        ORDER BY mean_time DESC
        LIMIT $1`,
        [limit]
      );

      return result.rows;
    } catch (error) {
      // pg_stat_statements extension not installed
      return [];
    }
  }

  /**
   * Get table sizes for monitoring
   */
  async getTableSizes() {
    const result = await this.pool.query(
      `SELECT
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC`
    );

    return result.rows;
  }
}

/**
 * Query builder for complex analytics
 */
export class AnalyticsQueryBuilder {
  private conditions: string[] = [];
  private params: any[] = [];
  private orderBy: string = 'play_count DESC';
  private limitValue: number = 20;
  private offsetValue: number = 0;

  genre(genre: string) {
    this.params.push(genre);
    this.conditions.push(`genre = $${this.params.length}`);
    return this;
  }

  strategy(strategy: string) {
    this.params.push(strategy);
    this.conditions.push(`strategy = $${this.params.length}`);
    return this;
  }

  minPlays(plays: number) {
    this.params.push(plays);
    this.conditions.push(`play_count >= $${this.params.length}`);
    return this;
  }

  minEarnings(earnings: number) {
    this.params.push(earnings);
    this.conditions.push(`total_earnings >= $${this.params.length}`);
    return this;
  }

  playedAfter(date: Date) {
    this.params.push(date);
    this.conditions.push(`last_played >= $${this.params.length}`);
    return this;
  }

  sortBy(field: 'play_count' | 'total_earnings' | 'trending_score' | 'last_played', direction: 'ASC' | 'DESC' = 'DESC') {
    this.orderBy = `${field} ${direction}`;
    return this;
  }

  limit(limit: number) {
    this.limitValue = limit;
    return this;
  }

  offset(offset: number) {
    this.offsetValue = offset;
    return this;
  }

  build() {
    let query = `
      SELECT
        song_id,
        title,
        artist_address,
        genre,
        strategy,
        play_count,
        total_earnings,
        trending_score,
        last_played
      FROM mv_song_analytics
    `;

    if (this.conditions.length > 0) {
      query += ` WHERE ${this.conditions.join(' AND ')}`;
    }

    this.params.push(this.limitValue);
    query += ` ORDER BY ${this.orderBy} LIMIT $${this.params.length}`;

    this.params.push(this.offsetValue);
    query += ` OFFSET $${this.params.length}`;

    return { query, params: this.params };
  }
}

/**
 * Cache wrapper for frequently accessed data
 */
export class QueryCache {
  private cache = new Map<string, { data: any; expires: number }>();
  private defaultTTL = 60 * 1000; // 1 minute

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expires) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  set(key: string, data: any, ttl: number = this.defaultTTL) {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl,
    });
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}
