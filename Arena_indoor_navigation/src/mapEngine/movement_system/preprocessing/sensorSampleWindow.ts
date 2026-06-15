import { TimestampedSensorSample } from '../sensor/sensorTypes';

export interface SensorSampleWindow<TSample extends TimestampedSensorSample = TimestampedSensorSample> {
  readonly capacity: number;
  readonly samples: readonly TSample[];
}

function normalizeWindowCapacity(capacity: number): number {
  if (!Number.isFinite(capacity)) {
    return 1;
  }

  const normalizedCapacity = Math.floor(capacity);
  return normalizedCapacity > 0 ? normalizedCapacity : 1;
}

function sortSamples<TSample extends TimestampedSensorSample>(samples: readonly TSample[]): TSample[] {
  return [...samples].sort((left, right) => left.timestamp - right.timestamp);
}

function trimSamples<TSample>(samples: readonly TSample[], capacity: number): TSample[] {
  if (samples.length <= capacity) {
    return [...samples];
  }

  return samples.slice(samples.length - capacity);
}

export function createSensorSampleWindow<TSample extends TimestampedSensorSample>(
  capacity = 1,
  samples: readonly TSample[] = [],
): SensorSampleWindow<TSample> {
  const normalizedCapacity = normalizeWindowCapacity(capacity);
  const sortedSamples = sortSamples(samples);

  return {
    capacity: normalizedCapacity,
    samples: trimSamples(sortedSamples, normalizedCapacity),
  };
}

export function pushSensorSample<TSample extends TimestampedSensorSample>(
  window: SensorSampleWindow<TSample>,
  sample: TSample,
): SensorSampleWindow<TSample> {
  return createSensorSampleWindow(window.capacity, [...window.samples, sample]);
}

export function getLatestSensorSample<TSample extends TimestampedSensorSample>(
  window: SensorSampleWindow<TSample>,
): TSample | undefined {
  return window.samples[window.samples.length - 1];
}

export function getOldestSensorSample<TSample extends TimestampedSensorSample>(
  window: SensorSampleWindow<TSample>,
): TSample | undefined {
  return window.samples[0];
}

export function getSensorSampleWindowDurationMs<TSample extends TimestampedSensorSample>(
  window: SensorSampleWindow<TSample>,
): number {
  const oldestSample = getOldestSensorSample(window);
  const latestSample = getLatestSensorSample(window);

  if (!oldestSample || !latestSample) {
    return 0;
  }

  return Math.max(0, latestSample.timestamp - oldestSample.timestamp);
}

export function isSensorSampleWindowFull<TSample extends TimestampedSensorSample>(
  window: SensorSampleWindow<TSample>,
): boolean {
  return window.samples.length >= window.capacity;
}
