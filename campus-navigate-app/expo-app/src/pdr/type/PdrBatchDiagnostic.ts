export type PdrBatchDiagnostic = {
  acceptedSampleCount: number;
  batchWindowMs: number;
  droppedSampleCount: number;
  maxBatchAgeMs: number;
  maxSamplesPerBatch: number;
  rawSampleCount: number;
  sampleEndTimestampMs: number | null;
  sampleStartTimestampMs: number | null;
};
