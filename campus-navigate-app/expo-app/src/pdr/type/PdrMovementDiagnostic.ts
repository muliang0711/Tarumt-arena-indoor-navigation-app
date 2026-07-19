import type { RouteMovementDirection } from '../model/movementGateModel';

export type PdrMovementDiagnostic = {
  blockedReason:
    | 'backward-confirming'
    | 'backward-weak-step'
    | 'heading'
    | 'shake-cooldown'
    | 'startup-lock'
    | 'turning-in-place'
    | null;
  direction: RouteMovementDirection;
  distancePixels: number;
  headingDegrees: number;
  movedStepCount: number;
  pixelsPerMeter: number;
  stepLengthMeters: number;
};
