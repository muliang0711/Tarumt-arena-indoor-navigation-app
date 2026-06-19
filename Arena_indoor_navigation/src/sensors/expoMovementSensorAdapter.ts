import {
  Accelerometer,
  DeviceMotion,
  Gyroscope,
  Magnetometer,
  Pedometer,
  type AccelerometerMeasurement,
  type DeviceMotionMeasurement,
  type GyroscopeMeasurement,
  type MagnetometerMeasurement,
} from 'expo-sensors';

import type { RawSensorSample } from '../mapEngine/shared';
import type { MovementSensorAdapter, SensorSubscription } from './movementSensorCollector';
import { RealPedometerMonitor } from './realPedometerMonitor';

const UPDATE_INTERVAL_MS = 100;
type SensorKind = RawSensorSample['kind'];

type PermissionCapableSensor<TMeasurement> = {
  isAvailableAsync(): Promise<boolean>;
  getPermissionsAsync(): Promise<{ granted: boolean }>;
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  setUpdateInterval(intervalMs: number): void;
  addListener(listener: (measurement: TMeasurement) => void): SensorSubscription;
};

let sampleSequence = 0;
let lastTimestamp = 0;

function nextSampleIdentity(kind: SensorKind): { id: string; timestamp: number } {
  sampleSequence += 1;
  const timestamp = Math.max(Date.now(), lastTimestamp + 0.001);
  lastTimestamp = timestamp;
  return {
    id: `${kind}:${sampleSequence}`,
    timestamp,
  };
}

async function subscribeDeviceSensor<TMeasurement>(
  sensor: PermissionCapableSensor<TMeasurement>,
  onMeasurement: (measurement: TMeasurement) => RawSensorSample,
  onSample: (sample: RawSensorSample) => void,
): Promise<SensorSubscription | null> {
  try {
    if (!(await sensor.isAvailableAsync())) {
      return null;
    }

    const existingPermission = await sensor.getPermissionsAsync();
    const permission = existingPermission.granted
      ? existingPermission
      : await sensor.requestPermissionsAsync();
    if (!permission.granted) {
      return null;
    }

    sensor.setUpdateInterval(UPDATE_INTERVAL_MS);
    return sensor.addListener((measurement) => onSample(onMeasurement(measurement)));
  } catch {
    return null;
  }
}

async function subscribePedometer(
  monitor: RealPedometerMonitor,
  onSample: (sample: RawSensorSample) => void,
): Promise<SensorSubscription> {
  return monitor.start(onSample);
}

export type ExpoMovementSensorAdapter = MovementSensorAdapter & {
  readonly realPedometerMonitor: RealPedometerMonitor;
  retryPedometerSubscription(): Promise<void>;
};

export function createExpoMovementSensorAdapter(): ExpoMovementSensorAdapter {
  const realPedometerMonitor = new RealPedometerMonitor({
    pedometer: Pedometer,
    now: () => Date.now(),
  });

  return {
    realPedometerMonitor,
    async retryPedometerSubscription() {
      await realPedometerMonitor.retry();
    },
    async subscribe(onSample) {
    const subscriptions = [
      await subscribeDeviceSensor<AccelerometerMeasurement>(
        Accelerometer,
        ({ x, y, z }) => ({
          ...nextSampleIdentity('accelerometer'),
          kind: 'accelerometer',
          acceleration: { x, y, z },
          intervalMs: UPDATE_INTERVAL_MS,
        }),
        onSample,
      ),
      await subscribeDeviceSensor<GyroscopeMeasurement>(
        Gyroscope,
        ({ x, y, z }) => ({
          ...nextSampleIdentity('gyroscope'),
          kind: 'gyroscope',
          rotationRate: { x, y, z },
          intervalMs: UPDATE_INTERVAL_MS,
        }),
        onSample,
      ),
      await subscribeDeviceSensor<MagnetometerMeasurement>(
        Magnetometer,
        ({ x, y, z }) => ({
          ...nextSampleIdentity('magnetometer'),
          kind: 'magnetometer',
          magneticField: { x, y, z },
          intervalMs: UPDATE_INTERVAL_MS,
        }),
        onSample,
      ),
      await subscribeDeviceSensor<DeviceMotionMeasurement>(
        DeviceMotion,
        (measurement) => ({
          ...nextSampleIdentity('deviceMotion'),
          kind: 'deviceMotion',
          acceleration: measurement.acceleration,
          accelerationIncludingGravity: measurement.accelerationIncludingGravity,
          rotationRate: measurement.rotationRate
            ? {
                x: measurement.rotationRate.alpha,
                y: measurement.rotationRate.beta,
                z: measurement.rotationRate.gamma,
              }
            : null,
          attitude: measurement.rotation,
          intervalMs: measurement.interval,
        }),
        onSample,
      ),
      await subscribePedometer(realPedometerMonitor, onSample),
    ];

    return subscriptions.filter(
      (subscription): subscription is SensorSubscription => subscription !== null,
    );
    },
  };
}

export const expoMovementSensorAdapter = createExpoMovementSensorAdapter();
