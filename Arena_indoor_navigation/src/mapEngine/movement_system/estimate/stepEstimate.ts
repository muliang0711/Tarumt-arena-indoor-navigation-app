import { PedometerStepSample } from '../sensor/sensorTypes';

export type StepEstimateSource = 'pedometer' | 'motion' | 'unknown';

export interface StepEstimate {
  readonly kind: 'step';
  readonly timestamp: number;
  readonly steps: number;
  readonly stepDelta: number;
  readonly cadence?: number;
  readonly confidence: number;
  readonly source: StepEstimateSource;
}

function normalizeFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clampConfidence(confidence: number): number {
  return Math.min(1, Math.max(0, normalizeFiniteNumber(confidence)));
}

function normalizeStepCount(steps: number): number {
  return Math.max(0, Math.floor(normalizeFiniteNumber(steps)));
}

export function createStepEstimate(
  sample: PedometerStepSample,
  previousSteps = 0,
  confidence = 1,
  source: StepEstimateSource = 'pedometer',
): StepEstimate {
  const steps = normalizeStepCount(sample.steps);
  const previousStepCount = normalizeStepCount(previousSteps);

  return {
    kind: 'step',
    timestamp: normalizeFiniteNumber(sample.timestamp),
    steps,
    stepDelta: Math.max(0, steps - previousStepCount),
    cadence: sample.cadence,
    confidence: clampConfidence(confidence),
    source,
  };
}

export function createStepEstimateFromCount(
  timestamp: number,
  steps: number,
  previousSteps = 0,
  confidence = 1,
  cadence?: number,
  source: StepEstimateSource = 'unknown',
): StepEstimate {
  const normalizedSteps = normalizeStepCount(steps);
  const previousStepCount = normalizeStepCount(previousSteps);

  return {
    kind: 'step',
    timestamp: normalizeFiniteNumber(timestamp),
    steps: normalizedSteps,
    stepDelta: Math.max(0, normalizedSteps - previousStepCount),
    cadence,
    confidence: clampConfidence(confidence),
    source,
  };
}
