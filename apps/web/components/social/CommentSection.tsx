/**
 * Comment Section Component
 * Displays and manages comments on songs
 */

'use client';

import React, { useState } from 'react';
import {
  useComments,
  usePostComment,
  useLikeComment,
  useUnlikeComment,
  useDeleteComment,
  useReplies,
  Comment,
} from '@/hooks/useSocial';
import { formatRelativeTime } from '@/hooks/useAnalytics';

interface CommentSectionProps {
  songId: string;
  currentUserAddress?: string;
}

export function CommentSection({ songId, currentUserAddress }: CommentSectionProps) {
  const [commentText, setCommentText] = useState('');
  const { data, isLoading } = useComments(songId);
  const postComment = usePostComment();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserAddress || !commentText.trim()) return;

    try {
      await postComment.mutateAsync({
        songId,
        commenterAddress: currentUserAddress,
        content: commentText.trim(),
      });
      setCommentText('');
    } catch (error) {
      console.error('Failed to post comment:', error);
    }
  };

  if (isLoading) {
    return <CommentSkeleton />;
  }

  const comments = data?.comments || [];

  return (
    <div className="space-y-6">
      {/* Comment Form */}
      {currentUserAddress && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="comment" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Add a comment
            </label>
            <textarea
              id="comment"
              rows={3}
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500"
              placeholder="Share your thoughts..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              maxLength={5000}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {commentText.length}/5000
            </span>
            <button
              type="submit"
              disabled={!commentText.trim() || postComment.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {postComment.isPending ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </form>
      )}

      {/* Comments List */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Comments ({data?.total || 0})
        </h3>

        {comments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              No comments yet. Be the first to share your thoughts!
            </p>
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserAddress={currentUserAddress}
              songId={songId}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface CommentItemProps {
  comment: Comment;
  currentUserAddress?: string;
  songId: string;
  isReply?: boolean;
}

function CommentItem({ comment, currentUserAddress, songId, isReply = false }: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isLiked, setIsLiked] = useState(false);

  const { data: repliesData } = useReplies(showReplies ? comment.id : undefined);
  const postComment = usePostComment();
  const likeComment = useLikeComment();
  const unlikeComment = useUnlikeComment();
  const deleteComment = useDeleteComment();

  const isOwner = currentUserAddress?.toLowerCase() === comment.commenter_address.toLowerCase();

  const handleLike = async () => {
    if (!currentUserAddress) return;

    try {
      if (isLiked) {
        await unlikeComment.mutateAsync({
          commentId: comment.id,
          likerAddress: currentUserAddress,
        });
        setIsLiked(false);
      } else {
        await likeComment.mutateAsync({
          commentId: comment.id,
          likerAddress: currentUserAddress,
          reactionType: 'like',
        });
        setIsLiked(true);
      }
    } catch (error) {
      console.error('Failed to like/unlike comment:', error);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserAddress || !replyText.trim()) return;

    try {
      await postComment.mutateAsync({
        songId,
        commenterAddress: currentUserAddress,
        content: replyText.trim(),
        parentCommentId: comment.id,
      });
      setReplyText('');
      setShowReplyForm(false);
      setShowReplies(true);
    } catch (error) {
      console.error('Failed to post reply:', error);
    }
  };

  const handleDelete = async () => {
    if (!currentUserAddress || !confirm('Delete this comment?')) return;

    try {
      await deleteComment.mutateAsync({
        commentId: comment.id,
        commenterAddress: currentUserAddress,
      });
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const replies = repliesData?.replies || [];

  return (
    <div className={`${isReply ? 'ml-12' : ''}`}>
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {comment.commenter_avatar ? (
            <img
              src={comment.commenter_avatar}
              alt={comment.commenter_name || 'User'}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
              {(comment.commenter_name || comment.commenter_address)[0].toUpperCase()}
            </div>
          )}
        </div>

        {/* Comment Content */}
        <div className="flex-1">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-gray-900 dark:text-white">
                {comment.commenter_name || `${comment.commenter_address.slice(0, 6)}...${comment.commenter_address.slice(-4)}`}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {formatRelativeTime(comment.created_at)}
              </span>
              {comment.is_edited && (
                <span className="text-xs text-gray-500 dark:text-gray-400">(edited)</span>
              )}
            </div>
            <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
              {comment.content}
            </p>
          </div>

          {/* Comment Actions */}
          <div className="flex items-center gap-4 mt-2 text-sm">
            <button
              onClick={handleLike}
              disabled={!currentUserAddress}
              className={`flex items-center gap-1 ${
                isLiked
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              } transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span>{isLiked ? '❤️' : '🤍'}</span>
              <span>{comment.like_count > 0 && comment.like_count}</span>
            </button>

            {!isReply && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                disabled={!currentUserAddress}
                className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reply
              </button>
            )}

            {!isReply && comment.reply_count > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {showReplies ? 'Hide' : 'Show'} {comment.reply_count} {comment.reply_count === 1 ? 'reply' : 'replies'}
              </button>
            )}

            {isOwner && (
              <button
                onClick={handleDelete}
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-500 transition-colors"
              >
                Delete
              </button>
            )}
          </div>

          {/* Reply Form */}
          {showReplyForm && (
            <form onSubmit={handleReply} className="mt-3 space-y-2">
              <textarea
                rows={2}
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500"
                placeholder="Write a reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                maxLength={5000}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!replyText.trim() || postComment.isPending}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Reply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowReplyForm(false);
                    setReplyText('');
                  }}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Replies */}
          {showReplies && replies.length > 0 && (
            <div className="mt-4 space-y-4">
              {replies.map((reply: Comment) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  currentUserAddress={currentUserAddress}
                  songId={songId}
                  isReply={true}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CommentSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
