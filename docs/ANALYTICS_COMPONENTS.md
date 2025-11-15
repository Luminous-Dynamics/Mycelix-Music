## 🎨 Advanced Analytics Components

Complete guide to using analytics visualizations and dashboards in Mycelix Music.

## Table of Contents

1. [Overview](#overview)
2. [Analytics Hooks](#analytics-hooks)
3. [Chart Components](#chart-components)
4. [Dashboard Components](#dashboard-components)
5. [Usage Examples](#usage-examples)
6. [Customization](#customization)
7. [Best Practices](#best-practices)

---

## Overview

The analytics component library provides a complete set of React components for visualizing music platform data:

- **📊 15+ Chart Types** - Line, bar, pie, area, heatmaps, and more
- **🎯 Custom Hooks** - React Query-powered data fetching
- **🖥️ Pre-built Dashboards** - Artist, listener, and platform dashboards
- **⚡ Real-time Updates** - Auto-refreshing data
- **📱 Responsive** - Mobile-friendly charts and layouts
- **🎨 Themeable** - Dark mode support

### Technology Stack

- **React 18+** - Component framework
- **React Query** - Data fetching and caching
- **Recharts** - Chart library
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety

---

## Analytics Hooks

### Core Hooks

#### `useArtistAnalytics(address)`

Fetch comprehensive artist statistics.

```typescript
import { useArtistAnalytics } from '@/hooks/useAnalytics';

function ArtistProfile({ address }: { address: string }) {
  const { data, isLoading, isError } = useArtistAnalytics(address);

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Error loading data</div>;

  return (
    <div>
      <h1>{data.artist_name}</h1>
      <p>Total Plays: {data.total_plays}</p>
      <p>Total Earnings: ${data.total_earnings}</p>
      <p>Unique Listeners: {data.unique_listeners}</p>
    </div>
  );
}
```

**Returns**:
```typescript
{
  artist_address: string;
  artist_name: string;
  total_songs: number;
  total_plays: number;
  unique_listeners: number;
  total_earnings: string;
  avg_earning_per_play: string;
  plays_last_30_days: number;
  plays_last_7_days: number;
  last_play_date: string | null;
  last_refreshed: string;
}
```

---

#### `useSongAnalytics(songId)`

Get detailed song performance metrics.

```typescript
import { useSongAnalytics } from '@/hooks/useAnalytics';

function SongStats({ songId }: { songId: string }) {
  const { data } = useSongAnalytics(songId);

  if (!data) return null;

  return (
    <div>
      <h2>{data.title}</h2>
      <p>Play Count: {data.play_count}</p>
      <p>Trending Score: {data.trending_score}</p>
      <p>Total Earnings: ${data.total_earnings}</p>
    </div>
  );
}
```

**Returns**:
```typescript
{
  song_id: string;
  title: string;
  artist_address: string;
  genre: string;
  strategy: string;
  play_count: number;
  unique_listeners: number;
  total_earnings: string;
  trending_score: number;
  plays_last_7_days: number;
  plays_last_30_days: number;
  // ... more fields
}
```

---

#### `usePlatformStats()`

Platform-wide statistics.

```typescript
import { usePlatformStats } from '@/hooks/useAnalytics';

function PlatformOverview() {
  const { data } = usePlatformStats();

  return (
    <div>
      <StatCard title="Total Artists" value={data.total_artists} />
      <StatCard title="Total Songs" value={data.total_songs} />
      <StatCard title="Total Plays" value={data.total_plays} />
      <StatCard title="Total Volume" value={`$${data.total_volume}`} />
    </div>
  );
}
```

---

#### `useTrendingSongs(limit, genre?)`

Get trending songs with optional genre filter.

```typescript
import { useTrendingSongs } from '@/hooks/useAnalytics';

function TrendingSection() {
  const { data: all } = useTrendingSongs(20);
  const { data: electronic } = useTrendingSongs(10, 'Electronic');

  return (
    <div>
      <h2>All Trending</h2>
      <SongList songs={all} />

      <h2>Trending in Electronic</h2>
      <SongList songs={electronic} />
    </div>
  );
}
```

---

#### `useGenreStats()`

Genre performance statistics.

```typescript
import { useGenreStats } from '@/hooks/useAnalytics';

function GenreAnalytics() {
  const { data } = useGenreStats();

  return (
    <table>
      <thead>
        <tr>
          <th>Genre</th>
          <th>Songs</th>
          <th>Plays</th>
          <th>Earnings</th>
        </tr>
      </thead>
      <tbody>
        {data?.map((genre) => (
          <tr key={genre.genre}>
            <td>{genre.genre}</td>
            <td>{genre.total_songs}</td>
            <td>{genre.total_plays}</td>
            <td>${genre.total_earnings}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

### Dashboard Hooks

#### `useArtistDashboard(address)`

Combined data for artist dashboard (analytics + top songs + recent plays).

```typescript
import { useArtistDashboard } from '@/hooks/useAnalytics';

function ArtistDash({ address }: { address: string }) {
  const { analytics, topSongs, recentPlays, isLoading } = useArtistDashboard(address);

  if (isLoading) return <Spinner />;

  return (
    <div>
      <OverviewStats data={analytics.data} />
      <TopSongsChart songs={topSongs.data} />
      <RecentPlaysTable plays={recentPlays.data} />
    </div>
  );
}
```

---

#### `useListenerDashboard(address)`

Combined data for listener dashboard.

```typescript
import { useListenerDashboard } from '@/hooks/useAnalytics';

function ListenerDash({ address }: { address: string }) {
  const { activity, recentPlays, favoriteArtists } = useListenerDashboard(address);

  return (
    <div>
      <ListenerStats data={activity.data} />
      <RecentPlays plays={recentPlays.data} />
      <FavoriteArtists artists={favoriteArtists.data} />
    </div>
  );
}
```

---

### Utility Hooks

#### `useRealtimeAnalytics(fetchFn, interval)`

Auto-refreshing data for real-time dashboards.

```typescript
import { useRealtimeAnalytics } from '@/hooks/useAnalytics';

function LiveStats() {
  const { data } = useRealtimeAnalytics(
    async () => {
      const res = await fetch('/api/analytics/live');
      return res.json();
    },
    5000 // Refresh every 5 seconds
  );

  return <div>Live Plays: {data?.currentPlays}</div>;
}
```

---

## Chart Components

All charts are built with Recharts and are fully responsive.

### `<StatCard />`

Display key metrics with trend indicator.

```typescript
import { StatCard } from '@/components/analytics/Charts';

<StatCard
  title="Total Earnings"
  value={1234.56}
  format="currency"
  change={15.3}  // +15.3% change
  trend={[
    { value: 100 },
    { value: 120 },
    { value: 150 },
  ]}
/>
```

**Props**:
- `title` - Card title
- `value` - Main value to display
- `format?` - `'number' | 'currency' | 'percent'`
- `change?` - Percentage change (positive/negative)
- `trend?` - Array of values for sparkline

---

### `<EarningsChart />`

Area chart for earnings over time.

```typescript
import { EarningsChart } from '@/components/analytics/Charts';

<EarningsChart
  data={[
    { date: 'Jan 1', earnings: 100 },
    { date: 'Jan 2', earnings: 150 },
    { date: 'Jan 3', earnings: 200 },
  ]}
  height={300}
/>
```

---

### `<PlaysChart />`

Line chart for plays over time.

```typescript
import { PlaysChart } from '@/components/analytics/Charts';

<PlaysChart
  data={[
    { date: 'Mon', plays: 1000 },
    { date: 'Tue', plays: 1200 },
    { date: 'Wed', plays: 1500 },
  ]}
  height={300}
/>
```

---

### `<TopSongsChart />`

Horizontal bar chart for top songs.

```typescript
import { TopSongsChart } from '@/components/analytics/Charts';

<TopSongsChart
  data={[
    { title: 'Song A', plays: 5000 },
    { title: 'Song B', plays: 4000 },
    { title: 'Song C', plays: 3000 },
  ]}
  height={300}
/>
```

---

### `<StrategyDistributionChart />`

Pie chart for strategy distribution.

```typescript
import { StrategyDistributionChart } from '@/components/analytics/Charts';

<StrategyDistributionChart
  data={[
    { name: 'Pay-Per-Stream', value: 45 },
    { name: 'Gift Economy', value: 25 },
    { name: 'Patronage', value: 20 },
    { name: 'Auction', value: 10 },
  ]}
  height={300}
/>
```

---

### `<GenrePerformanceChart />`

Dual-axis bar chart for genre metrics.

```typescript
import { GenrePerformanceChart } from '@/components/analytics/Charts';

<GenrePerformanceChart
  data={[
    { genre: 'Rock', plays: 10000, earnings: 500 },
    { genre: 'Electronic', plays: 8000, earnings: 600 },
    { genre: 'Jazz', plays: 5000, earnings: 400 },
  ]}
  height={300}
/>
```

---

### `<EngagementTimelineChart />`

Multi-line chart for engagement metrics.

```typescript
import { EngagementTimelineChart } from '@/components/analytics/Charts';

<EngagementTimelineChart
  data={[
    { date: 'Jan 1', plays: 1000, listeners: 200, earnings: 50 },
    { date: 'Jan 2', plays: 1200, listeners: 250, earnings: 60 },
  ]}
  height={350}
/>
```

---

### `<CalendarHeatmap />`

GitHub-style activity heatmap.

```typescript
import { CalendarHeatmap } from '@/components/analytics/Charts';

<CalendarHeatmap
  data={generateLast365Days().map((date) => ({
    date: date,
    plays: Math.random() * 100,
  }))}
/>
```

---

### `<Sparkline />`

Compact trend indicator.

```typescript
import { Sparkline } from '@/components/analytics/Charts';

<Sparkline
  data={[
    { value: 10 },
    { value: 15 },
    { value: 12 },
    { value: 20 },
  ]}
  color="#3b82f6"
  height={40}
/>
```

---

## Dashboard Components

### Artist Dashboard

Complete artist analytics dashboard.

```typescript
import { ArtistDashboard } from '@/components/analytics/ArtistDashboard';

function ArtistPage({ params }: { params: { address: string } }) {
  return <ArtistDashboard artistAddress={params.address} />;
}
```

**Features**:
- Key metrics cards (earnings, plays, listeners)
- Earnings and plays charts
- Top songs visualization
- Recent plays table
- Activity heatmap
- Time range selector (7d, 30d, all)

---

### Platform Dashboard

Admin-level platform analytics.

```typescript
import { PlatformDashboard } from '@/components/analytics/PlatformDashboard';

function AdminPage() {
  return <PlatformDashboard />;
}
```

**Features**:
- Platform-wide statistics
- Activity metrics (24h, 7d, 30d)
- Strategy distribution
- Genre performance
- Trending songs
- Top artists table
- Health indicators

---

## Usage Examples

### Example 1: Custom Artist Overview

```typescript
import { useArtistAnalytics, formatCurrency } from '@/hooks/useAnalytics';
import { StatCard, TopSongsChart } from '@/components/analytics/Charts';

function CustomArtistOverview({ address }: { address: string }) {
  const { data, isLoading } = useArtistAnalytics(address);

  if (isLoading) return <div>Loading...</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="Total Earnings"
          value={parseFloat(data.total_earnings)}
          format="currency"
        />
        <StatCard
          title="Total Plays"
          value={data.total_plays}
          format="number"
        />
        <StatCard
          title="Listeners"
          value={data.unique_listeners}
          format="number"
        />
      </div>

      <div>
        <h2>Performance This Week</h2>
        <p>Plays: {data.plays_last_7_days}</p>
        <p>Growth: {((data.plays_last_7_days / data.total_plays) * 100).toFixed(1)}%</p>
      </div>
    </div>
  );
}
```

---

### Example 2: Trending Songs Widget

```typescript
import { useTrendingSongs } from '@/hooks/useAnalytics';
import { TrendingScoreChart } from '@/components/analytics/Charts';

function TrendingWidget() {
  const { data } = useTrendingSongs(10);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">Trending Now</h2>
      {data && (
        <TrendingScoreChart
          data={data.map((song) => ({
            title: song.title,
            score: song.trending_score,
          }))}
          height={300}
        />
      )}
    </div>
  );
}
```

---

### Example 3: Real-time Platform Stats

```typescript
import { useRealtimeAnalytics } from '@/hooks/useAnalytics';
import { StatCard } from '@/components/analytics/Charts';

function LivePlatformStats() {
  const { data } = useRealtimeAnalytics(
    async () => {
      const res = await fetch('/api/analytics/platform');
      return res.json();
    },
    30000 // Refresh every 30 seconds
  );

  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard title="Active Listeners" value={data?.activeListeners || 0} />
      <StatCard title="Plays (24h)" value={data?.plays24h || 0} />
      <StatCard title="New Songs" value={data?.newSongs || 0} />
      <StatCard title="Total Volume" value={`$${data?.volume || 0}`} />
    </div>
  );
}
```

---

### Example 4: Genre Comparison

```typescript
import { useGenreStats } from '@/hooks/useAnalytics';
import { GenrePerformanceChart } from '@/components/analytics/Charts';

function GenreComparison() {
  const { data } = useGenreStats();

  const topGenres = data?.slice(0, 5) || [];

  return (
    <div>
      <h2>Top 5 Genres</h2>
      <GenrePerformanceChart
        data={topGenres.map((genre) => ({
          genre: genre.genre,
          plays: genre.total_plays,
          earnings: parseFloat(genre.total_earnings),
        }))}
        height={350}
      />
    </div>
  );
}
```

---

## Customization

### Custom Colors

Override chart colors:

```typescript
const CUSTOM_COLORS = {
  primary: '#ff6b6b',
  secondary: '#4ecdc4',
  tertiary: '#ffe66d',
};

<AreaChart data={data}>
  <Area fill={CUSTOM_COLORS.primary} stroke={CUSTOM_COLORS.primary} />
</AreaChart>
```

---

### Custom Formatting

Use utility functions:

```typescript
import { formatCurrency, formatNumber, formatRelativeTime } from '@/hooks/useAnalytics';

// Currency: $1,234.56
const formatted = formatCurrency(1234.56);

// Numbers: 1.2K, 1.5M
const formatted = formatNumber(1234567);

// Relative time: "5m ago", "2h ago", "3d ago"
const formatted = formatRelativeTime(new Date());
```

---

### Dark Mode

All components support dark mode via Tailwind:

```tsx
<div className="bg-white dark:bg-gray-800">
  <h1 className="text-gray-900 dark:text-white">Title</h1>
  <p className="text-gray-600 dark:text-gray-400">Description</p>
</div>
```

---

## Best Practices

### 1. Use React Query Caching

Set appropriate stale times:

```typescript
// Fast-changing data: 30 seconds
useRealtimeAnalytics(fetchFn, 30000);

// Medium-changing data: 5 minutes
useQuery({ queryKey: ['data'], staleTime: 300000 });

// Slow-changing data: 1 hour
useQuery({ queryKey: ['data'], staleTime: 3600000 });
```

---

### 2. Handle Loading States

Always show loading indicators:

```typescript
const { data, isLoading } = useArtistAnalytics(address);

if (isLoading) {
  return <Skeleton />;
}

return <Dashboard data={data} />;
```

---

### 3. Error Handling

Gracefully handle errors:

```typescript
const { data, isError, error } = usePlatformStats();

if (isError) {
  return (
    <div className="text-center py-12">
      <p className="text-red-600">Failed to load data</p>
      <button onClick={() => refetch()}>Retry</button>
    </div>
  );
}
```

---

### 4. Optimize Chart Rendering

Limit data points for performance:

```typescript
// Good: Show last 30 days
const data = fullData.slice(-30);

// Bad: Show all 10,000 data points
const data = fullData;
```

---

### 5. Responsive Design

Use responsive grid layouts:

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  <StatCard title="Metric 1" value={100} />
  <StatCard title="Metric 2" value={200} />
  <StatCard title="Metric 3" value={300} />
  <StatCard title="Metric 4" value={400} />
</div>
```

---

## Performance Tips

1. **Lazy Load Charts**: Only render charts when visible
2. **Debounce Searches**: Delay search queries by 300ms
3. **Paginate Tables**: Show 20-50 rows at a time
4. **Use Virtualization**: For large lists (react-window)
5. **Memoize Components**: Use `React.memo()` for expensive renders

---

## Troubleshooting

### Charts Not Rendering

- Ensure Recharts is installed: `npm install recharts`
- Check that data is in correct format
- Verify parent container has height set

### Data Not Loading

- Check API endpoints are correct
- Verify authentication/authorization
- Check browser console for errors
- Ensure materialized views are refreshed

### Poor Performance

- Reduce data points in charts
- Increase cache times
- Use pagination for large datasets
- Implement virtual scrolling

---

## Resources

- [Recharts Documentation](https://recharts.org/)
- [React Query Guide](https://tanstack.com/query)
- [Tailwind CSS](https://tailwindcss.com/)
- [Database Optimization Guide](./DATABASE_OPTIMIZATION.md)

---

**Last Updated**: 2025-11-15
