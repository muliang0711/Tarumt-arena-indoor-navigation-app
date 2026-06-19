export type SensorVector3 = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

export type SensorTimestamp = number;

export type SensorKind =
  | 'accelerometer'
  | 'gyroscope'
  | 'magnetometer'
  | 'pedometer'
  | 'deviceMotion';

export interface TimestampedSensorSample<TKind extends SensorKind = SensorKind> {
  readonly id?: string;
  readonly kind: TKind;
  readonly timestamp: SensorTimestamp;
}

export interface AccelerometerSample extends TimestampedSensorSample<'accelerometer'> {
  readonly acceleration: SensorVector3;
  readonly gravity?: SensorVector3;
  readonly intervalMs?: number;
}

export interface GyroscopeSample extends TimestampedSensorSample<'gyroscope'> {
  readonly rotationRate: SensorVector3;
  readonly intervalMs?: number;
}

export interface MagnetometerSample extends TimestampedSensorSample<'magnetometer'> {
  readonly magneticField: SensorVector3;
  readonly accuracy?: number;
  readonly intervalMs?: number;
}

export interface PedometerStepSample extends TimestampedSensorSample<'pedometer'> {
  readonly steps: number;
  readonly cadence?: number;
}

export interface DeviceMotionAttitude {
  readonly alpha: number;
  readonly beta: number;
  readonly gamma: number;
}

export interface DeviceMotionSample extends TimestampedSensorSample<'deviceMotion'> {
  readonly acceleration?: SensorVector3 | null;
  readonly accelerationIncludingGravity?: SensorVector3 | null;
  readonly rotationRate?: SensorVector3 | null;
  readonly attitude?: DeviceMotionAttitude | null;
  readonly intervalMs?: number;
}

export type RawSensorSample =
  | AccelerometerSample
  | GyroscopeSample
  | MagnetometerSample
  | PedometerStepSample
  | DeviceMotionSample;

export type SensorSampleBatch = readonly RawSensorSample[];
