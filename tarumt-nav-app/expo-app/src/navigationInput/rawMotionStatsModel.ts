import type { PdrPipelineResult } from '../pdr';
import type { RawMotionBatchStats } from './type';

export function createRawMotionBatchStats(): RawMotionBatchStats {
  return {
    lastAcceptedSampleCount: 0,
    lastDroppedSampleCount: 0,
    lastHeadingDegrees: null,
    lastLatencyMs: 0,
    rawSamplesInMemory: 0,
    totalBatches: 0,
    totalRawSamplesSeen: 0,
  };
}

export function updateRawMotionStatsAfterSensorEvent(input: {
  currentStats: RawMotionBatchStats;
  rawSamplesInMemory: number;
}): RawMotionBatchStats {
  return {
    ...input.currentStats,
    rawSamplesInMemory: input.rawSamplesInMemory,
    totalRawSamplesSeen: input.currentStats.totalRawSamplesSeen + 1,
  };
}

export function updateRawMotionStatsAfterHeading(input: {
  currentStats: RawMotionBatchStats;
  headingDegrees: number;
}): RawMotionBatchStats {
  return {
    ...input.currentStats,
    lastHeadingDegrees: input.headingDegrees,
  };
}

export function updateRawMotionStatsAfterFlush(input: {
  currentStats: RawMotionBatchStats;
  pdrResult: Pick<
    PdrPipelineResult,
    'acceptedSampleCount' | 'droppedSampleCount' | 'latencyMs'
  >;
  rawSamplesInMemory?: number;
}): RawMotionBatchStats {
  return {
    ...input.currentStats,
    lastAcceptedSampleCount: input.pdrResult.acceptedSampleCount,
    lastDroppedSampleCount: input.pdrResult.droppedSampleCount,
    lastLatencyMs: input.pdrResult.latencyMs,
    rawSamplesInMemory: input.rawSamplesInMemory ?? 0,
    totalBatches: input.currentStats.totalBatches + 1,
  };
}
