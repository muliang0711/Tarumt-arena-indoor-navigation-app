export type RawMotionBatchStats = {
  lastAcceptedSampleCount: number;
  lastDroppedSampleCount: number;
  lastHeadingDegrees: number | null;
  lastLatencyMs: number;
  rawSamplesInMemory: number;
  totalBatches: number;
  totalRawSamplesSeen: number;
};
