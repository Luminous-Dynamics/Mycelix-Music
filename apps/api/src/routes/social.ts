/**
 * Social Features API Routes
 * Following, Comments, Playlists, Profiles, Activity
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { body, param, query, validationResult } from 'express-validator';

export function createSocialRouter(pool: Pool): Router {
  const router = Router();

  // ============================================================================
  // FOLLOWING SYSTEM
  // ============================================================================

  /**
   * Follow an artist
   * POST /api/social/follow/:artistAddress
   */
  router.post(
    '/follow/:artistAddress',
    param('artistAddress').isEthereumAddress(),
    body('followerAddress').isEthereumAddress(),
    body('notificationsEnabled').optional().isBoolean(),
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { artistAddress } = req.params;
      const { followerAddress, notificationsEnabled = true } = req.body;

      // Prevent self-follow
      if (artistAddress.toLowerCase() === followerAddress.toLowerCase()) {
        return res.status(400).json({ error: 'Cannot follow yourself' });
      }

      try {
        const result = await pool.query(
          `INSERT INTO artist_followers (follower_address, artist_address, notifications_enabled)
           VALUES ($1, $2, $3)
           ON CONFLICT (follower_address, artist_address) DO NOTHING
           RETURNING id, followed_at`,
          [followerAddress, artistAddress, notificationsEnabled]
        );

        if (result.rows.length === 0) {
          return res.status(409).json({ error: 'Already following this artist' });
        }

        res.json({
          success: true,
          follow: result.rows[0],
        });
      } catch (error) {
        console.error('Error following artist:', error);
        res.status(500).json({ error: 'Failed to follow artist' });
      }
    }
  );

  /**
   * Unfollow an artist
   * DELETE /api/social/follow/:artistAddress
   */
  router.delete(
    '/follow/:artistAddress',
    param('artistAddress').isEthereumAddress(),
    query('followerAddress').isEthereumAddress(),
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { artistAddress } = req.params;
      const { followerAddress } = req.query;

      try {
        const result = await pool.query(
          `DELETE FROM artist_followers
           WHERE follower_address = $1 AND artist_address = $2
           RETURNING id`,
          [followerAddress, artistAddress]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Not following this artist' });
        }

        res.json({ success: true });
      } catch (error) {
        console.error('Error unfollowing artist:', error);
        res.status(500).json({ error: 'Failed to unfollow artist' });
      }
    }
  );

  /**
   * Get artist followers
   * GET /api/social/followers/:artistAddress
   */
  router.get(
    '/followers/:artistAddress',
    param('artistAddress').isEthereumAddress(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    async (req: Request, res: Response) => {
      const { artistAddress } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      try {
        const [followers, count] = await Promise.all([
          pool.query(
            `SELECT af.follower_address, af.followed_at, up.display_name, up.avatar_url
             FROM artist_followers af
             LEFT JOIN user_profiles up ON af.follower_address = up.wallet_address
             WHERE af.artist_address = $1
             ORDER BY af.followed_at DESC
             LIMIT $2 OFFSET $3`,
            [artistAddress, limit, offset]
          ),
          pool.query(
            `SELECT COUNT(*) FROM artist_followers WHERE artist_address = $1`,
            [artistAddress]
          ),
        ]);

        res.json({
          followers: followers.rows,
          total: parseInt(count.rows[0].count),
          limit,
          offset,
        });
      } catch (error) {
        console.error('Error fetching followers:', error);
        res.status(500).json({ error: 'Failed to fetch followers' });
      }
    }
  );

  /**
   * Get user's following list
   * GET /api/social/following/:userAddress
   */
  router.get(
    '/following/:userAddress',
    param('userAddress').isEthereumAddress(),
    async (req: Request, res: Response) => {
      const { userAddress } = req.params;

      try {
        const result = await pool.query(
          `SELECT
             af.artist_address,
             a.name as artist_name,
             af.followed_at,
             af.notifications_enabled,
             up.display_name,
             up.avatar_url
           FROM artist_followers af
           LEFT JOIN artists a ON af.artist_address = a.artist_address
           LEFT JOIN user_profiles up ON af.artist_address = up.wallet_address
           WHERE af.follower_address = $1
           ORDER BY af.followed_at DESC`,
          [userAddress]
        );

        res.json({ following: result.rows });
      } catch (error) {
        console.error('Error fetching following:', error);
        res.status(500).json({ error: 'Failed to fetch following list' });
      }
    }
  );

  // ============================================================================
  // COMMENTS SYSTEM
  // ============================================================================

  /**
   * Post a comment on a song
   * POST /api/social/comments
   */
  router.post(
    '/comments',
    body('songId').notEmpty(),
    body('commenterAddress').isEthereumAddress(),
    body('content').isLength({ min: 1, max: 5000 }),
    body('parentCommentId').optional().isInt(),
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { songId, commenterAddress, content, parentCommentId } = req.body;

      try {
        const result = await pool.query(
          `INSERT INTO song_comments (song_id, commenter_address, content, parent_comment_id)
           VALUES ($1, $2, $3, $4)
           RETURNING id, song_id, commenter_address, content, parent_comment_id, created_at`,
          [songId, commenterAddress, content, parentCommentId || null]
        );

        res.status(201).json({
          success: true,
          comment: result.rows[0],
        });
      } catch (error) {
        console.error('Error posting comment:', error);
        res.status(500).json({ error: 'Failed to post comment' });
      }
    }
  );

  /**
   * Get comments for a song
   * GET /api/social/comments/:songId
   */
  router.get(
    '/comments/:songId',
    param('songId').notEmpty(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    async (req: Request, res: Response) => {
      const { songId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      try {
        const [comments, count] = await Promise.all([
          pool.query(
            `SELECT
               sc.id,
               sc.song_id,
               sc.commenter_address,
               sc.parent_comment_id,
               sc.content,
               sc.created_at,
               sc.updated_at,
               sc.is_edited,
               up.display_name as commenter_name,
               up.avatar_url as commenter_avatar,
               COUNT(DISTINCT cl.id) as like_count,
               COUNT(DISTINCT replies.id) as reply_count
             FROM song_comments sc
             LEFT JOIN user_profiles up ON sc.commenter_address = up.wallet_address
             LEFT JOIN comment_likes cl ON sc.id = cl.comment_id
             LEFT JOIN song_comments replies ON sc.id = replies.parent_comment_id
             WHERE sc.song_id = $1 AND sc.is_deleted = FALSE AND sc.parent_comment_id IS NULL
             GROUP BY sc.id, up.display_name, up.avatar_url
             ORDER BY sc.created_at DESC
             LIMIT $2 OFFSET $3`,
            [songId, limit, offset]
          ),
          pool.query(
            `SELECT COUNT(*) FROM song_comments
             WHERE song_id = $1 AND is_deleted = FALSE AND parent_comment_id IS NULL`,
            [songId]
          ),
        ]);

        res.json({
          comments: comments.rows,
          total: parseInt(count.rows[0].count),
          limit,
          offset,
        });
      } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
      }
    }
  );

  /**
   * Get replies to a comment
   * GET /api/social/comments/:commentId/replies
   */
  router.get(
    '/comments/:commentId/replies',
    param('commentId').isInt(),
    async (req: Request, res: Response) => {
      const { commentId } = req.params;

      try {
        const result = await pool.query(
          `SELECT
             sc.id,
             sc.song_id,
             sc.commenter_address,
             sc.content,
             sc.created_at,
             sc.updated_at,
             sc.is_edited,
             up.display_name as commenter_name,
             up.avatar_url as commenter_avatar,
             COUNT(DISTINCT cl.id) as like_count
           FROM song_comments sc
           LEFT JOIN user_profiles up ON sc.commenter_address = up.wallet_address
           LEFT JOIN comment_likes cl ON sc.id = cl.comment_id
           WHERE sc.parent_comment_id = $1 AND sc.is_deleted = FALSE
           GROUP BY sc.id, up.display_name, up.avatar_url
           ORDER BY sc.created_at ASC`,
          [commentId]
        );

        res.json({ replies: result.rows });
      } catch (error) {
        console.error('Error fetching replies:', error);
        res.status(500).json({ error: 'Failed to fetch replies' });
      }
    }
  );

  /**
   * Like a comment
   * POST /api/social/comments/:commentId/like
   */
  router.post(
    '/comments/:commentId/like',
    param('commentId').isInt(),
    body('likerAddress').isEthereumAddress(),
    body('reactionType').optional().isIn(['like', 'love', 'fire', 'laugh']),
    async (req: Request, res: Response) => {
      const { commentId } = req.params;
      const { likerAddress, reactionType = 'like' } = req.body;

      try {
        const result = await pool.query(
          `INSERT INTO comment_likes (comment_id, liker_address, reaction_type)
           VALUES ($1, $2, $3)
           ON CONFLICT (comment_id, liker_address) DO UPDATE SET reaction_type = $3
           RETURNING id, created_at`,
          [commentId, likerAddress, reactionType]
        );

        res.json({
          success: true,
          like: result.rows[0],
        });
      } catch (error) {
        console.error('Error liking comment:', error);
        res.status(500).json({ error: 'Failed to like comment' });
      }
    }
  );

  /**
   * Unlike a comment
   * DELETE /api/social/comments/:commentId/like
   */
  router.delete(
    '/comments/:commentId/like',
    param('commentId').isInt(),
    query('likerAddress').isEthereumAddress(),
    async (req: Request, res: Response) => {
      const { commentId } = req.params;
      const { likerAddress } = req.query;

      try {
        await pool.query(
          `DELETE FROM comment_likes WHERE comment_id = $1 AND liker_address = $2`,
          [commentId, likerAddress]
        );

        res.json({ success: true });
      } catch (error) {
        console.error('Error unliking comment:', error);
        res.status(500).json({ error: 'Failed to unlike comment' });
      }
    }
  );

  /**
   * Delete a comment
   * DELETE /api/social/comments/:commentId
   */
  router.delete(
    '/comments/:commentId',
    param('commentId').isInt(),
    query('commenterAddress').isEthereumAddress(),
    async (req: Request, res: Response) => {
      const { commentId } = req.params;
      const { commenterAddress } = req.query;

      try {
        // Soft delete
        const result = await pool.query(
          `UPDATE song_comments
           SET is_deleted = TRUE, deleted_at = NOW()
           WHERE id = $1 AND commenter_address = $2
           RETURNING id`,
          [commentId, commenterAddress]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Comment not found or unauthorized' });
        }

        res.json({ success: true });
      } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
      }
    }
  );

  // ============================================================================
  // PLAYLISTS
  // ============================================================================

  /**
   * Create a playlist
   * POST /api/social/playlists
   */
  router.post(
    '/playlists',
    body('ownerAddress').isEthereumAddress(),
    body('name').isLength({ min: 1, max: 255 }),
    body('description').optional().isLength({ max: 5000 }),
    body('isPublic').optional().isBoolean(),
    body('isCollaborative').optional().isBoolean(),
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        ownerAddress,
        name,
        description,
        isPublic = true,
        isCollaborative = false,
      } = req.body;

      const playlistId = `playlist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      try {
        const result = await pool.query(
          `INSERT INTO playlists (playlist_id, owner_address, name, description, is_public, is_collaborative)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [playlistId, ownerAddress, name, description, isPublic, isCollaborative]
        );

        res.status(201).json({
          success: true,
          playlist: result.rows[0],
        });
      } catch (error) {
        console.error('Error creating playlist:', error);
        res.status(500).json({ error: 'Failed to create playlist' });
      }
    }
  );

  /**
   * Get a playlist
   * GET /api/social/playlists/:playlistId
   */
  router.get(
    '/playlists/:playlistId',
    param('playlistId').notEmpty(),
    async (req: Request, res: Response) => {
      const { playlistId } = req.params;

      try {
        const [playlist, songs] = await Promise.all([
          pool.query(
            `SELECT
               p.*,
               up.display_name as owner_name,
               up.avatar_url as owner_avatar,
               COUNT(DISTINCT pf.follower_address) as follower_count,
               COUNT(DISTINCT ps.song_id) as song_count
             FROM playlists p
             LEFT JOIN user_profiles up ON p.owner_address = up.wallet_address
             LEFT JOIN playlist_followers pf ON p.playlist_id = pf.playlist_id
             LEFT JOIN playlist_songs ps ON p.playlist_id = ps.playlist_id
             WHERE p.playlist_id = $1
             GROUP BY p.id, up.display_name, up.avatar_url`,
            [playlistId]
          ),
          pool.query(
            `SELECT
               ps.song_id,
               ps.position,
               ps.added_at,
               ps.added_by_address,
               s.title,
               s.artist_address,
               a.name as artist_name,
               up.display_name as added_by_name
             FROM playlist_songs ps
             LEFT JOIN songs s ON ps.song_id = s.song_id
             LEFT JOIN artists a ON s.artist_address = a.artist_address
             LEFT JOIN user_profiles up ON ps.added_by_address = up.wallet_address
             WHERE ps.playlist_id = $1
             ORDER BY ps.position ASC`,
            [playlistId]
          ),
        ]);

        if (playlist.rows.length === 0) {
          return res.status(404).json({ error: 'Playlist not found' });
        }

        res.json({
          playlist: playlist.rows[0],
          songs: songs.rows,
        });
      } catch (error) {
        console.error('Error fetching playlist:', error);
        res.status(500).json({ error: 'Failed to fetch playlist' });
      }
    }
  );

  /**
   * Add song to playlist
   * POST /api/social/playlists/:playlistId/songs
   */
  router.post(
    '/playlists/:playlistId/songs',
    param('playlistId').notEmpty(),
    body('songId').notEmpty(),
    body('addedByAddress').isEthereumAddress(),
    async (req: Request, res: Response) => {
      const { playlistId } = req.params;
      const { songId, addedByAddress } = req.body;

      try {
        // Get next position
        const posResult = await pool.query(
          `SELECT COALESCE(MAX(position), -1) + 1 as next_position
           FROM playlist_songs WHERE playlist_id = $1`,
          [playlistId]
        );

        const position = posResult.rows[0].next_position;

        const result = await pool.query(
          `INSERT INTO playlist_songs (playlist_id, song_id, added_by_address, position)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (playlist_id, song_id) DO NOTHING
           RETURNING *`,
          [playlistId, songId, addedByAddress, position]
        );

        if (result.rows.length === 0) {
          return res.status(409).json({ error: 'Song already in playlist' });
        }

        res.status(201).json({
          success: true,
          playlistSong: result.rows[0],
        });
      } catch (error) {
        console.error('Error adding song to playlist:', error);
        res.status(500).json({ error: 'Failed to add song to playlist' });
      }
    }
  );

  /**
   * Remove song from playlist
   * DELETE /api/social/playlists/:playlistId/songs/:songId
   */
  router.delete(
    '/playlists/:playlistId/songs/:songId',
    param('playlistId').notEmpty(),
    param('songId').notEmpty(),
    async (req: Request, res: Response) => {
      const { playlistId, songId } = req.params;

      try {
        const result = await pool.query(
          `DELETE FROM playlist_songs
           WHERE playlist_id = $1 AND song_id = $2
           RETURNING position`,
          [playlistId, songId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Song not in playlist' });
        }

        // Reorder remaining songs
        const deletedPosition = result.rows[0].position;
        await pool.query(
          `UPDATE playlist_songs
           SET position = position - 1
           WHERE playlist_id = $1 AND position > $2`,
          [playlistId, deletedPosition]
        );

        res.json({ success: true });
      } catch (error) {
        console.error('Error removing song from playlist:', error);
        res.status(500).json({ error: 'Failed to remove song from playlist' });
      }
    }
  );

  /**
   * Get user's playlists
   * GET /api/social/playlists/user/:userAddress
   */
  router.get(
    '/playlists/user/:userAddress',
    param('userAddress').isEthereumAddress(),
    async (req: Request, res: Response) => {
      const { userAddress } = req.params;

      try {
        const result = await pool.query(
          `SELECT
             p.*,
             COUNT(DISTINCT ps.song_id) as song_count,
             COUNT(DISTINCT pf.follower_address) as follower_count
           FROM playlists p
           LEFT JOIN playlist_songs ps ON p.playlist_id = ps.playlist_id
           LEFT JOIN playlist_followers pf ON p.playlist_id = pf.playlist_id
           WHERE p.owner_address = $1
           GROUP BY p.id
           ORDER BY p.updated_at DESC`,
          [userAddress]
        );

        res.json({ playlists: result.rows });
      } catch (error) {
        console.error('Error fetching user playlists:', error);
        res.status(500).json({ error: 'Failed to fetch playlists' });
      }
    }
  );

  // ============================================================================
  // USER PROFILES
  // ============================================================================

  /**
   * Get or create user profile
   * GET /api/social/profile/:walletAddress
   */
  router.get(
    '/profile/:walletAddress',
    param('walletAddress').isEthereumAddress(),
    async (req: Request, res: Response) => {
      const { walletAddress } = req.params;

      try {
        let result = await pool.query(
          `SELECT * FROM user_profiles WHERE wallet_address = $1`,
          [walletAddress]
        );

        // Create if doesn't exist
        if (result.rows.length === 0) {
          result = await pool.query(
            `INSERT INTO user_profiles (wallet_address)
             VALUES ($1)
             RETURNING *`,
            [walletAddress]
          );
        }

        res.json({ profile: result.rows[0] });
      } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
      }
    }
  );

  /**
   * Update user profile
   * PUT /api/social/profile/:walletAddress
   */
  router.put(
    '/profile/:walletAddress',
    param('walletAddress').isEthereumAddress(),
    body('displayName').optional().isLength({ max: 100 }),
    body('bio').optional().isLength({ max: 1000 }),
    body('avatarUrl').optional().isURL(),
    body('bannerUrl').optional().isURL(),
    body('websiteUrl').optional().isURL(),
    body('twitterHandle').optional().isLength({ max: 50 }),
    body('instagramHandle').optional().isLength({ max: 50 }),
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { walletAddress } = req.params;
      const updates = req.body;

      const fields = [];
      const values = [];
      let idx = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          fields.push(`${snakeKey} = $${idx}`);
          values.push(value);
          idx++;
        }
      }

      if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(walletAddress);

      try {
        const result = await pool.query(
          `UPDATE user_profiles
           SET ${fields.join(', ')}, updated_at = NOW()
           WHERE wallet_address = $${idx}
           RETURNING *`,
          values
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Profile not found' });
        }

        res.json({ profile: result.rows[0] });
      } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
      }
    }
  );

  // ============================================================================
  // ACTIVITY FEED
  // ============================================================================

  /**
   * Get user's personalized feed
   * GET /api/social/feed/:userAddress
   */
  router.get(
    '/feed/:userAddress',
    param('userAddress').isEthereumAddress(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    async (req: Request, res: Response) => {
      const { userAddress } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      try {
        const result = await pool.query(
          `SELECT * FROM get_user_feed($1, $2, $3)`,
          [userAddress, limit, offset]
        );

        res.json({
          feed: result.rows,
          limit,
          offset,
        });
      } catch (error) {
        console.error('Error fetching feed:', error);
        res.status(500).json({ error: 'Failed to fetch feed' });
      }
    }
  );

  /**
   * Get user's notifications
   * GET /api/social/notifications/:userAddress
   */
  router.get(
    '/notifications/:userAddress',
    param('userAddress').isEthereumAddress(),
    query('unreadOnly').optional().isBoolean(),
    async (req: Request, res: Response) => {
      const { userAddress } = req.params;
      const unreadOnly = req.query.unreadOnly === 'true';

      try {
        let query = `SELECT * FROM notifications WHERE recipient_address = $1`;
        if (unreadOnly) {
          query += ` AND is_read = FALSE`;
        }
        query += ` ORDER BY created_at DESC LIMIT 50`;

        const result = await pool.query(query, [userAddress]);

        res.json({ notifications: result.rows });
      } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
      }
    }
  );

  /**
   * Mark notification as read
   * PUT /api/social/notifications/:notificationId/read
   */
  router.put(
    '/notifications/:notificationId/read',
    param('notificationId').isInt(),
    async (req: Request, res: Response) => {
      const { notificationId } = req.params;

      try {
        await pool.query(
          `UPDATE notifications
           SET is_read = TRUE, read_at = NOW()
           WHERE id = $1`,
          [notificationId]
        );

        res.json({ success: true });
      } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
      }
    }
  );

  return router;
}
