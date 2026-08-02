import { runPresenceJourney } from '../lib/presence.js';

export const options = {
  scenarios: {
    steady_presence: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP_UP || '30s', target: Number(__ENV.VUS || 100) },
        { duration: __ENV.DURATION || '2m', target: Number(__ENV.VUS || 100) },
        { duration: __ENV.RAMP_DOWN || '15s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    presence_failures: ['rate<0.01'],
    presence_ack_latency_ms: ['p(95)<1000', 'p(99)<2000'],
  },
};

export default function () {
  runPresenceJourney({ label: 'steady', updates: 20, updateIntervalMs: 1000, holdMs: 2000 });
}
