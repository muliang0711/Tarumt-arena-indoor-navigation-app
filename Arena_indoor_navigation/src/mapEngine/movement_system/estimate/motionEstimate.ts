import { HeadingEstimate } from './headingEstimate';
import { DisplacementEstimate, createDisplacementEstimateFromStepEstimate } from './displacementEstimate';
import { StepEstimate } from './stepEstimate';

export interface MotionEstimate {
  readonly kind: 'motion';
  readonly timestamp: number;
  readonly step: StepEstimate;
  readonly heading: HeadingEstimate;
  readonly displacement: DisplacementEstimate;
  readonly confidence: number;
}

function normalizeFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clampConfidence(confidence: number): number {
  return Math.min(1, Math.max(0, normalizeFiniteNumber(confidence)));
}

function combineConfidence(stepConfidence: number, headingConfidence: number, displacementConfidence: number): number {
  return clampConfidence((stepConfidence + headingConfidence + displacementConfidence) / 3);
}

export function createMotionEstimate(
  step: StepEstimate,
  heading: HeadingEstimate,
  stepLengthMeters = 0.7,
  confidence = combineConfidence(step.confidence, heading.confidence, step.confidence),
): MotionEstimate {
  const resolvedConfidence = clampConfidence(confidence);
  const displacement = createDisplacementEstimateFromStepEstimate(
    step,
    stepLengthMeters,
    heading,
    resolvedConfidence,
  );

  return {
    kind: 'motion',
    timestamp: Math.max(step.timestamp, heading.timestamp, displacement.timestamp),
    step,
    heading,
    displacement,
    confidence: combineConfidence(step.confidence, heading.confidence, resolvedConfidence),
  };
}
