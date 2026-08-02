import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';

const analyticsURL = __ENV.ANALYTICS_URL || 'http://127.0.0.1:29092';
const failures = new Rate('analytics_read_failures');

export const options = {
  scenarios: {
    analytics_reads: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RATE || 10),
      timeUnit: '1s',
      duration: __ENV.DURATION || '2m',
      preAllocatedVUs: Number(__ENV.PREALLOCATED_VUS || 20),
      maxVUs: Number(__ENV.MAX_VUS || 100),
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    dropped_iterations: ['count==0'],
    analytics_read_failures: ['rate<0.01'],
    'http_req_duration{endpoint:analytics}': ['p(95)<1000', 'p(99)<2000'],
  },
};

function currentBucket() {
  const bucketMs = 15 * 60 * 1000;
  const from = Math.floor(Date.now() / bucketMs) * bucketMs;
  return {
    from: new Date(from).toISOString(),
    to: new Date(from + bucketMs).toISOString(),
  };
}

export default function () {
  const window = currentBucket();
  const endpoint = __ITER % 2 === 0 ? 'floor-traffic' : 'route-edges';
  const query = `building_id=performance-main&floor_id=2&from=${encodeURIComponent(window.from)}&to=${encodeURIComponent(window.to)}&bucket=15m`;
  const response = http.get(`${analyticsURL}/v1/analytics/${endpoint}?${query}`, { tags: { endpoint: 'analytics', query: endpoint } });
  const valid = check(response, {
    'analytics response is 200': (candidate) => candidate.status === 200,
    'analytics response has no identity fields': (candidate) => !/(journey_id|event_id|device_id|session_id)/.test(candidate.body),
  });
  failures.add(!valid);
}
