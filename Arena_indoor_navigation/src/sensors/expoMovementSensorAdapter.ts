import {
  Accelerometer,
  DeviceMotion,
  Gyroscope,
  Magnetometer,
  Pedometer,
} from 'expo-sensors';

import {
  createExpoMovementSensorAdapterCore,
  type ExpoMovementSensorAdapter,
  type ExpoMovementSensorDiagnosticState,
  type RealDeviceSensorDiagnostic,
  type RealDeviceSensorKind,
} from './expoMovementSensorAdapterCore';

export function createExpoMovementSensorAdapter(): ExpoMovementSensorAdapter {
  return createExpoMovementSensorAdapterCore({
    Accelerometer,
    Gyroscope,
    Magnetometer,
    DeviceMotion,
    Pedometer,
    now: () => Date.now(),
  });
}

export const expoMovementSensorAdapter = createExpoMovementSensorAdapter();

export type {
  ExpoMovementSensorAdapter,
  ExpoMovementSensorDiagnosticState,
  RealDeviceSensorDiagnostic,
  RealDeviceSensorKind,
};
