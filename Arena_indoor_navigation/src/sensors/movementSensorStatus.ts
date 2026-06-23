import type { ExpoMovementSensorDiagnosticState } from './expoMovementSensorAdapterCore';
import type { MovementSensorCollectorDiagnostic } from './movementSensorCollector';

export type MovementSensorStatus =
  | 'starting'
  | 'receiving'
  | 'unavailable'
  | 'error';

export function deriveMovementSensorStatus(
  mode: 'real' | 'mock',
  collector: MovementSensorCollectorDiagnostic,
  adapter: ExpoMovementSensorDiagnosticState,
): MovementSensorStatus {
  if (mode === 'mock' || collector.status === 'receiving') {
    return 'receiving';
  }

  const sensorStates = Object.values(adapter.sensors);
  if (
    collector.status === 'starting' ||
    collector.status === 'subscribed' ||
    sensorStates.some(
      (sensor) =>
        sensor.status === 'starting' || sensor.status === 'subscribed',
    )
  ) {
    return 'starting';
  }

  if (
    collector.status === 'error' ||
    sensorStates.some((sensor) => sensor.status === 'error')
  ) {
    return 'error';
  }

  return 'unavailable';
}
