/**
 * Follow Button Component
 * Button to follow/unfollow artists
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useFollowArtist, useUnfollowArtist, useFollowing } from '@/hooks/useSocial';

interface FollowButtonProps {
  artistAddress: string;
  currentUserAddress?: string;
  variant?: 'default' | 'compact';
  showCount?: boolean;
  followerCount?: number;
}

export function FollowButton({
  artistAddress,
  currentUserAddress,
  variant = 'default',
  showCount = false,
  followerCount,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(false);

  const { data: followingData } = useFollowing(currentUserAddress);
  const followArtist = useFollowArtist();
  const unfollowArtist = useUnfollowArtist();

  // Check if already following
  useEffect(() => {
    if (followingData?.following) {
      const following = followingData.following.some(
        (f: any) => f.artist_address.toLowerCase() === artistAddress.toLowerCase()
      );
      setIsFollowing(following);
    }
  }, [followingData, artistAddress]);

  // Can't follow yourself
  if (currentUserAddress?.toLowerCase() === artistAddress.toLowerCase()) {
    return null;
  }

  // Not logged in
  if (!currentUserAddress) {
    return (
      <button
        disabled
        className={`${getButtonStyles(variant, false, true)} cursor-not-allowed`}
      >
        Follow
      </button>
    );
  }

  const handleClick = async () => {
    try {
      if (isFollowing) {
        await unfollowArtist.mutateAsync({
          followerAddress: currentUserAddress,
          artistAddress,
        });
        setIsFollowing(false);
      } else {
        await followArtist.mutateAsync({
          followerAddress: currentUserAddress,
          artistAddress,
          notificationsEnabled: true,
        });
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Failed to follow/unfollow:', error);
    }
  };

  const isLoading = followArtist.isPending || unfollowArtist.isPending;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={getButtonStyles(variant, isFollowing, isLoading)}
      >
        {isLoading ? (
          <>
            <Spinner />
            {variant === 'default' && <span>Loading...</span>}
          </>
        ) : (
          <>
            {isFollowing ? (
              <>
                <CheckIcon />
                {variant === 'default' && <span>Following</span>}
              </>
            ) : (
              <>
                <PlusIcon />
                {variant === 'default' && <span>Follow</span>}
              </>
            )}
          </>
        )}
      </button>

      {showCount && followerCount !== undefined && (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
        </span>
      )}
    </div>
  );
}

function getButtonStyles(variant: string, isFollowing: boolean, isLoading: boolean): string {
  const baseStyles = 'inline-flex items-center gap-2 font-medium rounded-lg transition-all duration-200';

  if (variant === 'compact') {
    return `${baseStyles} p-2 ${
      isFollowing
        ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
        : 'bg-blue-600 text-white hover:bg-blue-700'
    } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`;
  }

  return `${baseStyles} px-4 py-2 ${
    isFollowing
      ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
      : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg'
  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`;
}

function PlusIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}

/**
 * Follower List Component
 * Displays list of followers for an artist
 */

interface FollowerListProps {
  artistAddress: string;
}

export function FollowerList({ artistAddress }: FollowerListProps) {
  const { data, isLoading } = useFollowing(artistAddress);

  if (isLoading) {
    return <FollowerListSkeleton />;
  }

  const followers = data?.followers || [];

  if (followers.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">No followers yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {followers.map((follower: any) => (
        <div
          key={follower.follower_address}
          className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          {follower.avatar_url ? (
            <img
              src={follower.avatar_url}
              alt={follower.display_name || 'User'}
              className="w-12 h-12 rounded-full"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
              {(follower.display_name || follower.follower_address)[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {follower.display_name || `${follower.follower_address.slice(0, 8)}...`}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Followed {new Date(follower.followed_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function FollowerListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4 bg-gray-200 dark:bg-gray-700 rounded-lg">
          <div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-600" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4" />
            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
