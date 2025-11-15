/**
 * Search and Discovery API Routes
 * Full-text search, recommendations, trending, discovery
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { query, param, validationResult } from 'express-validator';

export function createSearchRouter(pool: Pool): Router {
  const router = Router();

  // ============================================================================
  // SEARCH ENDPOINTS
  // ============================================================================

  /**
   * Universal search across songs, artists, playlists
   * GET /api/search?q=query&type=all&limit=20
   */
  router.get(
    '/',
    query('q').notEmpty().trim().isLength({ min: 1, max: 200 }),
    query('type').optional().isIn(['all', 'songs', 'artists', 'playlists', 'users']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('userAddress').optional().isEthereumAddress(),
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const searchQuery = req.query.q as string;
      const searchType = (req.query.type as string) || 'all';
      const limit = parseInt(req.query.limit as string) || 20;
      const userAddress = req.query.userAddress as string | undefined;

      try {
        let results;

        if (searchType === 'all') {
          // Use comprehensive search function
          const result = await pool.query(
            `SELECT * FROM search_all($1, $2, $3)`,
            [searchQuery, userAddress || null, limit]
          );
          results = result.rows;
        } else {
          // Type-specific search
          results = await performTypedSearch(pool, searchQuery, searchType, limit);
        }

        res.json({
          query: searchQuery,
          type: searchType,
          results,
          count: results.length,
        });
      } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
      }
    }
  );

  /**
   * Search autocomplete/suggestions
   * GET /api/search/suggestions?q=part
   */
  router.get(
    '/suggestions',
    query('q').notEmpty().trim().isLength({ min: 1, max: 100 }),
    query('limit').optional().isInt({ min: 1, max: 20 }),
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const searchQuery = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;

      try {
        const result = await pool.query(
          `SELECT suggestion, suggestion_type, popularity_score
           FROM search_suggestions
           WHERE suggestion ILIKE $1
           ORDER BY popularity_score DESC, suggestion ASC
           LIMIT $2`,
          [`${searchQuery}%`, limit]
        );

        res.json({
          suggestions: result.rows,
        });
      } catch (error) {
        console.error('Suggestions error:', error);
        res.status(500).json({ error: 'Failed to fetch suggestions' });
      }
    }
  );

  /**
   * Search history for a user
   * GET /api/search/history/:userAddress
   */
  router.get(
    '/history/:userAddress',
    param('userAddress').isEthereumAddress(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    async (req: Request, res: Response) => {
      const { userAddress } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;

      try {
        const result = await pool.query(
          `SELECT DISTINCT ON (search_query)
             search_query,
             search_type,
             searched_at
           FROM search_history
           WHERE user_address = $1
           ORDER BY search_query, searched_at DESC
           LIMIT $2`,
          [userAddress, limit]
        );

        res.json({
          history: result.rows,
        });
      } catch (error) {
        console.error('Search history error:', error);
        res.status(500).json({ error: 'Failed to fetch search history' });
      }
    }
  );

  // ============================================================================
  // DISCOVERY ENDPOINTS
  // ============================================================================

  /**
   * Get trending songs
   * GET /api/search/trending?genre=Electronic&limit=20
   */
  router.get(
    '/trending',
    query('genre').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    async (req: Request, res: Response) => {
      const genre = req.query.genre as string | undefined;
      const limit = parseInt(req.query.limit as string) || 20;

      try {
        let query = `
          SELECT
            song_id,
            title,
            artist_address,
            artist_name,
            genre,
            strategy,
            trending_score,
            play_count_7d,
            comment_count_7d,
            playlist_adds_7d
          FROM mv_trending_songs
        `;

        const params: any[] = [];

        if (genre) {
          params.push(genre);
          query += ` WHERE genre = $1`;
        }

        params.push(limit);
        query += ` ORDER BY trending_score DESC LIMIT $${params.length}`;

        const result = await pool.query(query, params);

        res.json({
          trending: result.rows,
          genre: genre || 'all',
        });
      } catch (error) {
        console.error('Trending error:', error);
        res.status(500).json({ error: 'Failed to fetch trending songs' });
      }
    }
  );

  /**
   * Get rising artists
   * GET /api/search/rising?limit=20
   */
  router.get(
    '/rising',
    query('limit').optional().isInt({ min: 1, max: 100 }),
    async (req: Request, res: Response) => {
      const limit = parseInt(req.query.limit as string) || 20;

      try {
        const result = await pool.query(
          `SELECT
             artist_address,
             artist_name,
             follower_count,
             song_count,
             play_count_7d,
             new_followers_7d,
             rising_score,
             artist_since
           FROM mv_rising_artists
           ORDER BY rising_score DESC
           LIMIT $1`,
          [limit]
        );

        res.json({
          rising: result.rows,
        });
      } catch (error) {
        console.error('Rising artists error:', error);
        res.status(500).json({ error: 'Failed to fetch rising artists' });
      }
    }
  );

  /**
   * Get personalized recommendations for a user
   * GET /api/search/recommendations/:userAddress?limit=20
   */
  router.get(
    '/recommendations/:userAddress',
    param('userAddress').isEthereumAddress(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    async (req: Request, res: Response) => {
      const { userAddress } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;

      try {
        const result = await pool.query(
          `SELECT * FROM get_personalized_recommendations($1, $2)`,
          [userAddress, limit]
        );

        res.json({
          recommendations: result.rows,
          personalized: true,
        });
      } catch (error) {
        console.error('Recommendations error:', error);
        res.status(500).json({ error: 'Failed to fetch recommendations' });
      }
    }
  );

  /**
   * Get similar songs
   * GET /api/search/similar/:songId?limit=10
   */
  router.get(
    '/similar/:songId',
    param('songId').notEmpty(),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    async (req: Request, res: Response) => {
      const { songId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      try {
        const result = await pool.query(
          `SELECT * FROM get_similar_songs($1, $2)`,
          [songId, limit]
        );

        res.json({
          similar: result.rows,
          basedOn: songId,
        });
      } catch (error) {
        console.error('Similar songs error:', error);
        res.status(500).json({ error: 'Failed to fetch similar songs' });
      }
    }
  );

  /**
   * Get genre trends
   * GET /api/search/genres/trending
   */
  router.get('/genres/trending', async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT
           genre,
           song_count,
           artist_count,
           total_plays_7d,
           avg_trending_score,
           top_songs
         FROM mv_genre_trends
         ORDER BY total_plays_7d DESC
         LIMIT 20`
      );

      res.json({
        genres: result.rows,
      });
    } catch (error) {
      console.error('Genre trends error:', error);
      res.status(500).json({ error: 'Failed to fetch genre trends' });
    }
  });

  /**
   * Discover new music for user
   * GET /api/search/discover/:userAddress?mode=balanced
   */
  router.get(
    '/discover/:userAddress',
    param('userAddress').isEthereumAddress(),
    query('mode').optional().isIn(['conservative', 'balanced', 'adventurous']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    async (req: Request, res: Response) => {
      const { userAddress } = req.params;
      const mode = (req.query.mode as string) || 'balanced';
      const limit = parseInt(req.query.limit as string) || 30;

      try {
        // Get user preferences
        const prefsResult = await pool.query(
          `SELECT * FROM user_preferences WHERE user_address = $1`,
          [userAddress]
        );

        const prefs = prefsResult.rows[0] || { discovery_mode: 'balanced' };

        // Mix of different discovery sources based on mode
        const [recommendations, trending, similar] = await Promise.all([
          // Personalized recommendations
          pool.query(
            `SELECT * FROM get_personalized_recommendations($1, $2)`,
            [userAddress, Math.floor(limit * 0.5)]
          ),
          // Trending songs
          pool.query(
            `SELECT song_id, title, artist_name, genre, 'trending' as source
             FROM mv_trending_songs
             ORDER BY trending_score DESC
             LIMIT $1`,
            [Math.floor(limit * 0.3)]
          ),
          // Random exploration (for adventurous mode)
          pool.query(
            `SELECT s.song_id, s.title, a.name as artist_name, s.genre, 'explore' as source
             FROM songs s
             LEFT JOIN artists a ON s.artist_address = a.artist_address
             WHERE s.created_at >= NOW() - INTERVAL '90 days'
             ORDER BY RANDOM()
             LIMIT $1`,
            [mode === 'adventurous' ? Math.floor(limit * 0.2) : 0]
          ),
        ]);

        // Combine and shuffle
        const combined = [
          ...recommendations.rows.map((r: any) => ({ ...r, source: 'recommended' })),
          ...trending.rows,
          ...similar.rows,
        ];

        // Shuffle array
        for (let i = combined.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [combined[i], combined[j]] = [combined[j], combined[i]];
        }

        res.json({
          discover: combined.slice(0, limit),
          mode,
        });
      } catch (error) {
        console.error('Discovery error:', error);
        res.status(500).json({ error: 'Failed to fetch discovery feed' });
      }
    }
  );

  // ============================================================================
  // ADVANCED FILTERS
  // ============================================================================

  /**
   * Advanced song search with filters
   * POST /api/search/advanced
   */
  router.post(
    '/advanced',
    async (req: Request, res: Response) => {
      const {
        query: searchQuery,
        genres,
        strategies,
        minPlays,
        maxPlays,
        dateFrom,
        dateTo,
        sortBy,
        sortOrder,
        limit,
        offset,
      } = req.body;

      try {
        let sql = `
          SELECT
            s.song_id,
            s.title,
            s.artist_address,
            a.name as artist_name,
            s.genre,
            s.strategy,
            s.created_at,
            COALESCE(sa.play_count, 0) as play_count,
            COALESCE(sa.total_earnings, 0) as total_earnings
          FROM songs s
          LEFT JOIN artists a ON s.artist_address = a.artist_address
          LEFT JOIN mv_song_analytics sa ON s.song_id = sa.song_id
          WHERE 1=1
        `;

        const params: any[] = [];

        // Text search
        if (searchQuery) {
          params.push(searchQuery);
          sql += ` AND to_tsvector('music_search', s.title) @@ plainto_tsquery('music_search', $${params.length})`;
        }

        // Genre filter
        if (genres && genres.length > 0) {
          params.push(genres);
          sql += ` AND s.genre = ANY($${params.length})`;
        }

        // Strategy filter
        if (strategies && strategies.length > 0) {
          params.push(strategies);
          sql += ` AND s.strategy = ANY($${params.length})`;
        }

        // Play count filter
        if (minPlays !== undefined) {
          params.push(minPlays);
          sql += ` AND COALESCE(sa.play_count, 0) >= $${params.length}`;
        }

        if (maxPlays !== undefined) {
          params.push(maxPlays);
          sql += ` AND COALESCE(sa.play_count, 0) <= $${params.length}`;
        }

        // Date filter
        if (dateFrom) {
          params.push(dateFrom);
          sql += ` AND s.created_at >= $${params.length}`;
        }

        if (dateTo) {
          params.push(dateTo);
          sql += ` AND s.created_at <= $${params.length}`;
        }

        // Sorting
        const validSortFields = ['title', 'created_at', 'play_count', 'total_earnings'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
        const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

        sql += ` ORDER BY ${sortField} ${sortDirection}`;

        // Pagination
        params.push(limit || 20);
        sql += ` LIMIT $${params.length}`;

        if (offset) {
          params.push(offset);
          sql += ` OFFSET $${params.length}`;
        }

        const result = await pool.query(sql, params);

        res.json({
          results: result.rows,
          count: result.rows.length,
          filters: { genres, strategies, minPlays, maxPlays, dateFrom, dateTo },
        });
      } catch (error) {
        console.error('Advanced search error:', error);
        res.status(500).json({ error: 'Advanced search failed' });
      }
    }
  );

  // ============================================================================
  // UTILITY ENDPOINTS
  // ============================================================================

  /**
   * Record listening event (for recommendations)
   * POST /api/search/listen
   */
  router.post('/listen', async (req: Request, res: Response) => {
    const {
      listenerAddress,
      songId,
      artistAddress,
      genre,
      strategy,
      playDuration,
      completed,
      skipped,
      liked,
    } = req.body;

    try {
      await pool.query(
        `INSERT INTO listening_history
         (listener_address, song_id, artist_address, genre, strategy, play_duration, completed, skipped, liked)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [listenerAddress, songId, artistAddress, genre, strategy, playDuration, completed, skipped, liked]
      );

      res.json({ success: true });
    } catch (error) {
      console.error('Listening history error:', error);
      res.status(500).json({ error: 'Failed to record listening event' });
    }
  });

  /**
   * Update user preferences
   * PUT /api/search/preferences/:userAddress
   */
  router.put(
    '/preferences/:userAddress',
    param('userAddress').isEthereumAddress(),
    async (req: Request, res: Response) => {
      const { userAddress } = req.params;
      const { favoriteGenres, favoriteStrategies, discoveryMode } = req.body;

      try {
        const result = await pool.query(
          `INSERT INTO user_preferences (user_address, favorite_genres, favorite_strategies, discovery_mode)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_address) DO UPDATE SET
             favorite_genres = COALESCE($2, user_preferences.favorite_genres),
             favorite_strategies = COALESCE($3, user_preferences.favorite_strategies),
             discovery_mode = COALESCE($4, user_preferences.discovery_mode),
             updated_at = NOW()
           RETURNING *`,
          [
            userAddress,
            favoriteGenres ? JSON.stringify(favoriteGenres) : null,
            favoriteStrategies ? JSON.stringify(favoriteStrategies) : null,
            discoveryMode,
          ]
        );

        res.json({ preferences: result.rows[0] });
      } catch (error) {
        console.error('Preferences error:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
      }
    }
  );

  /**
   * Refresh discovery materialized views
   * POST /api/search/refresh (admin only)
   */
  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      await pool.query('SELECT refresh_discovery_views()');
      res.json({ success: true, message: 'Discovery views refreshed' });
    } catch (error) {
      console.error('Refresh error:', error);
      res.status(500).json({ error: 'Failed to refresh views' });
    }
  });

  return router;
}

// Helper function for typed search
async function performTypedSearch(
  pool: Pool,
  searchQuery: string,
  searchType: string,
  limit: number
) {
  switch (searchType) {
    case 'songs':
      const songsResult = await pool.query(
        `SELECT
           s.song_id,
           s.title,
           s.artist_address,
           a.name as artist_name,
           s.genre,
           s.strategy,
           s.cover_art_url,
           ts_rank(
             to_tsvector('music_search', coalesce(s.title, '')),
             plainto_tsquery('music_search', $1)
           ) as relevance
         FROM songs s
         LEFT JOIN artists a ON s.artist_address = a.artist_address
         WHERE to_tsvector('music_search', coalesce(s.title, ''))
           @@ plainto_tsquery('music_search', $1)
         ORDER BY relevance DESC
         LIMIT $2`,
        [searchQuery, limit]
      );
      return songsResult.rows;

    case 'artists':
      const artistsResult = await pool.query(
        `SELECT
           a.artist_address,
           a.name,
           a.bio,
           up.avatar_url,
           ts_rank(
             to_tsvector('music_search', coalesce(a.name, '')),
             plainto_tsquery('music_search', $1)
           ) as relevance
         FROM artists a
         LEFT JOIN user_profiles up ON a.artist_address = up.wallet_address
         WHERE to_tsvector('music_search', coalesce(a.name, ''))
           @@ plainto_tsquery('music_search', $1)
         ORDER BY relevance DESC
         LIMIT $2`,
        [searchQuery, limit]
      );
      return artistsResult.rows;

    case 'playlists':
      const playlistsResult = await pool.query(
        `SELECT
           p.playlist_id,
           p.name,
           p.description,
           p.cover_image_url,
           p.owner_address,
           ts_rank(
             to_tsvector('music_search', coalesce(p.name, '')),
             plainto_tsquery('music_search', $1)
           ) as relevance
         FROM playlists p
         WHERE p.is_public = TRUE
           AND to_tsvector('music_search', coalesce(p.name, ''))
           @@ plainto_tsquery('music_search', $1)
         ORDER BY relevance DESC
         LIMIT $2`,
        [searchQuery, limit]
      );
      return playlistsResult.rows;

    default:
      return [];
  }
}
