import type { MotionVector } from './MotionVector';

export type MotionInputSample = {
  acceleration: MotionVector;
  headingDegrees: number;
  timestampMs: number;
};
