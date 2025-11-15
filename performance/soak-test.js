/**
 * K6 Soak Testing Script
 *
 * This script runs a sustained load test to identify memory leaks,
 * resource exhaustion, and performance degradation over time.
 *
 * Run with:
 *   k6 run performance/soak-test.js
 *
 * Note: This test runs for several hours
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseDuration = new Trend('response_duration');

export const options = {
  stages: [
    // Ramp-up
    { duration: '5m', target: 50 },

    // Sustained load for 4 hours
    { duration: '4h', target: 50 },

    // Ramp-down
    { duration: '5m', target: 0 },
  ],

  thresholds: {
    // Stricter thresholds for sustained load
    errors: ['rate<0.01'],
    http_req_duration: ['p(95)<200', 'p(99)<500'],

    // Watch for degradation over time
    'http_req_duration{degradation:check}': ['p(95)<250'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

export default function () {
  // Simulate realistic user behavior

  // Browse songs
  {
    const res = http.get(`${BASE_URL}/api/songs`);

    const success = check(res, {
      'songs list status is 200': (r) => r.status === 200,
    });

    errorRate.add(!success);
    responseDuration.add(res.timings.duration);
  }

  sleep(3);

  // View song details
  {
    const res = http.get(`${BASE_URL}/api/songs/0x${'1'.repeat(64)}`);

    check(res, {
      'song detail responds': (r) => r.status === 200 || r.status === 404,
    });
  }

  sleep(5);

  // Check health periodically
  if (Math.random() < 0.1) {
    http.get(`${BASE_URL}/health`, {
      tags: { degradation: 'check' },
    });
  }

  sleep(10);
}

export function setup() {
  console.log('⏱️  Starting SOAK test (4 hour duration)...');
  console.log(`Target: ${BASE_URL}`);
  console.log('This test will run for ~4 hours');
}

export function teardown(data) {
  console.log('✅ Soak test complete!');
  console.log('Review metrics for any performance degradation over time.');
}
