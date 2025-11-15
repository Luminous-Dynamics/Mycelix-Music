/**
 * K6 Stress Testing Script
 *
 * This script stress tests the API to find breaking points
 *
 * Run with:
 *   k6 run performance/stress-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    // Ramp up to extreme load
    { duration: '2m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 400 },
    { duration: '2m', target: 800 },
    { duration: '2m', target: 1000 },

    // Maintain extreme load
    { duration: '5m', target: 1000 },

    // Ramp down
    { duration: '2m', target: 0 },
  ],

  thresholds: {
    // We expect higher error rates during stress test
    errors: ['rate<0.1'], // Less than 10% errors

    // Higher acceptable response times
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3100';

export default function () {
  const res = http.get(`${BASE_URL}/api/songs`);

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'status is not 5xx': (r) => r.status < 500,
  });

  errorRate.add(!success);

  sleep(0.5);
}

export function setup() {
  console.log('🔥 Starting STRESS test...');
  console.log('⚠️  This test will push the API to its limits');
  console.log(`Target: ${BASE_URL}`);
}

export function teardown(data) {
  console.log('Stress test complete!');
  console.log('Check metrics to find breaking points.');
}
