import { runPresenceJourney } from '../lib/presence.js';

export const options = {
  scenarios: {
    connection_churn: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RATE || 20),
      timeUnit: '1s',
      duration: __ENV.DURATION || '2m',
      preAllocatedVUs: Number(__ENV.PREALLOCATED_VUS || 50),
      maxVUs: Number(__ENV.MAX_VUS || 200),
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    dropped_iterations: ['count==0'],
    presence_failures: ['rate<0.01'],
    'http_req_duration{endpoint:session_create}': ['p(95)<750'],
  },
};

export default function () {
  runPresenceJourney({ label: 'churn', updates: 1, updateIntervalMs: 100, holdMs: 100 });
}
