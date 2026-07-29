import type { MagnetometerMeasurement } from 'expo-sensors';

export function magnetometerToHeadingDegrees(
  measurement: MagnetometerMeasurement,
) {
  const headingDegrees =
    (Math.atan2(measurement.y, measurement.x) * 180) / Math.PI;

  return normalizeDegrees(headingDegrees);
}

function normalizeDegrees(degrees: number) {
  return ((degrees % 360) + 360) % 360;
}
