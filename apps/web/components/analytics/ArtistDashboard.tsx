/**
 * Artist Analytics Dashboard
 * Comprehensive dashboard for artists to track their performance
 */

'use client';

import React, { useState } from 'react';
import {
  useArtistAnalytics,
  useArtistDashboard,
  formatCurrency,
  formatNumber,
  formatRelativeTime,
} from '@/hooks/useAnalytics';
import {
  StatCard,
  EarningsChart,
  PlaysChart,
  TopSongsChart,
  GenrePerformanceChart,
  StrategyDistributionChart,
  EngagementTimelineChart,
  CalendarHeatmap,
} from './Charts';

interface ArtistDashboardProps {
  artistAddress: string;
}

export function ArtistDashboard({ artistAddress }: ArtistDashboardProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');
  const { analytics, topSongs, recentPlays, isLoading, isError } =
    useArtistDashboard(artistAddress);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError || !analytics.data) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load analytics data</p>
      </div>
    );
  }

  const stats = analytics.data;

  // Calculate growth percentages
  const weeklyGrowth =
    stats.plays_last_7_days > 0
      ? ((stats.plays_last_7_days / stats.total_plays) * 100).toFixed(1)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.artist_name || 'Artist Dashboard'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Last updated: {formatRelativeTime(stats.last_refreshed)}
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2">
          {(['7d', '30d', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Earnings"
          value={parseFloat(stats.total_earnings)}
          format="currency"
          change={15.3} // TODO: Calculate from historical data
          trend={[
            { value: 100 },
            { value: 120 },
            { value: 110 },
            { value: 150 },
            { value: 180 },
          ]}
        />

        <StatCard
          title="Total Plays"
          value={stats.total_plays}
          format="number"
          change={8.2}
          trend={[
            { value: 1000 },
            { value: 1200 },
            { value: 1100 },
            { value: 1500 },
            { value: 1800 },
          ]}
        />

        <StatCard
          title="Unique Listeners"
          value={stats.unique_listeners}
          format="number"
          change={12.5}
          trend={[
            { value: 50 },
            { value: 60 },
            { value: 55 },
            { value: 75 },
            { value: 90 },
          ]}
        />

        <StatCard
          title="Avg per Play"
          value={parseFloat(stats.avg_earning_per_play)}
          format="currency"
          change={-2.1}
          trend={[
            { value: 0.1 },
            { value: 0.12 },
            { value: 0.11 },
            { value: 0.09 },
            { value: 0.08 },
          ]}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Earnings Over Time */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Earnings Over Time
          </h2>
          <EarningsChart
            data={generateTimeSeriesData(30, 'earnings')}
            height={300}
          />
        </div>

        {/* Plays Over Time */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Plays Over Time
          </h2>
          <PlaysChart data={generateTimeSeriesData(30, 'plays')} height={300} />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Songs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Top Songs
          </h2>
          {topSongs.data && topSongs.data.length > 0 ? (
            <TopSongsChart
              data={topSongs.data.map((song: any) => ({
                title: song.title,
                plays: song.play_count,
              }))}
              height={300}
            />
          ) : (
            <p className="text-gray-500 text-center py-12">No data available</p>
          )}
        </div>

        {/* Strategy Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Revenue by Strategy
          </h2>
          <StrategyDistributionChart
            data={[
              { name: 'Pay-Per-Stream', value: 45 },
              { name: 'Gift Economy', value: 25 },
              { name: 'Patronage', value: 20 },
              { name: 'Auction', value: 10 },
            ]}
            height={300}
          />
        </div>
      </div>

      {/* Engagement Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Engagement Timeline
        </h2>
        <EngagementTimelineChart
          data={generateEngagementData(30)}
          height={350}
        />
      </div>

      {/* Activity Heatmap */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Activity Heatmap (Last 365 Days)
        </h2>
        <CalendarHeatmap data={generateHeatmapData(365)} height={150} />
      </div>

      {/* Recent Plays Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Plays
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Song
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Listener
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {recentPlays.data?.slice(0, 10).map((play: any, index: number) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {play.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {play.listener_address.slice(0, 6)}...
                    {play.listener_address.slice(-4)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatCurrency(play.amount_paid)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatRelativeTime(play.played_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickStat
          label="Total Songs"
          value={stats.total_songs}
          icon="🎵"
        />
        <QuickStat
          label="Plays This Week"
          value={stats.plays_last_7_days}
          icon="▶️"
        />
        <QuickStat
          label="Plays This Month"
          value={stats.plays_last_30_days}
          icon="📊"
        />
        <QuickStat
          label="Last Play"
          value={stats.last_play_date ? formatRelativeTime(stats.last_play_date) : 'N/A'}
          icon="⏱️"
        />
      </div>
    </div>
  );
}

// Quick Stat Component
interface QuickStatProps {
  label: string;
  value: string | number;
  icon: string;
}

function QuickStat({ label, value, icon }: QuickStatProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {typeof value === 'number' ? formatNumber(value) : value}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

// Loading Skeleton
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
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

// Utility: Generate time series data (mock for now)
function generateTimeSeriesData(days: number, type: 'earnings' | 'plays') {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - i));
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      [type]: type === 'earnings' ? Math.random() * 100 : Math.floor(Math.random() * 1000),
    };
  });
}

// Utility: Generate engagement data
function generateEngagementData(days: number) {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - i));
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      plays: Math.floor(Math.random() * 1000),
      listeners: Math.floor(Math.random() * 200),
      earnings: Math.random() * 100,
    };
  });
}

// Utility: Generate heatmap data
function generateHeatmapData(days: number) {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - i));
    return {
      date: date.toISOString().split('T')[0],
      plays: Math.floor(Math.random() * 500),
    };
  });
}
