import { HeadingEstimate } from './headingEstimate';
import { StepEstimate } from './stepEstimate';

export interface DisplacementEstimate {
  readonly kind: 'displacement';
  readonly timestamp: number;
  readonly distanceMeters: number;
  readonly heading?: HeadingEstimate;
  readonly stepLengthMeters?: number;
  readonly confidence: number;
}

function normalizeFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clampConfidence(confidence: number): number {
  return Math.min(1, Math.max(0, normalizeFiniteNumber(confidence)));
}

function normalizeDistanceMeters(distanceMeters: number): number {
  return Math.max(0, normalizeFiniteNumber(distanceMeters));
}

function normalizeStepLengthMeters(stepLengthMeters: number): number {
  return Math.max(0, normalizeFiniteNumber(stepLengthMeters));
}

export function createDisplacementEstimate(
  timestamp: number,
  distanceMeters: number,
  confidence = 1,
  heading?: HeadingEstimate,
  stepLengthMeters?: number,
): DisplacementEstimate {
  return {
    kind: 'displacement',
    timestamp: normalizeFiniteNumber(timestamp),
    distanceMeters: normalizeDistanceMeters(distanceMeters),
    heading,
    stepLengthMeters: stepLengthMeters === undefined ? undefined : normalizeStepLengthMeters(stepLengthMeters),
    confidence: clampConfidence(confidence),
  };
}

export function createDisplacementEstimateFromStepEstimate(
  stepEstimate: StepEstimate,
  stepLengthMeters = 0.7,
  heading?: HeadingEstimate,
  confidence = stepEstimate.confidence,
): DisplacementEstimate {
  const normalizedStepLengthMeters = normalizeStepLengthMeters(stepLengthMeters);
  const distanceMeters = stepEstimate.stepDelta * normalizedStepLengthMeters;

  return createDisplacementEstimate(
    stepEstimate.timestamp,
    distanceMeters,
    confidence,
    heading,
    normalizedStepLengthMeters,
  );
}
