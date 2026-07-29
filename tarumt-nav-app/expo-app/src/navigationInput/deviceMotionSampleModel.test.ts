import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DeviceMotionMeasurement } from 'expo-sensors';

import { deviceMotionToMotionInputSample } from './deviceMotionSampleModel';

function measurement(
  acceleration: DeviceMotionMeasurement['acceleration'],
  alpha: number,
): DeviceMotionMeasurement {
  return {
    acceleration,
    accelerationIncludingGravity: {
      timestamp: 1,
      x: 0,
      y: 0,
      z: 9.8,
    },
    interval: 50,
    orientation: 0,
    rotation: {
      alpha,
      beta: 0,
      gamma: 0,
      timestamp: 1,
    },
    rotationRate: null,
  };
}

test('converts device motion into transient PDR input without storing it', () => {
  assert.deepEqual(
    deviceMotionToMotionInputSample({
      desiredHeadingDegrees: 90,
      measurement: measurement(
        {
          timestamp: 1.25,
          x: 1,
          y: 2,
          z: 3,
        },
        42,
      ),
      receivedAtMs: 1500,
    }),
    {
      acceleration: {
        x: 1,
        y: 2,
        z: 3,
      },
      headingDegrees: 42,
      timestampMs: 1500,
    },
  );
});

test('drops device motion samples without acceleration', () => {
  assert.equal(
    deviceMotionToMotionInputSample({
      desiredHeadingDegrees: 90,
      measurement: measurement(null, Number.NaN),
      receivedAtMs: 1500,
    }),
    null,
  );
});
