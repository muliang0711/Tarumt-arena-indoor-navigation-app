import http from 'k6/http';
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

export const sessionFailures = new Rate('presence_failures');
export const protocolErrors = new Counter('presence_protocol_errors_total');
export const socketErrors = new Counter('presence_socket_errors_total');
export const acknowledgementTimeouts = new Counter('presence_ack_timeouts_total');
export const acceptedUpdates = new Counter('presence_updates_acked_total');
export const ackLatency = new Trend('presence_ack_latency_ms', true);
export const journeyStartAcks = new Counter('journey_start_acked_total');
export const journeyEndAcks = new Counter('journey_end_acked_total');
export const journeyStartLatency = new Trend('journey_start_ack_latency_ms', true);
export const journeyEndLatency = new Trend('journey_end_ack_latency_ms', true);

const gatewayHTTP = __ENV.GATEWAY_HTTP_URL || 'http://127.0.0.1:28080';
const gatewayWS = __ENV.GATEWAY_WS_URL || 'ws://127.0.0.1:28080/v1/presence';

export function createSession(label) {
  const installationID = `${label}-${__VU}-${__ITER}-${Date.now()}-performance-installation`;
  const response = http.post(
    `${gatewayHTTP}/v1/anonymous-sessions`,
    JSON.stringify({ installation_id: installationID }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'session_create' } },
  );
  const valid = check(response, {
    'session created': (candidate) => candidate.status === 201,
    'session has access token': (candidate) => candidate.status === 201 && Boolean(candidate.json('access_token')),
  });
  sessionFailures.add(!valid);
  return valid ? response.json() : null;
}

export function envelope(type, requestID, sequence, payload) {
  const result = {
    version: 1,
    type,
    request_id: requestID,
    sequence,
    timestamp: new Date().toISOString(),
  };
  if (payload !== undefined && payload !== null) {
    result.payload = payload;
  }
  return JSON.stringify(result);
}

export function runPresenceJourney(options = {}) {
  const label = options.label || 'presence';
  const updates = options.updates === undefined ? 5 : options.updates;
  const updateIntervalMs = options.updateIntervalMs || 500;
  const holdMs = options.holdMs || 1000;
  const buildingID = options.buildingID || 'performance-main';
  const floorID = options.floorID || '2';
  const session = createSession(label);
  if (!session) {
    return;
  }

  const sentAt = {};
  let sequence = 0;
  let acknowledged = 0;
  let finishing = false;
  const response = ws.connect(
    gatewayWS,
    { headers: { Authorization: `Bearer ${session.access_token}` }, tags: { endpoint: 'presence' } },
    (socket) => {
      const finishAfterAcknowledgements = () => {
        if (finishing) {
          return;
        }
        finishing = true;
        socket.setTimeout(() => {
          socket.send(envelope('leave', `leave-${__VU}-${__ITER}`, sequence + 1));
          socket.setTimeout(() => socket.close(), 250);
        }, holdMs);
      };

      socket.on('open', () => {
        sessionFailures.add(false);
        socket.send(envelope('subscribe_floor', `sub-${__VU}-${__ITER}`, 0, {
          building_id: buildingID,
          floor_id: floorID,
        }));

        socket.setInterval(() => {
          if (sequence >= updates) {
            return;
          }
          sequence += 1;
          const requestID = `loc-${__VU}-${__ITER}-${sequence}`;
          sentAt[requestID] = Date.now();
          socket.send(envelope('location_update', requestID, sequence, {
            position: {
              building_id: buildingID,
              floor_id: floorID,
              from_node_id: `node-${sequence % 4}`,
              to_node_id: `node-${(sequence + 1) % 4}`,
              edge_progress: (sequence % 10) / 10,
              heading: (sequence * 17) % 360,
              movement_state: 'walking',
            },
          }));
        }, updateIntervalMs);

        if (updates === 0) {
          finishAfterAcknowledgements();
        }
        const acknowledgementDeadline = Math.max(updateIntervalMs * (updates + 1) + holdMs + 5000, 5000);
        socket.setTimeout(() => {
          if (!finishing) {
            acknowledgementTimeouts.add(1);
            sessionFailures.add(true);
            socket.close();
          }
        }, acknowledgementDeadline);
      });

      socket.on('message', (data) => {
        let message;
        try {
          message = JSON.parse(data);
        } catch (_) {
          protocolErrors.add(1);
          sessionFailures.add(true);
          return;
        }
        if (message.type === 'ack' && sentAt[message.request_id] !== undefined) {
          ackLatency.add(Date.now() - sentAt[message.request_id]);
          acceptedUpdates.add(1);
          sessionFailures.add(false);
          delete sentAt[message.request_id];
          acknowledged += 1;
          if (acknowledged >= updates) {
            finishAfterAcknowledgements();
          }
        }
        if (message.type === 'error') {
          protocolErrors.add(1);
          sessionFailures.add(true);
        }
      });

      socket.on('error', () => {
        socketErrors.add(1);
        sessionFailures.add(true);
      });
    },
  );
  const upgraded = check(response, { 'websocket upgraded': (candidate) => candidate && candidate.status === 101 });
  sessionFailures.add(!upgraded);
}

export function runCanonicalJourney(options = {}) {
  const label = options.label || 'journey-lifecycle';
  const updates = options.updates === undefined ? 20 : options.updates;
  const updateIntervalMs = options.updateIntervalMs || 25;
  const holdMs = options.holdMs || 100;
  const session = createSession(label);
  if (!session) {
    return;
  }

  const iteration = `${__VU}-${__ITER}-${Date.now()}`;
  const startRequestID = `journey-start-${iteration}`;
  const endRequestID = `journey-end-${iteration}`;
  const clientJourneyKey = `journey-key-${iteration}`;
  const sentAt = {};
  let sequence = 0;
  let acknowledgedLocations = 0;
  let updateTimerStarted = false;
  let endSent = false;
  let completed = false;
  let activeJourneyID = '';

  const response = ws.connect(
    gatewayWS,
    { headers: { Authorization: `Bearer ${session.access_token}` }, tags: { endpoint: 'journey_presence' } },
    (socket) => {
      const failAndClose = () => {
        if (completed) {
          return;
        }
        completed = true;
        acknowledgementTimeouts.add(1);
        sessionFailures.add(true);
        socket.close();
      };

      const sendEnd = (journeyID) => {
        if (endSent) {
          return;
        }
        endSent = true;
        sentAt[endRequestID] = Date.now();
        socket.send(envelope('journey_end', endRequestID, 0, {
          client_event_id: `client-end-${iteration}`,
          client_journey_key: clientJourneyKey,
          journey_id: journeyID,
          outcome: 'arrived',
        }));
      };

      const startLocations = (journeyID) => {
        if (updateTimerStarted) {
          return;
        }
        updateTimerStarted = true;
        socket.setInterval(() => {
          if (sequence >= updates) {
            return;
          }
          sequence += 1;
          const requestID = `loc-${iteration}-${sequence}`;
          sentAt[requestID] = Date.now();
          socket.send(envelope('location_update', requestID, sequence, {
            position: {
              building_id: 'main-campus',
              floor_id: 'floor-2',
              from_node_id: 'node-1',
              to_node_id: 'node-21',
              edge_progress: Math.min(sequence / updates, 1),
              heading: 90,
              movement_state: 'walking',
            },
          }));
        }, updateIntervalMs);
        if (updates === 0) {
          sendEnd(journeyID);
        }
      };

      socket.on('open', () => {
        sessionFailures.add(false);
        socket.send(envelope('subscribe_floor', `sub-${iteration}`, 0, {
          building_id: 'main-campus',
          floor_id: 'floor-2',
        }));
        sentAt[startRequestID] = Date.now();
        socket.send(envelope('journey_start', startRequestID, 0, {
          client_event_id: `client-start-${iteration}`,
          client_journey_key: clientJourneyKey,
          map_id: 'main-campus',
          map_revision: 'sha256:9ce75cc7224ccc08e343761fb981c1625ca1b58231db1eb9c7270f1cf0a7865b',
          planned_route: {
            origin_node_id: 'node-1',
            destination_node_id: 'node-21',
            planned_edge_ids: ['edge-node-1-node-21'],
          },
        }));
        socket.setTimeout(
          failAndClose,
          Math.max(updateIntervalMs * (updates + 1) + holdMs + 5000, 5000),
        );
      });

      socket.on('message', (data) => {
        let message;
        try {
          message = JSON.parse(data);
        } catch (_) {
          protocolErrors.add(1);
          sessionFailures.add(true);
          return;
        }
        if (message.type === 'error') {
          protocolErrors.add(1);
          sessionFailures.add(true);
          return;
        }
        if (message.type !== 'ack') {
          return;
        }
        if (message.request_id === startRequestID) {
          journeyStartLatency.add(Date.now() - sentAt[startRequestID]);
          journeyStartAcks.add(1);
          sessionFailures.add(false);
          activeJourneyID = message.payload.journey_id;
          startLocations(activeJourneyID);
          return;
        }
        if (message.request_id === endRequestID) {
          journeyEndLatency.add(Date.now() - sentAt[endRequestID]);
          journeyEndAcks.add(1);
          sessionFailures.add(false);
          completed = true;
          socket.setTimeout(() => socket.close(), holdMs);
          return;
        }
        if (sentAt[message.request_id] !== undefined) {
          ackLatency.add(Date.now() - sentAt[message.request_id]);
          acceptedUpdates.add(1);
          sessionFailures.add(false);
          delete sentAt[message.request_id];
          acknowledgedLocations += 1;
          if (acknowledgedLocations >= updates) {
            sendEnd(activeJourneyID);
          }
        }
      });

      socket.on('error', () => {
        socketErrors.add(1);
        sessionFailures.add(true);
      });
    },
  );
  const upgraded = check(response, {
    'websocket upgraded': (candidate) => candidate && candidate.status === 101,
  });
  sessionFailures.add(!upgraded);
}
