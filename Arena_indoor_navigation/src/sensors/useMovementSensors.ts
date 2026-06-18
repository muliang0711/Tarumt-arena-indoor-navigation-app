import { useEffect, useState } from 'react';

import type { RawSensorSample } from '../mapEngine/map-controller';
import { expoMovementSensorAdapter } from './expoMovementSensorAdapter';
import { MovementSensorCollector } from './movementSensorCollector';

export const EMPTY_SENSOR_SAMPLES: readonly RawSensorSample[] = Object.freeze([]);

export function useMovementSensors(enabled = true): readonly RawSensorSample[] {
  const [sensorSamples, setSensorSamples] =
    useState<readonly RawSensorSample[]>(EMPTY_SENSOR_SAMPLES);

  useEffect(() => {
    if (!enabled) {
      setSensorSamples(EMPTY_SENSOR_SAMPLES);
      return;
    }

    const collector = new MovementSensorCollector(
      expoMovementSensorAdapter,
      (batch) => setSensorSamples(batch),
      { capacity: 128, batchIntervalMs: 250 },
    );
    void collector.start();

    return () => collector.stop();
  }, [enabled]);

  return sensorSamples;
}
