export type DerivedNavigationEstimate = {
  confidence: number;
  headingDegrees: number;
  source: 'debug-replay' | 'external-derived' | 'manual-test' | 'pdr-summary';
  timestampMs: number;
  x: number;
  y: number;
};
