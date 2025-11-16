/**
 * Artist Revenue Panel
 * Shows artist earnings from platform subscriptions
 */

import React, { useState } from 'react';
import { useArtistRevenue } from '../../hooks/useSubscription';

interface ArtistRevenuePanelProps {
  artistAddress: string;
  months?: number;
}

export default function ArtistRevenuePanel({
  artistAddress,
  months = 12,
}: ArtistRevenuePanelProps) {
  const { data, isLoading, error } = useArtistRevenue(artistAddress, months);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-8 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-xl font-semibold text-red-900 mb-2">
          Error Loading Revenue Data
        </h3>
        <p className="text-red-700">
          Failed to load your subscription revenue. Please try again later.
        </p>
      </div>
    );
  }

  const distributions = data?.distributions || [];
  const totalEarnings = data?.totalEarnings || 0;
  const monthCount = data?.monthCount || 0;

  if (distributions.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-8 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-xl font-semibold text-blue-900 mb-2">
          No Subscription Revenue Yet
        </h3>
        <p className="text-blue-700">
          You'll start earning from platform subscriptions once users play your music.
          Revenue is distributed monthly based on your share of total plays.
        </p>
      </div>
    );
  }

  const avgMonthlyEarnings = totalEarnings / (monthCount || 1);

  const selectedDistribution = selectedMonth
    ? distributions.find((d) => d.month === selectedMonth)
    : null;

  const formatMonth = (monthStr: string) => {
    const date = new Date(monthStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const getGrowthRate = (currentIdx: number) => {
    if (currentIdx >= distributions.length - 1) return null;
    const current = parseFloat(distributions[currentIdx].earnings);
    const previous = parseFloat(distributions[currentIdx + 1].earnings);
    if (previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">
        Subscription Revenue Dashboard
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="text-sm opacity-90 mb-2">Total Earnings</div>
          <div className="text-3xl font-bold">${totalEarnings.toFixed(2)}</div>
          <div className="text-xs opacity-75 mt-2">
            From {monthCount} month{monthCount !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="text-sm opacity-90 mb-2">Avg. Monthly</div>
          <div className="text-3xl font-bold">${avgMonthlyEarnings.toFixed(2)}</div>
          <div className="text-xs opacity-75 mt-2">Per month</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="text-sm opacity-90 mb-2">Total Plays</div>
          <div className="text-3xl font-bold">
            {distributions.reduce((sum, d) => sum + d.play_count, 0).toLocaleString()}
          </div>
          <div className="text-xs opacity-75 mt-2">Subscription plays</div>
        </div>

        <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl shadow-lg p-6 text-white">
          <div className="text-sm opacity-90 mb-2">Latest Month</div>
          <div className="text-3xl font-bold">
            ${distributions.length > 0 ? parseFloat(distributions[0].earnings).toFixed(2) : '0.00'}
          </div>
          <div className="text-xs opacity-75 mt-2">
            {distributions.length > 0 ? formatMonth(distributions[0].month) : 'N/A'}
          </div>
        </div>
      </div>

      {/* Revenue Distribution Info */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-8 border border-blue-200">
        <h3 className="font-semibold text-gray-900 mb-3">
          💡 How Subscription Revenue Works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
              1
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-1">
                70% to Artist Pool
              </div>
              <div className="text-gray-600">
                70% of all subscription revenue goes into a monthly artist pool
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
              2
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-1">
                Play-Based Distribution
              </div>
              <div className="text-gray-600">
                Your earnings = Your plays ÷ Total plays × Artist pool
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">
            Monthly Breakdown
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Month
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plays
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Play Share
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Earnings
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Growth
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {distributions.map((dist, idx) => {
                const growthRate = getGrowthRate(idx);
                const isSelected = selectedMonth === dist.month;

                return (
                  <React.Fragment key={dist.month}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatMonth(dist.month)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {dist.play_count.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          of {dist.total_plays.toLocaleString()} total
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {parseFloat(dist.share_percentage).toFixed(3)}%
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-green-600">
                          ${parseFloat(dist.earnings).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            dist.distributed
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {dist.distributed ? 'Paid' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {growthRate !== null && (
                          <div
                            className={`text-sm font-semibold ${
                              growthRate >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {growthRate >= 0 ? '↑' : '↓'} {Math.abs(growthRate).toFixed(1)}%
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() =>
                            setSelectedMonth(isSelected ? null : dist.month)
                          }
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {isSelected ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>

                    {isSelected && selectedDistribution && (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 bg-blue-50">
                          <div className="space-y-3">
                            <h4 className="font-semibold text-gray-900 mb-3">
                              {formatMonth(selectedDistribution.month)} Details
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-white rounded-lg p-4">
                                <div className="text-xs text-gray-600 mb-1">
                                  Your Plays
                                </div>
                                <div className="text-2xl font-bold text-gray-900">
                                  {selectedDistribution.play_count.toLocaleString()}
                                </div>
                              </div>
                              <div className="bg-white rounded-lg p-4">
                                <div className="text-xs text-gray-600 mb-1">
                                  Platform Total Plays
                                </div>
                                <div className="text-2xl font-bold text-gray-900">
                                  {selectedDistribution.total_plays.toLocaleString()}
                                </div>
                              </div>
                              <div className="bg-white rounded-lg p-4">
                                <div className="text-xs text-gray-600 mb-1">
                                  Your Share
                                </div>
                                <div className="text-2xl font-bold text-blue-600">
                                  {parseFloat(selectedDistribution.share_percentage).toFixed(3)}%
                                </div>
                              </div>
                            </div>

                            <div className="bg-white rounded-lg p-4">
                              <div className="text-xs text-gray-600 mb-2">
                                Calculation:
                              </div>
                              <div className="font-mono text-sm text-gray-700">
                                {selectedDistribution.play_count.toLocaleString()} plays ÷{' '}
                                {selectedDistribution.total_plays.toLocaleString()} total plays ×
                                Artist Pool = ${parseFloat(selectedDistribution.earnings).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue Chart Placeholder */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">
          Revenue Trend
        </h3>
        <div className="h-64 flex items-end justify-around gap-2">
          {distributions.slice(0, 12).reverse().map((dist, idx) => {
            const earnings = parseFloat(dist.earnings);
            const maxEarnings = Math.max(
              ...distributions.map((d) => parseFloat(d.earnings))
            );
            const height = (earnings / maxEarnings) * 100;

            return (
              <div key={dist.month} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-gradient-to-t from-blue-600 to-purple-600 rounded-t-lg transition-all hover:from-blue-700 hover:to-purple-700 cursor-pointer"
                  style={{ height: `${height}%`, minHeight: '4px' }}
                  title={`${formatMonth(dist.month)}: $${earnings.toFixed(2)}`}
                />
                <div className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-top-left">
                  {new Date(dist.month).toLocaleDateString('en-US', { month: 'short' })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
