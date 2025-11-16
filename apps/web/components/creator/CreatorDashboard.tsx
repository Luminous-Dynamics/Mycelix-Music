/**
 * Creator Dashboard Component
 * Main hub for artists to manage their presence on the platform
 */

import React, { useState } from 'react';
import { useCreatorDashboard } from '../../hooks/useCreator';
import Link from 'next/link';

interface CreatorDashboardProps {
  artistAddress: string;
}

export default function CreatorDashboard({ artistAddress }: CreatorDashboardProps) {
  const { data: dashboard, isLoading, error, refetch } = useCreatorDashboard(artistAddress);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-8 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="text-2xl font-bold text-red-900 mb-4">Error Loading Dashboard</h2>
        <p className="text-red-700 mb-4">Failed to load your creator dashboard. Please try again.</p>
        <button
          onClick={() => refetch()}
          className="py-2 px-6 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="max-w-6xl mx-auto p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h2 className="text-2xl font-bold text-yellow-900 mb-4">Welcome, Creator!</h2>
        <p className="text-yellow-700 mb-4">
          Your dashboard is being set up. Upload your first song to get started!
        </p>
        <Link href="/upload">
          <a className="inline-block py-2 px-6 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
            Upload Your First Song
          </a>
        </Link>
      </div>
    );
  }

  const { overview, revenueByStrategy, recentActivity, topSongs, audienceGrowth } = dashboard;

  // Calculate period comparisons
  const totalRevenue = revenueByStrategy.reduce((sum, s) => sum + parseFloat(s.total_revenue), 0);
  const totalPlays = overview?.total_plays || 0;
  const totalFollowers = overview?.total_followers || 0;
  const totalPatrons = overview?.total_patrons || 0;

  // Calculate growth rates (mock for now - would come from backend)
  const revenueGrowth = 15.3; // % growth
  const playsGrowth = 23.1;
  const followersGrowth = 8.7;
  const patronsGrowth = 12.4;

  const GrowthIndicator = ({ value }: { value: number }) => {
    const isPositive = value >= 0;
    return (
      <span className={`text-sm font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? '↑' : '↓'} {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Creator Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's your performance overview.</p>
      </div>

      {/* Time Range Selector */}
      <div className="mb-6 flex justify-between items-center">
        <div className="flex gap-2">
          {(['7d', '30d', '90d', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range === 'all' ? 'All Time' : range.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Revenue */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex justify-between items-start mb-4">
            <div className="text-sm opacity-90">Total Revenue</div>
            <GrowthIndicator value={revenueGrowth} />
          </div>
          <div className="text-3xl font-bold mb-1">${totalRevenue.toFixed(2)}</div>
          <div className="text-xs opacity-75">Across all strategies</div>
        </div>

        {/* Total Plays */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex justify-between items-start mb-4">
            <div className="text-sm opacity-90">Total Plays</div>
            <GrowthIndicator value={playsGrowth} />
          </div>
          <div className="text-3xl font-bold mb-1">{totalPlays.toLocaleString()}</div>
          <div className="text-xs opacity-75">All-time streams</div>
        </div>

        {/* Total Followers */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex justify-between items-start mb-4">
            <div className="text-sm opacity-90">Followers</div>
            <GrowthIndicator value={followersGrowth} />
          </div>
          <div className="text-3xl font-bold mb-1">{totalFollowers.toLocaleString()}</div>
          <div className="text-xs opacity-75">Active followers</div>
        </div>

        {/* Total Patrons */}
        <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex justify-between items-start mb-4">
            <div className="text-sm opacity-90">Patrons</div>
            <GrowthIndicator value={patronsGrowth} />
          </div>
          <div className="text-3xl font-bold mb-1">{totalPatrons.toLocaleString()}</div>
          <div className="text-xs opacity-75">Supporting you</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/upload">
            <a className="flex flex-col items-center p-4 rounded-lg border-2 border-gray-200 hover:border-blue-600 hover:bg-blue-50 transition-all group">
              <div className="w-12 h-12 bg-blue-100 group-hover:bg-blue-600 rounded-full flex items-center justify-center mb-3 transition-colors">
                <svg className="h-6 w-6 text-blue-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <span className="font-semibold text-gray-900 group-hover:text-blue-600">Upload Song</span>
            </a>
          </Link>

          <Link href="/creator/analytics">
            <a className="flex flex-col items-center p-4 rounded-lg border-2 border-gray-200 hover:border-purple-600 hover:bg-purple-50 transition-all group">
              <div className="w-12 h-12 bg-purple-100 group-hover:bg-purple-600 rounded-full flex items-center justify-center mb-3 transition-colors">
                <svg className="h-6 w-6 text-purple-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="font-semibold text-gray-900 group-hover:text-purple-600">View Analytics</span>
            </a>
          </Link>

          <Link href="/creator/fans">
            <a className="flex flex-col items-center p-4 rounded-lg border-2 border-gray-200 hover:border-green-600 hover:bg-green-50 transition-all group">
              <div className="w-12 h-12 bg-green-100 group-hover:bg-green-600 rounded-full flex items-center justify-center mb-3 transition-colors">
                <svg className="h-6 w-6 text-green-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <span className="font-semibold text-gray-900 group-hover:text-green-600">Engage Fans</span>
            </a>
          </Link>

          <Link href="/creator/calendar">
            <a className="flex flex-col items-center p-4 rounded-lg border-2 border-gray-200 hover:border-orange-600 hover:bg-orange-50 transition-all group">
              <div className="w-12 h-12 bg-orange-100 group-hover:bg-orange-600 rounded-full flex items-center justify-center mb-3 transition-colors">
                <svg className="h-6 w-6 text-orange-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="font-semibold text-gray-900 group-hover:text-orange-600">Content Calendar</span>
            </a>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Revenue by Strategy */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Revenue by Strategy</h2>
          {revenueByStrategy.length > 0 ? (
            <div className="space-y-4">
              {revenueByStrategy.map((strategy) => {
                const revenue = parseFloat(strategy.total_revenue);
                const percentage = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;

                const strategyColors: Record<string, string> = {
                  'pay-per-stream': 'blue',
                  'gift-economy': 'green',
                  'patronage': 'purple',
                  'auction': 'pink',
                  'platform-subscription': 'indigo',
                };

                const color = strategyColors[strategy.strategy] || 'gray';

                return (
                  <div key={strategy.strategy}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold capitalize text-gray-900">
                        {strategy.strategy.replace(/-/g, ' ')}
                      </span>
                      <span className="font-bold text-gray-900">${revenue.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full bg-${color}-600 transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{percentage.toFixed(1)}% of total revenue</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-600">No revenue data yet. Start uploading songs!</p>
          )}
        </div>

        {/* Top Performing Songs */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Top Performing Songs</h2>
          {topSongs && topSongs.length > 0 ? (
            <div className="space-y-3">
              {topSongs.slice(0, 5).map((song, idx) => (
                <div key={song.song_id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{song.title}</div>
                    <div className="text-sm text-gray-600">
                      {song.play_count.toLocaleString()} plays · ${parseFloat(song.total_earnings).toFixed(2)}
                    </div>
                  </div>
                  <Link href={`/song/${song.song_id}`}>
                    <a className="text-blue-600 hover:text-blue-800 font-medium text-sm">View</a>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">No songs yet. Upload your first song to get started!</p>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Recent Activity</h2>
        {recentActivity && recentActivity.length > 0 ? (
          <div className="space-y-3">
            {recentActivity.slice(0, 10).map((activity) => {
              const activityIcons: Record<string, string> = {
                play: '▶️',
                comment: '💬',
                follow: '👤',
                patron: '⭐',
                playlist_add: '📝',
                purchase: '💰',
              };

              return (
                <div key={activity.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <span className="text-2xl">{activityIcons[activity.activity_type] || '📌'}</span>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{activity.description}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(activity.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-600">No recent activity. Your fans' interactions will appear here!</p>
        )}
      </div>

      {/* Tips & Resources */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
        <h3 className="text-xl font-bold text-gray-900 mb-4">💡 Creator Tips</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">🚀 Grow Your Audience</h4>
            <p className="text-sm text-gray-600">
              Upload consistently, engage with fans through comments, and use promotional tools to reach more listeners.
            </p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">💰 Maximize Earnings</h4>
            <p className="text-sm text-gray-600">
              Offer multiple economic strategies, create exclusive content for patrons, and run limited-time campaigns.
            </p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">📊 Track Performance</h4>
            <p className="text-sm text-gray-600">
              Use analytics to understand your audience, identify top songs, and optimize your content strategy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
