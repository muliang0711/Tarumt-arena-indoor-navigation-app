import type { DeviceMotionMeasurement } from 'expo-sensors';

import type { MotionInputSample } from '../pdr';

export function deviceMotionToMotionInputSample(input: {
  desiredHeadingDegrees: number;
  measurement: DeviceMotionMeasurement;
  receivedAtMs: number;
}): MotionInputSample | null {
  if (!input.measurement.acceleration) {
    return null;
  }

  return {
    acceleration: {
      x: input.measurement.acceleration.x,
      y: input.measurement.acceleration.y,
      z: input.measurement.acceleration.z,
    },
    headingDegrees: resolveHeadingDegrees({
      desiredHeadingDegrees: input.desiredHeadingDegrees,
      rotationAlpha: input.measurement.rotation.alpha,
    }),
    timestampMs: input.receivedAtMs,
  };
}

function resolveHeadingDegrees(input: {
  desiredHeadingDegrees: number;
  rotationAlpha: number;
}) {
  if (!Number.isFinite(input.rotationAlpha)) {
    return input.desiredHeadingDegrees;
  }

  return input.rotationAlpha;
}
