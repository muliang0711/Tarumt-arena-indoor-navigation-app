import assert from 'node:assert/strict';
import test from 'node:test';

import type { ExpoMovementSensorDiagnosticState } from './expoMovementSensorAdapterCore';
import type { MovementSensorCollectorDiagnostic } from './movementSensorCollector';
import { deriveMovementSensorStatus } from './movementSensorStatus';

function collector(
  status: MovementSensorCollectorDiagnostic['status'],
): MovementSensorCollectorDiagnostic {
  return {
    status,
    startedAt: null,
    subscribedAt: null,
    firstSampleAt: null,
    firstBatchAt: null,
  };
}

function adapter(
  statuses: Partial<
    Record<
      keyof ExpoMovementSensorDiagnosticState['sensors'],
      ExpoMovementSensorDiagnosticState['sensors']['accelerometer']['status']
    >
  >,
): ExpoMovementSensorDiagnosticState {
  const createSensor = (
    status: ExpoMovementSensorDiagnosticState['sensors']['accelerometer']['status'],
  ) => ({
    status,
    subscriptionAttemptAt: null,
    subscriptionReadyAt: null,
    firstSampleAt: null,
    errorMessage: null,
  });

  return {
    sensors: {
      accelerometer: createSensor(statuses.accelerometer ?? 'idle'),
      gyroscope: createSensor(statuses.gyroscope ?? 'idle'),
      magnetometer: createSensor(statuses.magnetometer ?? 'idle'),
      deviceMotion: createSensor(statuses.deviceMotion ?? 'idle'),
    },
  };
}

test('mock mode and a receiving collector report receiving', () => {
  assert.equal(
    deriveMovementSensorStatus('mock', collector('idle'), adapter({})),
    'receiving',
  );
  assert.equal(
    deriveMovementSensorStatus('real', collector('receiving'), adapter({})),
    'receiving',
  );
});

test('real mode reports starting while an independent sensor is starting or subscribed', () => {
  assert.equal(
    deriveMovementSensorStatus(
      'real',
      collector('starting'),
      adapter({ deviceMotion: 'starting' }),
    ),
    'starting',
  );
  assert.equal(
    deriveMovementSensorStatus(
      'real',
      collector('subscribed'),
      adapter({ deviceMotion: 'subscribed' }),
    ),
    'starting',
  );
});

test('real mode reports error before unavailable when no sensor is receiving', () => {
  assert.equal(
    deriveMovementSensorStatus(
      'real',
      collector('error'),
      adapter({ magnetometer: 'error', deviceMotion: 'unavailable' }),
    ),
    'error',
  );
  assert.equal(
    deriveMovementSensorStatus(
      'real',
      collector('stopped'),
      adapter({ deviceMotion: 'unavailable' }),
    ),
    'unavailable',
  );
});
