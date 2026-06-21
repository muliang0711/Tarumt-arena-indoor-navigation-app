import assert from 'node:assert/strict';
import test from 'node:test';

import type { MovementDebugSnapshot } from '../movementDebugModel';
import {
  createMovementDebugLogEntry,
  resolveMovementDebugLogServerOrigin,
  serializeMovementDebugLogEntry,
} from './movementDebugFileLog';

function createSnapshot(): MovementDebugSnapshot {
  return {
    totalSamples: 3,
    counts: {
      accelerometer: 0,
      gyroscope: 0,
      magnetometer: 0,
      pedometer: 1,
      deviceMotion: 2,
    },
    latestSampleKind: 'deviceMotion',
    latestTimestamp: 1234,
    latestKnownPedometerSteps: 29,
    pedometerBaselineSteps: 28,
    stepsSinceReset: 1,
    latestStepDelta: 1,
    status: 'processed',
    position: { x: 4.8, y: 5.9 },
    headingDegrees: 90,
    confidence: 0.91,
    particleGeneration: 12,
    latestStepDiagnostics: {
      batchPedometerSampleCount: 1,
      batchLatestPedometerSteps: 29,
      batchLatestPedometerTimestamp: 1200,
      previousStepCountBefore: 28,
      previousStepCountAfter: 29,
      computedStepDelta: 1,
      reason: 'positive-increment',
    },
    latestMovementAttempt: {
      currentPosition: { x: 4.8, y: 5.2 },
      candidatePosition: { x: 4.8, y: 5.9 },
      finalAcceptedPosition: { x: 4.8, y: 5.9 },
      headingRadians: Math.PI / 2,
      distanceMeters: 0.7,
      canMove: true,
      insideWalkableArea: true,
      insideBlockedArea: false,
      crossedWall: false,
      crossedBlockedArea: false,
      rejectionReasons: [],
    },
    destinationLabel: 'Node 4',
  };
}

test('creates a compact movement debug log entry from the snapshot and source steps', () => {
  const entry = createMovementDebugLogEntry(createSnapshot(), {
    sourceRawCumulativeSteps: 29,
    deviceTimeIso: '2026-06-21T10:00:00.000Z',
  });

  assert.equal(entry.sourceRawCumulativeSteps, 29);
  assert.equal(entry.batchLatestPedometerSteps, 29);
  assert.equal(entry.runtimePreviousStepCountBefore, 28);
  assert.equal(entry.runtimePreviousStepCountAfter, 29);
  assert.equal(entry.computedStepDelta, 1);
  assert.equal(entry.reason, 'positive-increment');
  assert.equal(entry.canMove, true);
  assert.deepEqual(entry.rejectionReasons, []);
});

test('serializes one JSON line per log entry', () => {
  const line = serializeMovementDebugLogEntry(
    createMovementDebugLogEntry(createSnapshot(), {
      sourceRawCumulativeSteps: 29,
      deviceTimeIso: '2026-06-21T10:00:00.000Z',
    }),
  );

  assert.ok(line.endsWith('\n'));
  const parsed = JSON.parse(line);
  assert.equal(parsed.sourceRawCumulativeSteps, 29);
  assert.equal(parsed.reason, 'positive-increment');
});

test('resolves the local movement debug log server origin from an Expo or Metro script url', () => {
  assert.equal(
    resolveMovementDebugLogServerOrigin(
      'http://192.168.0.15:8081/index.bundle?platform=ios',
      4123,
    ),
    'http://192.168.0.15:4123',
  );
  assert.equal(
    resolveMovementDebugLogServerOrigin(
      'exp://10.0.0.8:8081',
      4123,
    ),
    'http://10.0.0.8:4123',
  );
});

test('returns null when no usable dev script url is available', () => {
  assert.equal(resolveMovementDebugLogServerOrigin(null, 4123), null);
  assert.equal(resolveMovementDebugLogServerOrigin('file:///main.jsbundle', 4123), null);
  assert.equal(resolveMovementDebugLogServerOrigin('not-a-url', 4123), null);
});
