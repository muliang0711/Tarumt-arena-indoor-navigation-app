import type { RawSensorSample } from '../mapEngine/shared';

export function findLatestPedometerStepCount(
  samples: readonly RawSensorSample[],
): number | null {
  const latestPedometer = samples
    .filter(
      (
        sample,
      ): sample is Extract<RawSensorSample, { kind: 'pedometer' }> =>
        sample.kind === 'pedometer' && Number.isFinite(sample.steps),
    )
    .sort((left, right) => left.timestamp - right.timestamp)
    .at(-1);

  return latestPedometer?.steps ?? null;
}
