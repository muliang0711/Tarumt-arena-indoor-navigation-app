import type { MotionInputSample, PdrPipelineConfig } from '../type';

export function createTransientMotionBatch(input: {
  config: PdrPipelineConfig;
  nowMs: number;
  samples: readonly MotionInputSample[];
}) {
  const batchStartMs = input.nowMs - input.config.batchWindowMs;
  const freshSamples = input.samples
    .filter(
      (sample) =>
        sample.timestampMs >= batchStartMs &&
        sample.timestampMs <= input.nowMs &&
        input.nowMs - sample.timestampMs <= input.config.maxBatchAgeMs,
    )
    .sort((a, b) => a.timestampMs - b.timestampMs);
  const acceptedSamples = freshSamples.slice(-input.config.maxSamplesPerBatch);

  return {
    acceptedSamples,
    droppedSampleCount: input.samples.length - acceptedSamples.length,
  };
}
