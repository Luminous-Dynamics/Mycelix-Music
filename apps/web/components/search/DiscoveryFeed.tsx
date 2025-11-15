/**
 * Discovery Feed Component
 * Personalized discovery with trending, recommendations, and rising artists
 */

'use client';

import React, { useState } from 'react';
import {
  useTrending,
  useRising,
  useRecommendations,
  useDiscoverFeed,
  useGenreTrends,
} from '@/hooks/useSearch';
import { formatNumber } from '@/hooks/useAnalytics';

interface DiscoveryFeedProps {
  userAddress?: string;
}

export function DiscoveryFeed({ userAddress }: DiscoveryFeedProps) {
  const [selectedGenre, setSelectedGenre] = useState<string | undefined>();
  const [discoveryMode, setDiscoveryMode] = useState<'conservative' | 'balanced' | 'adventurous'>('balanced');

  const { data: trendingData, isLoading: trendingLoading } = useTrending(selectedGenre, 20);
  const { data: risingData, isLoading: risingLoading } = useRising(10);
  const { data: recommendationsData, isLoading: recommendationsLoading } = useRecommendations(userAddress, 20);
  const { data: discoverData, isLoading: discoverLoading } = useDiscoverFeed(userAddress, discoveryMode, 30);
  const { data: genresData } = useGenreTrends();

  const trending = trendingData?.trending || [];
  const rising = risingData?.rising || [];
  const recommendations = recommendationsData?.recommendations || [];
  const discover = discoverData?.discover || [];
  const genres = genresData?.genres || [];

  const isLoading = trendingLoading || risingLoading || recommendationsLoading || discoverLoading;

  if (isLoading) {
    return <DiscoveryFeedSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Header with Discovery Mode */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Discover Music
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Find your next favorite song
          </p>
        </div>

        {/* Discovery Mode Toggle */}
        {userAddress && (
          <div className="flex gap-2">
            {(['conservative', 'balanced', 'adventurous'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setDiscoveryMode(mode)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  discoveryMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* For You Section */}
      {userAddress && recommendations.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Recommended For You
            </h2>
            <button className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
              See all
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {recommendations.slice(0, 10).map((song: any) => (
              <SongCard key={song.song_id} song={song} reason={song.reason} />
            ))}
          </div>
        </section>
      )}

      {/* Trending Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Trending Now
          </h2>

          {/* Genre Filter */}
          <select
            value={selectedGenre || ''}
            onChange={(e) => setSelectedGenre(e.target.value || undefined)}
            className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
          >
            <option value="">All Genres</option>
            {genres.slice(0, 10).map((g: any) => (
              <option key={g.genre} value={g.genre}>
                {g.genre}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trending.slice(0, 10).map((song: any, index: number) => (
            <TrendingSongCard key={song.song_id} song={song} rank={index + 1} />
          ))}
        </div>
      </section>

      {/* Rising Artists */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Rising Artists
          </h2>
          <button className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
            See all
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {rising.map((artist: any) => (
            <ArtistCard key={artist.artist_address} artist={artist} />
          ))}
        </div>
      </section>

      {/* Genre Spotlight */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Popular Genres
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {genres.slice(0, 8).map((genre: any) => (
            <GenreCard key={genre.genre} genre={genre} />
          ))}
        </div>
      </section>

      {/* Discovery Mix */}
      {userAddress && discover.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Your Discovery Mix
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                A personalized mix based on your taste
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {discover.slice(0, 12).map((song: any) => (
              <SongCard key={song.song_id} song={song} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Song Card Component
interface SongCardProps {
  song: any;
  reason?: string;
}

function SongCard({ song, reason }: SongCardProps) {
  return (
    <div className="group cursor-pointer">
      <div className="relative aspect-square bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg overflow-hidden mb-2">
        {song.cover_art_url ? (
          <img
            src={song.cover_art_url}
            alt={song.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-white opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}

        {/* Play button overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
          <button className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 hover:scale-110 transition-all">
            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-1">
        <h3 className="font-medium text-sm text-gray-900 dark:text-white truncate">
          {song.title}
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
          {song.artist_name}
        </p>
        {reason && (
          <p className="text-xs text-blue-600 dark:text-blue-400 truncate mt-1">
            {reason}
          </p>
        )}
      </div>
    </div>
  );
}

// Trending Song Card
interface TrendingSongCardProps {
  song: any;
  rank: number;
}

function TrendingSongCard({ song, rank }: TrendingSongCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group cursor-pointer">
      {/* Rank */}
      <div className="flex-shrink-0 w-8 text-2xl font-bold text-gray-400 dark:text-gray-500">
        {rank}
      </div>

      {/* Cover */}
      <div className="relative w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded overflow-hidden flex-shrink-0">
        {song.cover_art_url ? (
          <img src={song.cover_art_url} alt={song.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white text-2xl">
            🎵
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-900 dark:text-white truncate">
          {song.title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
          {song.artist_name}
        </p>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span>▶ {formatNumber(song.play_count_7d)}</span>
          {song.comment_count_7d > 0 && <span>💬 {song.comment_count_7d}</span>}
          {song.playlist_adds_7d > 0 && <span>📚 {song.playlist_adds_7d}</span>}
        </div>
      </div>

      {/* Play button */}
      <button className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
        <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
    </div>
  );
}

// Artist Card
function ArtistCard({ artist }: { artist: any }) {
  return (
    <div className="group cursor-pointer">
      <div className="relative aspect-square bg-gradient-to-br from-blue-500 to-purple-500 rounded-full overflow-hidden mb-2">
        <div className="w-full h-full flex items-center justify-center text-white text-4xl font-bold">
          {artist.artist_name[0].toUpperCase()}
        </div>

        {/* Rising badge */}
        <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
          🔥 Rising
        </div>
      </div>

      <div className="text-center">
        <h3 className="font-medium text-sm text-gray-900 dark:text-white truncate">
          {artist.artist_name}
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {formatNumber(artist.follower_count)} followers
        </p>
        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
          +{artist.new_followers_7d} this week
        </p>
      </div>
    </div>
  );
}

// Genre Card
function GenreCard({ genre }: { genre: any }) {
  return (
    <div className="relative p-6 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg cursor-pointer hover:scale-105 transition-transform overflow-hidden group">
      <div className="relative z-10">
        <h3 className="text-2xl font-bold text-white mb-1">{genre.genre}</h3>
        <p className="text-white opacity-80 text-sm">
          {genre.song_count} songs • {formatNumber(genre.total_plays_7d)} plays
        </p>
      </div>

      {/* Decorative background */}
      <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity" />
    </div>
  );
}

// Loading Skeleton
function DiscoveryFeedSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
      </div>

      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/5" />
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, j) => (
              <div key={j} className="space-y-2">
                <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
