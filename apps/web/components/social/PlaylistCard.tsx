/**
 * Playlist Components
 * Card display and management for playlists
 */

'use client';

import React, { useState } from 'react';
import {
  usePlaylist,
  useUserPlaylists,
  useCreatePlaylist,
  useAddSongToPlaylist,
  useRemoveSongFromPlaylist,
  Playlist,
  PlaylistSong,
} from '@/hooks/useSocial';
import { formatRelativeTime } from '@/hooks/useAnalytics';

interface PlaylistCardProps {
  playlist: Playlist;
  onClick?: () => void;
}

export function PlaylistCard({ playlist, onClick }: PlaylistCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
    >
      {/* Cover Image */}
      <div className="relative aspect-square bg-gradient-to-br from-purple-500 to-blue-500">
        {playlist.cover_image_url ? (
          <img
            src={playlist.cover_image_url}
            alt={playlist.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-20 h-20 text-white opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}

        {/* Privacy Badge */}
        {!playlist.is_public && (
          <div className="absolute top-2 right-2 px-2 py-1 bg-black bg-opacity-50 text-white text-xs rounded-full">
            Private
          </div>
        )}
      </div>

      {/* Playlist Info */}
      <div className="p-4">
        <h3 className="font-semibold text-lg text-gray-900 dark:text-white truncate">
          {playlist.name}
        </h3>

        {playlist.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
            {playlist.description}
          </p>
        )}

        <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
          <span>{playlist.song_count || 0} songs</span>
          {playlist.follower_count !== undefined && playlist.follower_count > 0 && (
            <span>{playlist.follower_count} followers</span>
          )}
        </div>

        {playlist.owner_name && (
          <div className="flex items-center gap-2 mt-3">
            {playlist.owner_avatar ? (
              <img src={playlist.owner_avatar} alt={playlist.owner_name} className="w-6 h-6 rounded-full" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                {playlist.owner_name[0].toUpperCase()}
              </div>
            )}
            <span className="text-sm text-gray-600 dark:text-gray-400">
              by {playlist.owner_name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface PlaylistViewProps {
  playlistId: string;
  currentUserAddress?: string;
}

export function PlaylistView({ playlistId, currentUserAddress }: PlaylistViewProps) {
  const { data, isLoading } = usePlaylist(playlistId);
  const removeSong = useRemoveSongFromPlaylist();

  if (isLoading) {
    return <PlaylistViewSkeleton />;
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Playlist not found</p>
      </div>
    );
  }

  const { playlist, songs } = data;
  const isOwner = currentUserAddress?.toLowerCase() === playlist.owner_address.toLowerCase();

  const handleRemoveSong = async (songId: string) => {
    if (!confirm('Remove this song from playlist?')) return;

    try {
      await removeSong.mutateAsync({ playlistId, songId });
    } catch (error) {
      console.error('Failed to remove song:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Playlist Header */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Cover */}
        <div className="w-full md:w-64 aspect-square bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
          {playlist.cover_image_url ? (
            <img src={playlist.cover_image_url} alt={playlist.name} className="w-full h-full object-cover rounded-lg" />
          ) : (
            <svg className="w-32 h-32 text-white opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          )}
        </div>

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {playlist.is_public ? 'Public' : 'Private'} Playlist
            </span>
            {playlist.is_collaborative && (
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Collaborative
              </span>
            )}
          </div>

          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {playlist.name}
          </h1>

          {playlist.description && (
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {playlist.description}
            </p>
          )}

          <div className="flex items-center gap-2 mb-4">
            {playlist.owner_avatar ? (
              <img src={playlist.owner_avatar} alt={playlist.owner_name} className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                {(playlist.owner_name || playlist.owner_address)[0].toUpperCase()}
              </div>
            )}
            <span className="font-medium text-gray-900 dark:text-white">
              {playlist.owner_name || `${playlist.owner_address.slice(0, 8)}...`}
            </span>
          </div>

          <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
            <span>{songs.length} songs</span>
            {playlist.follower_count !== undefined && (
              <span>{playlist.follower_count} followers</span>
            )}
            <span>Updated {formatRelativeTime(playlist.updated_at)}</span>
          </div>
        </div>
      </div>

      {/* Songs List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Songs</h2>
        </div>

        {songs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">No songs in this playlist yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {songs.map((song, index) => (
              <div
                key={song.song_id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="text-gray-500 dark:text-gray-400 w-8 text-center">
                  {index + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-white truncate">
                    {song.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {song.artist_name || `${song.artist_address.slice(0, 8)}...`}
                  </p>
                </div>

                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Added by {song.added_by_name || `${song.added_by_address.slice(0, 8)}...`}
                </div>

                {isOwner && (
                  <button
                    onClick={() => handleRemoveSong(song.song_id)}
                    disabled={removeSong.isPending}
                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlaylistViewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-64 aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="flex-1 space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    </div>
  );
}

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserAddress?: string;
}

export function CreatePlaylistModal({ isOpen, onClose, currentUserAddress }: CreatePlaylistModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isCollaborative, setIsCollaborative] = useState(false);

  const createPlaylist = useCreatePlaylist();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserAddress || !name.trim()) return;

    try {
      await createPlaylist.mutateAsync({
        ownerAddress: currentUserAddress,
        name: name.trim(),
        description: description.trim() || undefined,
        isPublic,
        isCollaborative,
      });

      // Reset form
      setName('');
      setDescription('');
      setIsPublic(true);
      setIsCollaborative(false);

      onClose();
    } catch (error) {
      console.error('Failed to create playlist:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Create Playlist
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Playlist Name
            </label>
            <input
              type="text"
              id="name"
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-blue-500"
              placeholder="My Awesome Playlist"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (optional)
            </label>
            <textarea
              id="description"
              rows={3}
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-blue-500"
              placeholder="Describe your playlist..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Make this playlist public
              </span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isCollaborative}
                onChange={(e) => setIsCollaborative(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Allow others to add songs
              </span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={!name.trim() || createPlaylist.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createPlaylist.isPending ? 'Creating...' : 'Create Playlist'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface UserPlaylistsGridProps {
  userAddress: string;
}

export function UserPlaylistsGrid({ userAddress }: UserPlaylistsGridProps) {
  const { data, isLoading } = useUserPlaylists(userAddress);
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (isLoading) {
    return <PlaylistsGridSkeleton />;
  }

  const playlists = data?.playlists || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Your Playlists
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Playlist
        </button>
      </div>

      {playlists.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            You haven't created any playlists yet
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Create Your First Playlist
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {playlists.map((playlist: Playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </div>
      )}

      <CreatePlaylistModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        currentUserAddress={userAddress}
      />
    </div>
  );
}

function PlaylistsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-lg h-64" />
      ))}
    </div>
  );
}
