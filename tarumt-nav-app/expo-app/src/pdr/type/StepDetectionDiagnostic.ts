import type { StepRejectReason } from './StepRejectReason';

export type StepDetectionDiagnostic = {
  averageAcceleration: number;
  minAcceleration: number;
  peakAcceleration: number;
  peakTimestampMs: number | null;
  rejectReason: StepRejectReason;
  rotationHeadingTravelDegrees: number;
  stepCount: number;
  timeSinceLastStepMs: number | null;
};
