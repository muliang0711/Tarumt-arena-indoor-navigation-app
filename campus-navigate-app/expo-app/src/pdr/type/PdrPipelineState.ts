import type { PdrHeadingSnapshot } from './PdrHeadingSnapshot';

export type PdrPipelineState = {
  backwardConfirmationTimestampMs?: number;
  headingDegrees: number;
  lastStepTimestampMs?: number;
  rotationHeadingSnapshots?: PdrHeadingSnapshot[];
  rotationHeadingTravelDegrees?: number;
  shakeCooldownUntilMs?: number;
  shakeSpikeCount?: number;
  shakeWindowStartedAtMs?: number;
  startedAtMs?: number;
  timestampMs: number;
  turnInPlaceUntilMs?: number;
  x: number;
  y: number;
};
