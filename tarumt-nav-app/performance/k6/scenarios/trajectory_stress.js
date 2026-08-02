import { runPresenceJourney } from '../lib/presence.js';

export const options = {
  scenarios: {
    trajectory_stress: {
      executor: 'ramping-arrival-rate',
      startRate: Number(__ENV.START_RATE || 10),
      timeUnit: '1s',
      preAllocatedVUs: Number(__ENV.PREALLOCATED_VUS || 150),
      maxVUs: Number(__ENV.MAX_VUS || 500),
      stages: [
        { duration: __ENV.STAGE_ONE || '20s', target: Number(__ENV.RATE_ONE || 25) },
        { duration: __ENV.STAGE_TWO || '20s', target: Number(__ENV.RATE_TWO || 50) },
        { duration: __ENV.STAGE_THREE || '20s', target: Number(__ENV.RATE_THREE || 100) },
      ],
    },
  },
  thresholds: {
    checks: ['rate>0.95'],
    presence_failures: ['rate<0.05'],
    presence_ack_latency_ms: ['p(95)<1000', 'p(99)<2000'],
  },
};

export default function () {
  runPresenceJourney({ label: 'stress', updates: 20, updateIntervalMs: 25, holdMs: 100 });
}
