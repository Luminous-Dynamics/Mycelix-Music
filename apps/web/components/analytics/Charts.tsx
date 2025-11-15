/**
 * Analytics Chart Components
 * Reusable charts for data visualization using Recharts
 */

'use client';

import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { formatCurrency, formatNumber } from '@/hooks/useAnalytics';

// Color palette
const COLORS = {
  primary: '#8884d8',
  secondary: '#82ca9d',
  tertiary: '#ffc658',
  quaternary: '#ff7c7c',
  gradient: ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#a4de6c'],
};

// Chart wrapper with responsive container
interface ChartWrapperProps {
  children: React.ReactNode;
  height?: number;
}

function ChartWrapper({ children, height = 300 }: ChartWrapperProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      {children}
    </ResponsiveContainer>
  );
}

// Earnings Over Time Chart
interface EarningsChartProps {
  data: Array<{ date: string; earnings: number }>;
  height?: number;
}

export function EarningsChart({ data, height }: EarningsChartProps) {
  return (
    <ChartWrapper height={height}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis tickFormatter={(value) => formatCurrency(value)} />
        <Tooltip formatter={(value: number) => formatCurrency(value)} />
        <Legend />
        <Area
          type="monotone"
          dataKey="earnings"
          stroke={COLORS.primary}
          fill={COLORS.primary}
          fillOpacity={0.6}
        />
      </AreaChart>
    </ChartWrapper>
  );
}

// Plays Over Time Chart
interface PlaysChartProps {
  data: Array<{ date: string; plays: number }>;
  height?: number;
}

export function PlaysChart({ data, height }: PlaysChartProps) {
  return (
    <ChartWrapper height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis tickFormatter={formatNumber} />
        <Tooltip formatter={(value: number) => formatNumber(value)} />
        <Legend />
        <Line
          type="monotone"
          dataKey="plays"
          stroke={COLORS.secondary}
          strokeWidth={2}
        />
      </LineChart>
    </ChartWrapper>
  );
}

// Strategy Distribution Chart
interface StrategyDistributionProps {
  data: Array<{ name: string; value: number }>;
  height?: number;
}

export function StrategyDistributionChart({
  data,
  height,
}: StrategyDistributionProps) {
  return (
    <ChartWrapper height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={(entry) => `${entry.name}: ${entry.value}`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS.gradient[index % COLORS.gradient.length]}
            />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ChartWrapper>
  );
}

// Top Songs Bar Chart
interface TopSongsChartProps {
  data: Array<{ title: string; plays: number }>;
  height?: number;
}

export function TopSongsChart({ data, height }: TopSongsChartProps) {
  return (
    <ChartWrapper height={height}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tickFormatter={formatNumber} />
        <YAxis type="category" dataKey="title" width={150} />
        <Tooltip formatter={(value: number) => formatNumber(value)} />
        <Legend />
        <Bar dataKey="plays" fill={COLORS.primary} />
      </BarChart>
    </ChartWrapper>
  );
}

// Genre Performance Chart
interface GenreChartProps {
  data: Array<{ genre: string; plays: number; earnings: number }>;
  height?: number;
}

export function GenrePerformanceChart({ data, height }: GenreChartProps) {
  return (
    <ChartWrapper height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="genre" />
        <YAxis yAxisId="left" tickFormatter={formatNumber} />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickFormatter={(value) => formatCurrency(value)}
        />
        <Tooltip />
        <Legend />
        <Bar yAxisId="left" dataKey="plays" fill={COLORS.primary} />
        <Bar yAxisId="right" dataKey="earnings" fill={COLORS.secondary} />
      </BarChart>
    </ChartWrapper>
  );
}

// Listener Growth Chart
interface ListenerGrowthProps {
  data: Array<{ date: string; listeners: number; newListeners: number }>;
  height?: number;
}

export function ListenerGrowthChart({ data, height }: ListenerGrowthProps) {
  return (
    <ChartWrapper height={height}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis tickFormatter={formatNumber} />
        <Tooltip formatter={(value: number) => formatNumber(value)} />
        <Legend />
        <Area
          type="monotone"
          dataKey="listeners"
          stackId="1"
          stroke={COLORS.primary}
          fill={COLORS.primary}
        />
        <Area
          type="monotone"
          dataKey="newListeners"
          stackId="2"
          stroke={COLORS.secondary}
          fill={COLORS.secondary}
        />
      </AreaChart>
    </ChartWrapper>
  );
}

// Trending Score Chart
interface TrendingScoreProps {
  data: Array<{ title: string; score: number }>;
  height?: number;
}

export function TrendingScoreChart({ data, height }: TrendingScoreProps) {
  return (
    <ChartWrapper height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="title" angle={-45} textAnchor="end" height={100} />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="score" fill={COLORS.tertiary}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                entry.score > 100
                  ? '#ff7c7c'
                  : entry.score > 50
                  ? '#ffc658'
                  : '#82ca9d'
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ChartWrapper>
  );
}

// Revenue by Strategy Chart
interface RevenueByStrategyProps {
  data: Array<{ strategy: string; revenue: number; songs: number }>;
  height?: number;
}

export function RevenueByStrategyChart({
  data,
  height,
}: RevenueByStrategyProps) {
  return (
    <ChartWrapper height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="strategy" />
        <YAxis tickFormatter={(value) => formatCurrency(value)} />
        <Tooltip formatter={(value: number) => formatCurrency(value)} />
        <Legend />
        <Bar dataKey="revenue" fill={COLORS.primary} />
      </BarChart>
    </ChartWrapper>
  );
}

// Engagement Timeline Chart
interface EngagementTimelineProps {
  data: Array<{
    date: string;
    plays: number;
    listeners: number;
    earnings: number;
  }>;
  height?: number;
}

export function EngagementTimelineChart({
  data,
  height,
}: EngagementTimelineProps) {
  return (
    <ChartWrapper height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis yAxisId="left" tickFormatter={formatNumber} />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickFormatter={(value) => formatCurrency(value)}
        />
        <Tooltip />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="plays"
          stroke={COLORS.primary}
          strokeWidth={2}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="listeners"
          stroke={COLORS.secondary}
          strokeWidth={2}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="earnings"
          stroke={COLORS.tertiary}
          strokeWidth={2}
        />
      </LineChart>
    </ChartWrapper>
  );
}

// Comparison Chart (Artist vs Platform Average)
interface ComparisonChartProps {
  data: Array<{
    metric: string;
    artist: number;
    platform: number;
  }>;
  height?: number;
}

export function ComparisonChart({ data, height }: ComparisonChartProps) {
  return (
    <ChartWrapper height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="metric" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="artist" fill={COLORS.primary} name="Your Stats" />
        <Bar dataKey="platform" fill={COLORS.secondary} name="Platform Average" />
      </BarChart>
    </ChartWrapper>
  );
}

// Sparkline Chart (Compact trend indicator)
interface SparklineProps {
  data: Array<{ value: number }>;
  color?: string;
  height?: number;
}

export function Sparkline({
  data,
  color = COLORS.primary,
  height = 50,
}: SparklineProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Heatmap-style Calendar Chart
interface CalendarHeatmapProps {
  data: Array<{ date: string; plays: number }>;
  height?: number;
}

export function CalendarHeatmap({ data, height }: CalendarHeatmapProps) {
  // Group by week and day of week
  const maxPlays = Math.max(...data.map((d) => d.plays));

  const getColor = (plays: number) => {
    const intensity = plays / maxPlays;
    if (intensity > 0.75) return '#0e4429';
    if (intensity > 0.5) return '#006d32';
    if (intensity > 0.25) return '#26a641';
    if (intensity > 0) return '#39d353';
    return '#ebedf0';
  };

  return (
    <div className="flex flex-wrap gap-1">
      {data.map((day, index) => (
        <div
          key={index}
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: getColor(day.plays) }}
          title={`${day.date}: ${day.plays} plays`}
        />
      ))}
    </div>
  );
}

// Stat Card with Trend Indicator
interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  trend?: Array<{ value: number }>;
  format?: 'number' | 'currency' | 'percent';
}

export function StatCard({
  title,
  value,
  change,
  trend,
  format = 'number',
}: StatCardProps) {
  const formatValue = () => {
    if (format === 'currency' && typeof value === 'number') {
      return formatCurrency(value);
    }
    if (format === 'number' && typeof value === 'number') {
      return formatNumber(value);
    }
    if (format === 'percent' && typeof value === 'number') {
      return `${value.toFixed(1)}%`;
    }
    return value;
  };

  const isPositive = change !== undefined && change >= 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
        {title}
      </h3>
      <div className="mt-2 flex items-baseline justify-between">
        <p className="text-3xl font-semibold text-gray-900 dark:text-white">
          {formatValue()}
        </p>
        {change !== undefined && (
          <span
            className={`text-sm font-medium ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {isPositive ? '+' : ''}
            {change.toFixed(1)}%
          </span>
        )}
      </div>
      {trend && trend.length > 0 && (
        <div className="mt-4">
          <Sparkline data={trend} color={isPositive ? '#10b981' : '#ef4444'} />
        </div>
      )}
    </div>
  );
}

// Mini donut chart for quick stats
interface MiniDonutProps {
  value: number;
  max: number;
  label: string;
  color?: string;
}

export function MiniDonut({
  value,
  max,
  label,
  color = COLORS.primary,
}: MiniDonutProps) {
  const percentage = (value / max) * 100;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="#e5e7eb"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke={color}
            strokeWidth="8"
            fill="none"
            strokeDasharray={`${(percentage / 100) * 251.2} 251.2`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold">{percentage.toFixed(0)}%</span>
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{label}</p>
    </div>
  );
}
