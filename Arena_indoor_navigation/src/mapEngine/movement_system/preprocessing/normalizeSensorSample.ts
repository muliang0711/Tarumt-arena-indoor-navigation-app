import {
  AccelerometerSample,
  DeviceMotionAttitude,
  DeviceMotionSample,
  GyroscopeSample,
  MagnetometerSample,
  PedometerStepSample,
  RawSensorSample,
  SensorVector3,
} from '../sensor/sensorTypes';

function normalizeFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeOptionalFiniteNumber(value: number | undefined): number | undefined {
  return value === undefined ? undefined : normalizeFiniteNumber(value);
}

function normalizeOptionalPositiveInteger(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = Math.floor(normalizeFiniteNumber(value));
  return normalizedValue >= 0 ? normalizedValue : 0;
}

export function normalizeSensorTimestamp(timestamp: number): number {
  return normalizeFiniteNumber(timestamp);
}

export function normalizeSensorVector3(vector: SensorVector3 | null | undefined): SensorVector3 {
  return {
    x: normalizeFiniteNumber(vector?.x ?? 0),
    y: normalizeFiniteNumber(vector?.y ?? 0),
    z: normalizeFiniteNumber(vector?.z ?? 0),
  };
}

function normalizeOptionalSensorVector3(
  vector: SensorVector3 | null | undefined,
): SensorVector3 | undefined {
  if (vector === undefined || vector === null) {
    return undefined;
  }

  return normalizeSensorVector3(vector);
}

function normalizeDeviceMotionAttitude(
  attitude: DeviceMotionAttitude | null | undefined,
): DeviceMotionAttitude | null | undefined {
  if (attitude === undefined || attitude === null) {
    return attitude;
  }

  return {
    alpha: normalizeFiniteNumber(attitude.alpha),
    beta: normalizeFiniteNumber(attitude.beta),
    gamma: normalizeFiniteNumber(attitude.gamma),
  };
}

export function normalizeSensorSample(sample: RawSensorSample): RawSensorSample {
  switch (sample.kind) {
    case 'accelerometer':
      return normalizeAccelerometerSample(sample);
    case 'gyroscope':
      return normalizeGyroscopeSample(sample);
    case 'magnetometer':
      return normalizeMagnetometerSample(sample);
    case 'pedometer':
      return normalizePedometerStepSample(sample);
    case 'deviceMotion':
      return normalizeDeviceMotionSample(sample);
    default:
      return sample;
  }
}

export function normalizeAccelerometerSample(sample: AccelerometerSample): AccelerometerSample {
  return {
    ...sample,
    timestamp: normalizeSensorTimestamp(sample.timestamp),
    acceleration: normalizeSensorVector3(sample.acceleration),
    gravity: normalizeOptionalSensorVector3(sample.gravity),
    intervalMs: normalizeOptionalFiniteNumber(sample.intervalMs),
  };
}

export function normalizeGyroscopeSample(sample: GyroscopeSample): GyroscopeSample {
  return {
    ...sample,
    timestamp: normalizeSensorTimestamp(sample.timestamp),
    rotationRate: normalizeSensorVector3(sample.rotationRate),
    intervalMs: normalizeOptionalFiniteNumber(sample.intervalMs),
  };
}

export function normalizeMagnetometerSample(sample: MagnetometerSample): MagnetometerSample {
  return {
    ...sample,
    timestamp: normalizeSensorTimestamp(sample.timestamp),
    magneticField: normalizeSensorVector3(sample.magneticField),
    accuracy: normalizeOptionalFiniteNumber(sample.accuracy),
    intervalMs: normalizeOptionalFiniteNumber(sample.intervalMs),
  };
}

export function normalizePedometerStepSample(sample: PedometerStepSample): PedometerStepSample {
  return {
    ...sample,
    timestamp: normalizeSensorTimestamp(sample.timestamp),
    steps: normalizeOptionalPositiveInteger(sample.steps) ?? 0,
    cadence: normalizeOptionalFiniteNumber(sample.cadence),
  };
}

export function normalizeDeviceMotionSample(sample: DeviceMotionSample): DeviceMotionSample {
  return {
    ...sample,
    timestamp: normalizeSensorTimestamp(sample.timestamp),
    acceleration: normalizeOptionalSensorVector3(sample.acceleration),
    accelerationIncludingGravity: normalizeOptionalSensorVector3(sample.accelerationIncludingGravity),
    rotationRate: normalizeOptionalSensorVector3(sample.rotationRate),
    attitude: normalizeDeviceMotionAttitude(sample.attitude),
    intervalMs: normalizeOptionalFiniteNumber(sample.intervalMs),
  };
}
