import { runPresenceJourney } from '../lib/presence.js';

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || '15s',
  thresholds: {
    checks: ['rate>0.99'],
    presence_failures: ['rate<0.01'],
    presence_ack_latency_ms: ['p(95)<1000'],
    'http_req_duration{endpoint:session_create}': ['p(95)<750'],
  },
};

export default function () {
  runPresenceJourney({ label: 'smoke', updates: 3, updateIntervalMs: 250, holdMs: 500 });
}
