/**
 * K6 Load Testing Script for Mycelix Music API
 *
 * This script tests the API under various load conditions to ensure
 * it can handle production traffic.
 *
 * Run with:
 *   k6 run performance/k6-load-test.js
 *
 * Run with custom thresholds:
 *   k6 run --vus 100 --duration 5m performance/k6-load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const songListDuration = new Trend('song_list_duration');
const songDetailDuration = new Trend('song_detail_duration');
const playEventDuration = new Trend('play_event_duration');

// Test configuration
export const options = {
  stages: [
    // Ramp-up: 0 to 50 users over 30 seconds
    { duration: '30s', target: 50 },

    // Stay at 50 users for 1 minute
    { duration: '1m', target: 50 },

    // Ramp-up: 50 to 100 users over 30 seconds
    { duration: '30s', target: 100 },

    // Stay at 100 users for 2 minutes
    { duration: '2m', target: 100 },

    // Spike test: 100 to 200 users instantly
    { duration: '10s', target: 200 },

    // Stay at 200 users for 1 minute
    { duration: '1m', target: 200 },

    // Ramp-down: 200 to 0 users over 30 seconds
    { duration: '30s', target: 0 },
  ],

  thresholds: {
    // 95% of requests should be below 200ms
    http_req_duration: ['p(95)<200'],

    // Less than 1% errors
    errors: ['rate<0.01'],

    // Specific endpoint thresholds
    'http_req_duration{endpoint:song_list}': ['p(95)<100'],
    'http_req_duration{endpoint:song_detail}': ['p(95)<150'],
    'http_req_duration{endpoint:play_event}': ['p(95)<300'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3100';

// Sample data for testing
const testArtistAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const testListenerAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

export default function () {
  // ============================================================================
  // Test 1: Get all songs (most common operation)
  // ============================================================================

  {
    const res = http.get(`${BASE_URL}/api/songs`, {
      tags: { endpoint: 'song_list' },
    });

    const success = check(res, {
      'song list status is 200': (r) => r.status === 200,
      'song list response time < 200ms': (r) => r.timings.duration < 200,
      'song list returns array': (r) => Array.isArray(JSON.parse(r.body)),
    });

    errorRate.add(!success);
    songListDuration.add(res.timings.duration);
  }

  sleep(1);

  // ============================================================================
  // Test 2: Get song by ID
  // ============================================================================

  {
    // First, get a song ID from the list
    const listRes = http.get(`${BASE_URL}/api/songs`);
    if (listRes.status === 200) {
      const songs = JSON.parse(listRes.body);
      if (songs.length > 0) {
        const songId = songs[Math.floor(Math.random() * songs.length)].song_id;

        const res = http.get(`${BASE_URL}/api/songs/${songId}`, {
          tags: { endpoint: 'song_detail' },
        });

        const success = check(res, {
          'song detail status is 200': (r) => r.status === 200,
          'song detail response time < 150ms': (r) => r.timings.duration < 150,
          'song detail returns object': (r) => typeof JSON.parse(r.body) === 'object',
        });

        errorRate.add(!success);
        songDetailDuration.add(res.timings.duration);
      }
    }
  }

  sleep(1);

  // ============================================================================
  // Test 3: Filter songs by genre
  // ============================================================================

  {
    const genres = ['Electronic', 'Hip Hop', 'Rock', 'Pop'];
    const genre = genres[Math.floor(Math.random() * genres.length)];

    const res = http.get(`${BASE_URL}/api/songs?genre=${genre}`, {
      tags: { endpoint: 'song_list_filtered' },
    });

    check(res, {
      'filtered song list status is 200': (r) => r.status === 200,
      'filtered results match genre': (r) => {
        try {
          const songs = JSON.parse(r.body);
          return songs.length === 0 || songs.every((s) => s.genre === genre);
        } catch {
          return false;
        }
      },
    });
  }

  sleep(1);

  // ============================================================================
  // Test 4: Record play event (write operation)
  // ============================================================================

  {
    const songId = '0x' + '1'.repeat(64);
    const playData = {
      song_id: songId,
      listener_address: testListenerAddress,
      amount_paid: '0.01',
      payment_type: 'stream',
    };

    const res = http.post(`${BASE_URL}/api/plays`, JSON.stringify(playData), {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'play_event' },
    });

    const success = check(res, {
      'play event status is 201 or 404': (r) => r.status === 201 || r.status === 404, // 404 if song doesn't exist
      'play event response time < 300ms': (r) => r.timings.duration < 300,
    });

    errorRate.add(!success && res.status !== 404);
    if (res.status !== 404) {
      playEventDuration.add(res.timings.duration);
    }
  }

  sleep(2);

  // ============================================================================
  // Test 5: Health check
  // ============================================================================

  {
    const res = http.get(`${BASE_URL}/health`, {
      tags: { endpoint: 'health' },
    });

    check(res, {
      'health check status is 200': (r) => r.status === 200,
      'health check returns ok': (r) => {
        try {
          return JSON.parse(r.body).status === 'ok';
        } catch {
          return false;
        }
      },
    });
  }

  sleep(1);
}

// Setup function (runs once before load test)
export function setup() {
  console.log('Starting load test...');
  console.log(`Target: ${BASE_URL}`);

  // Verify API is accessible
  const res = http.get(`${BASE_URL}/health`);
  if (res.status !== 200) {
    throw new Error(`API is not accessible at ${BASE_URL}`);
  }

  console.log('API is accessible. Beginning load test...');
}

// Teardown function (runs once after load test)
export function teardown(data) {
  console.log('Load test complete!');
}
