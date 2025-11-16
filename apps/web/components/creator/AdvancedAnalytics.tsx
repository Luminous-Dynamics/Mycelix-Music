/**
 * Advanced Analytics Component
 * Detailed analytics and reporting for creators
 */

import React, { useState } from 'react';
import { useRevenueAnalytics, useTopSongs, useAudienceAnalytics, useExportAnalytics } from '../../hooks/useCreator';

interface AdvancedAnalyticsProps {
  artistAddress: string;
}

export default function AdvancedAnalytics({ artistAddress }: AdvancedAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const { data: revenue, isLoading: revenueLoading } = useRevenueAnalytics(artistAddress, timeRange);
  const { data: topSongs, isLoading: topSongsLoading } = useTopSongs(artistAddress, 10);
  const { data: audience, isLoading: audienceLoading } = useAudienceAnalytics(artistAddress, timeRange);
  const exportAnalytics = useExportAnalytics();

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const data = await exportAnalytics.mutateAsync({ artistAddress, format });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${artistAddress}-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(`Export failed: ${error.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Advanced Analytics</h1>
          <p className="text-gray-600">Deep insights into your performance and audience</p>
        </div>
        <div className="flex gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
            className="px-4 py-2 border border-gray-300 rounded-lg font-semibold"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <button
            onClick={() => handleExport('json')}
            className="px-4 py-2 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200"
          >
            📊 Export JSON
          </button>
        </div>
      </div>

      {/* Revenue Analytics */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Revenue Analytics</h2>
        {revenueLoading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : revenue ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
              <div className="text-sm text-green-700 mb-2">Total Revenue</div>
              <div className="text-3xl font-bold text-green-900">${revenue.total.toFixed(2)}</div>
            </div>
            <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
              <div className="text-sm text-blue-700 mb-2">Average per Day</div>
              <div className="text-3xl font-bold text-blue-900">${revenue.avgPerDay.toFixed(2)}</div>
            </div>
            <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
              <div className="text-sm text-purple-700 mb-2">Best Day</div>
              <div className="text-3xl font-bold text-purple-900">${revenue.bestDay.toFixed(2)}</div>
            </div>
          </div>
        ) : (
          <p className="text-gray-600">No revenue data available</p>
        )}
      </div>

      {/* Top Songs */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Top Performing Songs</h2>
        {topSongsLoading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : topSongs && topSongs.length > 0 ? (
          <div className="space-y-4">
            {topSongs.map((song, idx) => (
              <div key={song.song_id} className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{song.title}</h3>
                  <div className="text-sm text-gray-600">
                    {song.play_count.toLocaleString()} plays · ${parseFloat(song.total_earnings).toFixed(2)} earned
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No song data available</p>
        )}
      </div>

      {/* Audience Analytics */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Audience Insights</h2>
        {audienceLoading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : audience ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 border-2 border-gray-200 rounded-lg">
              <div className="text-sm text-gray-600 mb-2">New Followers</div>
              <div className="text-3xl font-bold text-gray-900">{audience.newFollowers}</div>
            </div>
            <div className="p-6 border-2 border-gray-200 rounded-lg">
              <div className="text-sm text-gray-600 mb-2">Engagement Rate</div>
              <div className="text-3xl font-bold text-gray-900">{audience.engagementRate}%</div>
            </div>
          </div>
        ) : (
          <p className="text-gray-600">No audience data available</p>
        )}
      </div>
    </div>
  );
}
