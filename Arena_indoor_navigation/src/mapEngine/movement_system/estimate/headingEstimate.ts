export type HeadingEstimateSource = 'deviceMotion' | 'magnetometer' | 'manual' | 'unknown';

export interface HeadingEstimateVector {
  readonly x: number;
  readonly y: number;
}

export interface HeadingEstimate {
  readonly kind: 'heading';
  readonly timestamp: number;
  readonly radians: number;
  readonly degrees: number;
  readonly unitVector: HeadingEstimateVector;
  readonly confidence: number;
  readonly source: HeadingEstimateSource;
}

function normalizeFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clampConfidence(confidence: number): number {
  return Math.min(1, Math.max(0, normalizeFiniteNumber(confidence)));
}

export function normalizeHeadingRadians(radians: number): number {
  const normalizedRadians = normalizeFiniteNumber(radians);
  const fullTurn = Math.PI * 2;
  const wrappedRadians = normalizedRadians % fullTurn;

  return wrappedRadians >= 0 ? wrappedRadians : wrappedRadians + fullTurn;
}

export function normalizeHeadingDegrees(degrees: number): number {
  const normalizedDegrees = normalizeFiniteNumber(degrees);
  const wrappedDegrees = normalizedDegrees % 360;

  return wrappedDegrees >= 0 ? wrappedDegrees : wrappedDegrees + 360;
}

function createHeadingUnitVector(radians: number): HeadingEstimateVector {
  return {
    x: Math.cos(radians),
    y: Math.sin(radians),
  };
}

export function createHeadingEstimateFromRadians(
  timestamp: number,
  radians: number,
  confidence = 1,
  source: HeadingEstimateSource = 'unknown',
): HeadingEstimate {
  const normalizedRadians = normalizeHeadingRadians(radians);

  return {
    kind: 'heading',
    timestamp: normalizeFiniteNumber(timestamp),
    radians: normalizedRadians,
    degrees: normalizeHeadingDegrees((normalizedRadians * 180) / Math.PI),
    unitVector: createHeadingUnitVector(normalizedRadians),
    confidence: clampConfidence(confidence),
    source,
  };
}

export function createHeadingEstimateFromDegrees(
  timestamp: number,
  degrees: number,
  confidence = 1,
  source: HeadingEstimateSource = 'unknown',
): HeadingEstimate {
  const normalizedDegrees = normalizeHeadingDegrees(degrees);
  const radians = (normalizedDegrees * Math.PI) / 180;

  return createHeadingEstimateFromRadians(timestamp, radians, confidence, source);
}
