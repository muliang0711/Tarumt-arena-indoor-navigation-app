import type { RawSensorSample } from '../mapEngine/shared';
import type {
  MovementSensorAdapter,
  SensorSubscription,
} from './movementSensorCollector';
import { RealPedometerMonitor } from './realPedometerMonitor';

const UPDATE_INTERVAL_MS = 100;

type PermissionResponse = {
  granted: boolean;
};

type PermissionCapableSensor<TMeasurement> = {
  isAvailableAsync(): Promise<boolean>;
  getPermissionsAsync(): Promise<PermissionResponse>;
  requestPermissionsAsync(): Promise<PermissionResponse>;
  setUpdateInterval(intervalMs: number): void;
  addListener(listener: (measurement: TMeasurement) => void): SensorSubscription;
};

type PedometerDependency = {
  isAvailableAsync(): Promise<boolean>;
  getPermissionsAsync(): Promise<PermissionResponse>;
  requestPermissionsAsync(): Promise<PermissionResponse>;
  watchStepCount(listener: (result: { steps: number }) => void): SensorSubscription;
};

type VectorMeasurement = {
  x: number;
  y: number;
  z: number;
};

type DeviceMotionMeasurement = {
  acceleration?: VectorMeasurement | null;
  accelerationIncludingGravity?: VectorMeasurement | null;
  rotationRate?: {
    alpha: number;
    beta: number;
    gamma: number;
  } | null;
  rotation?: {
    alpha: number;
    beta: number;
    gamma: number;
  } | null;
  interval?: number;
};

export type RealDeviceSensorKind =
  | 'accelerometer'
  | 'gyroscope'
  | 'magnetometer'
  | 'deviceMotion';

export type RealDeviceSensorDiagnostic = {
  readonly status:
    | 'idle'
    | 'starting'
    | 'subscribed'
    | 'receiving'
    | 'permission-denied'
    | 'unavailable'
    | 'error'
    | 'stopped';
  readonly subscriptionAttemptAt: number | null;
  readonly subscriptionReadyAt: number | null;
  readonly firstSampleAt: number | null;
  readonly errorMessage: string | null;
};

export type ExpoMovementSensorDiagnosticState = {
  readonly sensors: Record<RealDeviceSensorKind, RealDeviceSensorDiagnostic>;
};

export type ExpoMovementSensorDependencies = {
  Accelerometer: PermissionCapableSensor<VectorMeasurement>;
  Gyroscope: PermissionCapableSensor<VectorMeasurement>;
  Magnetometer: PermissionCapableSensor<VectorMeasurement>;
  DeviceMotion: PermissionCapableSensor<DeviceMotionMeasurement>;
  Pedometer: PedometerDependency;
  now?: () => number;
};

export type ExpoMovementSensorAdapter = MovementSensorAdapter & {
  readonly realPedometerMonitor: RealPedometerMonitor;
  retryPedometerSubscription(): Promise<void>;
  getDiagnosticState(): ExpoMovementSensorDiagnosticState;
  subscribeDiagnosticState(
    listener: (state: ExpoMovementSensorDiagnosticState) => void,
  ): () => void;
};

function createSensorDiagnostic(): RealDeviceSensorDiagnostic {
  return {
    status: 'idle',
    subscriptionAttemptAt: null,
    subscriptionReadyAt: null,
    firstSampleAt: null,
    errorMessage: null,
  };
}

function createDiagnosticState(): ExpoMovementSensorDiagnosticState {
  return {
    sensors: {
      accelerometer: createSensorDiagnostic(),
      gyroscope: createSensorDiagnostic(),
      magnetometer: createSensorDiagnostic(),
      deviceMotion: createSensorDiagnostic(),
    },
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createExpoMovementSensorAdapterCore(
  dependencies: ExpoMovementSensorDependencies,
): ExpoMovementSensorAdapter {
  const now = dependencies.now ?? (() => Date.now());
  const diagnosticListeners = new Set<
    (state: ExpoMovementSensorDiagnosticState) => void
  >();
  let diagnosticState = createDiagnosticState();
  let sampleSequence = 0;
  let lastTimestamp = 0;

  const realPedometerMonitor = new RealPedometerMonitor({
    pedometer: dependencies.Pedometer,
    now,
  });

  function snapshotDiagnostics(): ExpoMovementSensorDiagnosticState {
    return {
      sensors: {
        accelerometer: { ...diagnosticState.sensors.accelerometer },
        gyroscope: { ...diagnosticState.sensors.gyroscope },
        magnetometer: { ...diagnosticState.sensors.magnetometer },
        deviceMotion: { ...diagnosticState.sensors.deviceMotion },
      },
    };
  }

  function updateDiagnostic(
    kind: RealDeviceSensorKind,
    next: Partial<RealDeviceSensorDiagnostic>,
  ): void {
    diagnosticState = {
      sensors: {
        ...diagnosticState.sensors,
        [kind]: {
          ...diagnosticState.sensors[kind],
          ...next,
        },
      },
    };
    const snapshot = snapshotDiagnostics();
    diagnosticListeners.forEach((listener) => listener(snapshot));
  }

  function nextSampleIdentity(
    kind: RawSensorSample['kind'],
  ): { id: string; timestamp: number } {
    sampleSequence += 1;
    const timestamp = Math.max(now(), lastTimestamp + 0.001);
    lastTimestamp = timestamp;
    return {
      id: `${kind}:${sampleSequence}`,
      timestamp,
    };
  }

  async function subscribeDeviceSensor<TMeasurement>(
    kind: RealDeviceSensorKind,
    sensor: PermissionCapableSensor<TMeasurement>,
    onMeasurement: (measurement: TMeasurement) => RawSensorSample,
    onSample: (sample: RawSensorSample) => void,
  ): Promise<SensorSubscription | null> {
    updateDiagnostic(kind, {
      status: 'starting',
      subscriptionAttemptAt: now(),
      subscriptionReadyAt: null,
      firstSampleAt: null,
      errorMessage: null,
    });

    try {
      if (!(await sensor.isAvailableAsync())) {
        updateDiagnostic(kind, { status: 'unavailable' });
        return null;
      }

      const existingPermission = await sensor.getPermissionsAsync();
      const permission = existingPermission.granted
        ? existingPermission
        : await sensor.requestPermissionsAsync();
      if (!permission.granted) {
        updateDiagnostic(kind, { status: 'permission-denied' });
        return null;
      }

      sensor.setUpdateInterval(UPDATE_INTERVAL_MS);
      const subscription = sensor.addListener((measurement) => {
        if (diagnosticState.sensors[kind].firstSampleAt === null) {
          updateDiagnostic(kind, {
            status: 'receiving',
            firstSampleAt: now(),
          });
        }
        onSample(onMeasurement(measurement));
      });
      updateDiagnostic(kind, {
        status: 'subscribed',
        subscriptionReadyAt: now(),
      });

      return {
        remove() {
          subscription.remove();
          updateDiagnostic(kind, { status: 'stopped' });
        },
      };
    } catch (error) {
      updateDiagnostic(kind, {
        status: 'error',
        errorMessage: errorMessage(error),
      });
      return null;
    }
  }

  return {
    realPedometerMonitor,
    async retryPedometerSubscription() {
      await realPedometerMonitor.retry();
    },
    getDiagnosticState() {
      return snapshotDiagnostics();
    },
    subscribeDiagnosticState(listener) {
      diagnosticListeners.add(listener);
      listener(snapshotDiagnostics());
      return () => {
        diagnosticListeners.delete(listener);
      };
    },
    async subscribe(onSample) {
      const subscriptions = await Promise.all([
        subscribeDeviceSensor(
          'accelerometer',
          dependencies.Accelerometer,
          ({ x, y, z }) => ({
            ...nextSampleIdentity('accelerometer'),
            kind: 'accelerometer',
            acceleration: { x, y, z },
            intervalMs: UPDATE_INTERVAL_MS,
          }),
          onSample,
        ),
        subscribeDeviceSensor(
          'gyroscope',
          dependencies.Gyroscope,
          ({ x, y, z }) => ({
            ...nextSampleIdentity('gyroscope'),
            kind: 'gyroscope',
            rotationRate: { x, y, z },
            intervalMs: UPDATE_INTERVAL_MS,
          }),
          onSample,
        ),
        subscribeDeviceSensor(
          'magnetometer',
          dependencies.Magnetometer,
          ({ x, y, z }) => ({
            ...nextSampleIdentity('magnetometer'),
            kind: 'magnetometer',
            magneticField: { x, y, z },
            intervalMs: UPDATE_INTERVAL_MS,
          }),
          onSample,
        ),
        subscribeDeviceSensor(
          'deviceMotion',
          dependencies.DeviceMotion,
          (measurement) => ({
            ...nextSampleIdentity('deviceMotion'),
            kind: 'deviceMotion',
            acceleration: measurement.acceleration,
            accelerationIncludingGravity:
              measurement.accelerationIncludingGravity,
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
        realPedometerMonitor.start(onSample),
      ]);

      return subscriptions.filter(
        (subscription): subscription is SensorSubscription =>
          subscription !== null,
      );
    },
  };
}
