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

import type { RawSensorSample } from '../mapEngine/map-controller';
import type { MovementSensorAdapter, SensorSubscription } from './movementSensorCollector';

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
  onSample: (sample: RawSensorSample) => void,
): Promise<SensorSubscription | null> {
  try {
    if (!(await Pedometer.isAvailableAsync())) {
      return null;
    }

    const existingPermission = await Pedometer.getPermissionsAsync();
    const permission = existingPermission.granted
      ? existingPermission
      : await Pedometer.requestPermissionsAsync();
    if (!permission.granted) {
      return null;
    }

    return Pedometer.watchStepCount(({ steps }) => {
      onSample({
        ...nextSampleIdentity('pedometer'),
        kind: 'pedometer',
        steps,
      });
    });
  } catch {
    return null;
  }
}

export const expoMovementSensorAdapter: MovementSensorAdapter = {
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
      await subscribePedometer(onSample),
    ];

    return subscriptions.filter(
      (subscription): subscription is SensorSubscription => subscription !== null,
    );
  },
};
