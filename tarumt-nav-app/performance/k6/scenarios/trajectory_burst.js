import { runPresenceJourney } from '../lib/presence.js';

export const options = {
  scenarios: {
    trajectory_burst: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RATE || 20),
      timeUnit: '1s',
      duration: __ENV.DURATION || '1m',
      preAllocatedVUs: Number(__ENV.PREALLOCATED_VUS || 100),
      maxVUs: Number(__ENV.MAX_VUS || 300),
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    dropped_iterations: ['count==0'],
    presence_failures: ['rate<0.01'],
    presence_ack_latency_ms: ['p(95)<1000'],
  },
};

export default function () {
  runPresenceJourney({ label: 'burst', updates: 20, updateIntervalMs: 25, holdMs: 100 });
}
