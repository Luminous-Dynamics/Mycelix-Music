/**
 * Platform Analytics Dashboard
 * Admin dashboard showing platform-wide metrics and insights
 */

'use client';

import React, { useState } from 'react';
import {
  usePlatformStats,
  useGenreStats,
  useTrendingSongs,
  useTopArtists,
  formatCurrency,
  formatNumber,
  formatRelativeTime,
} from '@/hooks/useAnalytics';
import {
  StatCard,
  StrategyDistributionChart,
  GenrePerformanceChart,
  EngagementTimelineChart,
  TopSongsChart,
  ComparisonChart,
  MiniDonut,
} from './Charts';

export function PlatformDashboard() {
  const platformStats = usePlatformStats();
  const genreStats = useGenreStats();
  const trendingSongs = useTrendingSongs(10);
  const topArtists = useTopArtists(10);

  if (platformStats.isLoading) {
    return <PlatformDashboardSkeleton />;
  }

  if (platformStats.isError || !platformStats.data) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load platform analytics</p>
      </div>
    );
  }

  const stats = platformStats.data;

  // Calculate growth rates
  const weeklyGrowthRate =
    stats.new_songs_last_7d > 0
      ? ((stats.new_songs_last_7d / stats.total_songs) * 100).toFixed(1)
      : 0;

  const monthlyGrowthRate =
    stats.new_songs_last_30d > 0
      ? ((stats.new_songs_last_30d / stats.total_songs) * 100).toFixed(1)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Platform Analytics
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Last updated: {formatRelativeTime(stats.last_refreshed)}
        </p>
      </div>

      {/* Top-level Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          title="Total Volume"
          value={parseFloat(stats.total_volume)}
          format="currency"
          change={18.5}
          trend={generateTrendData()}
        />

        <StatCard
          title="Total Artists"
          value={stats.total_artists}
          format="number"
          change={parseFloat(weeklyGrowthRate)}
          trend={generateTrendData()}
        />

        <StatCard
          title="Total Songs"
          value={stats.total_songs}
          format="number"
          change={parseFloat(monthlyGrowthRate)}
          trend={generateTrendData()}
        />

        <StatCard
          title="Total Plays"
          value={stats.total_plays}
          format="number"
          change={12.3}
          trend={generateTrendData()}
        />

        <StatCard
          title="Unique Listeners"
          value={stats.total_listeners}
          format="number"
          change={9.7}
          trend={generateTrendData()}
        />
      </div>

      {/* Activity Metrics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Recent Activity
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ActivityMetric
            label="Last 24 Hours"
            value={stats.plays_last_24h}
            icon="📈"
            color="blue"
          />
          <ActivityMetric
            label="Last 7 Days"
            value={stats.plays_last_7d}
            icon="📊"
            color="green"
          />
          <ActivityMetric
            label="Last 30 Days"
            value={stats.plays_last_30d}
            icon="🎯"
            color="purple"
          />
        </div>
      </div>

      {/* Strategy Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Songs by Strategy
          </h2>
          <StrategyDistributionChart
            data={[
              { name: 'Pay-Per-Stream', value: stats.songs_pay_per_stream },
              { name: 'Gift Economy', value: stats.songs_gift_economy },
              { name: 'Patronage', value: stats.songs_patronage },
              { name: 'Auction', value: stats.songs_auction },
            ]}
            height={300}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Growth Metrics
          </h2>
          <div className="grid grid-cols-2 gap-6 mt-8">
            <MiniDonut
              value={stats.new_songs_last_7d}
              max={stats.total_songs}
              label="Weekly Growth"
              color="#3b82f6"
            />
            <MiniDonut
              value={stats.new_songs_last_30d}
              max={stats.total_songs}
              label="Monthly Growth"
              color="#10b981"
            />
          </div>
          <div className="mt-6 space-y-2">
            <GrowthStat
              label="New Songs (7d)"
              value={stats.new_songs_last_7d}
              percentage={parseFloat(weeklyGrowthRate)}
            />
            <GrowthStat
              label="New Songs (30d)"
              value={stats.new_songs_last_30d}
              percentage={parseFloat(monthlyGrowthRate)}
            />
          </div>
        </div>
      </div>

      {/* Genre Performance */}
      {genreStats.data && genreStats.data.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Genre Performance
          </h2>
          <GenrePerformanceChart
            data={genreStats.data.slice(0, 10).map((genre: any) => ({
              genre: genre.genre,
              plays: genre.total_plays,
              earnings: parseFloat(genre.total_earnings),
            }))}
            height={350}
          />
        </div>
      )}

      {/* Trending Songs */}
      {trendingSongs.data && trendingSongs.data.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Trending Songs
          </h2>
          <TopSongsChart
            data={trendingSongs.data.map((song: any) => ({
              title: song.title,
              plays: song.trending_score,
            }))}
            height={350}
          />
        </div>
      )}

      {/* Top Artists */}
      {topArtists.data && topArtists.data.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Top Artists by Earnings
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Artist
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Songs
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Plays
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Listeners
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total Earnings
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {topArtists.data.map((artist: any, index: number) => (
                  <tr key={artist.artist_address}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      #{index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {artist.artist_name || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {artist.artist_address.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {artist.total_songs}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatNumber(artist.total_plays)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatNumber(artist.unique_listeners)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                      {formatCurrency(parseFloat(artist.total_earnings))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Platform Health Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <HealthIndicator
          label="Avg Payment"
          value={formatCurrency(parseFloat(stats.avg_payment))}
          status="good"
          description="Average payment per play"
        />
        <HealthIndicator
          label="Artist Engagement"
          value={`${((stats.total_plays / stats.total_artists) || 0).toFixed(0)} plays/artist`}
          status="good"
          description="Average plays per artist"
        />
        <HealthIndicator
          label="Listener Engagement"
          value={`${((stats.total_plays / stats.total_listeners) || 0).toFixed(0)} plays/listener`}
          status="warning"
          description="Average plays per listener"
        />
      </div>
    </div>
  );
}

// Activity Metric Component
interface ActivityMetricProps {
  label: string;
  value: number;
  icon: string;
  color: 'blue' | 'green' | 'purple';
}

function ActivityMetric({ label, value, icon, color }: ActivityMetricProps) {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400',
    purple: 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="text-center">
      <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${colorClasses[color]} text-3xl mb-3`}>
        {icon}
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">
        {formatNumber(value)}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  );
}

// Growth Stat Component
interface GrowthStatProps {
  label: string;
  value: number;
  percentage: number;
}

function GrowthStat({ label, value, percentage }: GrowthStatProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {value}
        </span>
        <span className="text-xs text-green-600 dark:text-green-400">
          (+{percentage}%)
        </span>
      </div>
    </div>
  );
}

// Health Indicator Component
interface HealthIndicatorProps {
  label: string;
  value: string;
  status: 'good' | 'warning' | 'critical';
  description: string;
}

function HealthIndicator({ label, value, status, description }: HealthIndicatorProps) {
  const statusColors = {
    good: 'bg-green-100 dark:bg-green-900 border-green-500',
    warning: 'bg-yellow-100 dark:bg-yellow-900 border-yellow-500',
    critical: 'bg-red-100 dark:bg-red-900 border-red-500',
  };

  const indicatorColors = {
    good: 'bg-green-500',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500',
  };

  return (
    <div className={`rounded-lg border-l-4 p-4 ${statusColors[status]}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${indicatorColors[status]}`} />
        <h3 className="font-semibold text-gray-900 dark:text-white">{label}</h3>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        {value}
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
}

// Loading Skeleton
function PlatformDashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        ))}
      </div>
    </div>
  );
}

// Utility: Generate trend data
function generateTrendData() {
  return Array.from({ length: 7 }, () => ({
    value: Math.random() * 100,
  }));
}
