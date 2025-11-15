# 📊 Analytics & Monitoring Guide

Comprehensive guide to analytics, monitoring, and observability in the Mycelix Music platform.

## Table of Contents

1. [Overview](#overview)
2. [Backend Analytics](#backend-analytics)
3. [Frontend Analytics](#frontend-analytics)
4. [Prometheus Metrics](#prometheus-metrics)
5. [Grafana Dashboards](#grafana-dashboards)
6. [Custom Events](#custom-events)
7. [Privacy & Compliance](#privacy--compliance)

---

## Overview

The Mycelix Music platform includes comprehensive analytics and monitoring across three layers:

1. **Infrastructure Monitoring**: Prometheus + Grafana for system metrics
2. **Application Analytics**: Custom event tracking for business metrics
3. **User Analytics**: Frontend interaction tracking

### Architecture

```
┌─────────────────┐
│   Frontend      │
│   (Next.js)     │──────┐
└─────────────────┘      │
                         │ Events
┌─────────────────┐      │
│   API Server    │◄─────┘
│   (Express)     │
└─────────────────┘
         │
         │ Metrics
         ▼
┌─────────────────┐      ┌─────────────────┐
│   Prometheus    │─────►│    Grafana      │
└─────────────────┘      └─────────────────┘
```

---

## Backend Analytics

### Metrics Collection

The API server exposes Prometheus metrics at `/metrics`:

```typescript
import { analyticsMiddleware, metricsHandler } from './middleware/analytics';

// Apply middleware to all routes
app.use(analyticsMiddleware);

// Metrics endpoint
app.get('/metrics', metricsHandler);
```

### Available Metrics

**HTTP Metrics:**
- `http_requests_total` - Total HTTP requests by method, route, status
- `http_request_duration_seconds` - Request duration histogram

**Business Metrics:**
- `songs_uploaded_total` - Total songs uploaded
- `plays_total` - Total plays by song and strategy
- `payments_processed_total` - Total payments
- `payment_amount_total` - Total payment volume
- `unique_listeners_total` - Total unique listeners
- `active_users_total` - Active users by role

**Database Metrics:**
- `db_query_duration_seconds` - Database query duration
- `db_queries_total` - Total database queries

**Cache Metrics:**
- `cache_hits_total` - Cache hit count
- `cache_misses_total` - Cache miss count

**Error Metrics:**
- `errors_total` - Total errors by type and route

### Tracking Events

```typescript
import { AnalyticsService } from './middleware/analytics';

// Track song upload
AnalyticsService.trackSongUpload(artistAddress, songId);

// Track play
AnalyticsService.trackPlay(songId, strategy, listenerAddress);

// Track payment
AnalyticsService.trackPayment(strategy, token, amount, 'success');

// Track database query
AnalyticsService.trackDbQuery('SELECT', 'songs', duration, 'success');

// Track cache operation
AnalyticsService.trackCache('songs', true); // hit
AnalyticsService.trackCache('songs', false); // miss
```

---

## Frontend Analytics

### Setup

Analytics are automatically initialized when the app loads:

```typescript
import { analytics, useAnalytics } from '@/lib/analytics';

// In your _app.tsx
export function reportWebVitals(metric: any) {
  trackWebVitals(metric);
}

// In your component
function MyComponent() {
  useAnalytics(); // Automatically tracks page views

  return <div>...</div>;
}
```

### Tracking Events

**Wallet Events:**
```typescript
import { analytics, AnalyticsEvent } from '@/lib/analytics';

// User connects wallet
analytics.setUserId(walletAddress);
analytics.track(AnalyticsEvent.WALLET_CONNECTED, {
  walletType: 'metamask',
  chainId: 1,
});

// User disconnects
analytics.clearUserId();
analytics.track(AnalyticsEvent.WALLET_DISCONNECTED);
```

**Song Events:**
```typescript
// Song played
analytics.track(AnalyticsEvent.SONG_PLAYED, {
  songId: '123',
  artistAddress: '0x...',
  strategy: 'pay-per-stream',
});

// Song completed
analytics.trackSongPlay(songId, duration, true);

// Song shared
analytics.track(AnalyticsEvent.SONG_SHARED, {
  songId: '123',
  platform: 'twitter',
});
```

**Upload Events:**
```typescript
// Upload started
analytics.trackUpload('started', {
  fileSize: 5000000,
  strategy: 'gift-economy',
});

// Upload completed
analytics.trackUpload('completed', {
  songId: '123',
  duration: 15000, // ms
});

// Upload failed
analytics.trackUpload('failed', {
  error: 'File too large',
});
```

**Payment Events:**
```typescript
// Payment initiated
analytics.trackPayment(songId, strategy, amount, 'initiated');

// Payment confirmed
analytics.trackPayment(songId, strategy, amount, 'confirmed');

// Payment failed
analytics.trackPayment(songId, strategy, amount, 'failed');
```

**Error Tracking:**
```typescript
try {
  // Some operation
} catch (error) {
  analytics.trackError(error, {
    context: 'song_upload',
    songId: '123',
  });
}
```

---

## Prometheus Metrics

### Configuration

Prometheus is configured via `monitoring/prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'mycelix-api'
    static_configs:
      - targets: ['api:3100']
    metrics_path: '/metrics'
    scrape_interval: 10s
```

### Querying Metrics

**Request Rate:**
```promql
rate(http_requests_total[5m])
```

**Error Rate:**
```promql
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
```

**95th Percentile Response Time:**
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

**Songs Uploaded Per Hour:**
```promql
increase(songs_uploaded_total[1h])
```

**Total Revenue (last 24h):**
```promql
increase(payment_amount_total[24h])
```

**Active Users:**
```promql
sum(active_users_total) by (role)
```

**Cache Hit Rate:**
```promql
sum(rate(cache_hits_total[5m])) / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))
```

---

## Grafana Dashboards

### Accessing Grafana

Grafana is available at `http://localhost:3001` (or your production URL).

Default credentials:
- Username: `admin`
- Password: Set via `GRAFANA_ADMIN_PASSWORD` environment variable

### Pre-configured Dashboards

1. **Platform Overview**
   - Total songs, plays, users
   - Revenue trends
   - Active users by role

2. **API Performance**
   - Request rate
   - Error rate
   - Response time percentiles
   - Endpoint breakdown

3. **Database Performance**
   - Query duration
   - Connection pool usage
   - Slow query alerts

4. **Business Metrics**
   - Songs uploaded over time
   - Play count by strategy
   - Payment volume
   - User growth

### Creating Custom Dashboards

1. Navigate to Grafana (http://localhost:3001)
2. Click "+" → "Dashboard"
3. Add panel
4. Select "Prometheus" as data source
5. Enter PromQL query
6. Configure visualization
7. Save dashboard

**Example Panel - Play Count by Strategy:**
```promql
sum(increase(plays_total[1h])) by (strategy)
```

---

## Custom Events

### Backend Custom Events

Add custom business events by extending the `AnalyticsService`:

```typescript
// In middleware/analytics.ts
export class AnalyticsService {
  static trackCustomEvent(
    eventName: string,
    labels: Record<string, string>,
    value: number = 1
  ) {
    const counter = new Counter({
      name: `custom_${eventName}_total`,
      help: `Custom event: ${eventName}`,
      labelNames: Object.keys(labels),
    });

    counter.labels(labels).inc(value);
  }
}

// Usage
AnalyticsService.trackCustomEvent('referral', {
  source: 'twitter',
  artistId: '123',
}, 1);
```

### Frontend Custom Events

Add custom analytics events:

```typescript
// In lib/analytics.ts
export enum AnalyticsEvent {
  // Add your custom event
  CUSTOM_EVENT = 'custom_event',
}

// Track it
analytics.track(AnalyticsEvent.CUSTOM_EVENT, {
  customProperty: 'value',
});
```

---

## Alert Rules

Alerts are configured in `monitoring/alert_rules.yml`:

**High Error Rate Alert:**
```yaml
- alert: HighAPIErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "High API error rate detected"
    description: "API error rate is {{ $value }}% over the last 5 minutes"
```

**No Plays Alert (Business Metric):**
```yaml
- alert: NoPlaysInLastHour
  expr: increase(plays_total[1h]) == 0
  for: 1h
  labels:
    severity: warning
  annotations:
    summary: "No plays recorded in last hour"
    description: "This might indicate an issue with the platform"
```

### Alert Channels

Configure alert destinations in `monitoring/alertmanager.yml`:

```yaml
receivers:
  - name: 'critical'
    slack_configs:
      - channel: '#mycelix-critical'
        title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
    # Add PagerDuty for critical alerts
    pagerduty_configs:
      - service_key: ${PAGERDUTY_SERVICE_KEY}
```

---

## Privacy & Compliance

### Data Collection Policy

**What We Track:**
- ✅ Anonymized usage metrics (page views, feature usage)
- ✅ Performance metrics (Web Vitals, API response times)
- ✅ Error tracking (for debugging)
- ✅ Wallet addresses (public blockchain data)

**What We Don't Track:**
- ❌ Private keys or sensitive credentials
- ❌ Personal information (names, emails) unless explicitly provided
- ❌ User activity outside the platform
- ❌ Unnecessary user behavior

### GDPR Compliance

**User Rights:**
- **Right to Access**: Users can request all data we have about them
- **Right to Deletion**: Users can request deletion of their data
- **Right to Portability**: Users can export their data

**Implementation:**
```typescript
// API endpoint for data export
app.get('/api/user/:address/export', async (req, res) => {
  const { address } = req.params;
  const userData = await exportUserData(address);
  res.json(userData);
});

// API endpoint for data deletion
app.delete('/api/user/:address', async (req, res) => {
  const { address } = req.params;
  await deleteUserData(address);
  res.json({ success: true });
});
```

### Disabling Analytics

Users can opt-out of analytics:

```typescript
// Frontend opt-out
localStorage.setItem('analytics_opt_out', 'true');

// Check opt-out before tracking
if (localStorage.getItem('analytics_opt_out') !== 'true') {
  analytics.track(event, properties);
}
```

Environment variable to disable analytics:
```bash
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

---

## Monitoring Setup

### Starting Monitoring Stack

```bash
# Start all monitoring services
cd monitoring
./start-monitoring.sh
```

This starts:
- Prometheus (port 9090)
- Grafana (port 3001)
- PostgreSQL Exporter (port 9187)
- Redis Exporter (port 9121)
- Node Exporter (port 9100)
- Alertmanager (port 9093)

### Verifying Setup

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check API metrics
curl http://localhost:3100/metrics

# Check alert rules
curl http://localhost:9090/api/v1/rules
```

---

## Best Practices

### 1. Performance

- ✅ Use counters for cumulative metrics (plays, uploads)
- ✅ Use histograms for distributions (response times, file sizes)
- ✅ Use gauges for current values (active connections, queue size)
- ✅ Keep label cardinality low (< 100 unique combinations)

### 2. Privacy

- ✅ Hash sensitive identifiers
- ✅ Provide opt-out mechanism
- ✅ Document what you track
- ✅ Comply with GDPR/CCPA

### 3. Alerting

- ✅ Alert on symptoms, not causes
- ✅ Set appropriate thresholds
- ✅ Avoid alert fatigue
- ✅ Document runbooks for alerts

### 4. Dashboard Design

- ✅ Show high-level overview first
- ✅ Allow drill-down into details
- ✅ Use appropriate visualizations
- ✅ Keep dashboards focused

---

## Troubleshooting

### No Metrics Appearing

1. Check Prometheus is scraping the API:
   ```bash
   curl http://localhost:9090/api/v1/targets
   ```

2. Verify API is exposing metrics:
   ```bash
   curl http://localhost:3100/metrics
   ```

3. Check Prometheus logs:
   ```bash
   docker logs mycelix-prometheus
   ```

### High Cardinality Warning

If you see "series limit" warnings, reduce label cardinality:

```typescript
// ❌ Bad - too many unique values
metric.labels({ userId: address }).inc();

// ✅ Good - limited values
metric.labels({ userType: 'artist' }).inc();
```

### Grafana Not Connecting to Prometheus

Check datasource configuration:
1. Go to Grafana → Configuration → Data Sources
2. Verify Prometheus URL is correct: `http://prometheus:9090`
3. Test connection

---

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/best-practices/)

---

**Last Updated**: 2025-11-15
