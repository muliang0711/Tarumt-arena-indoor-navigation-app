import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createRawMotionBatchStats,
  updateRawMotionStatsAfterFlush,
  updateRawMotionStatsAfterHeading,
  updateRawMotionStatsAfterSensorEvent,
} from './rawMotionStatsModel';

test('tracks transient raw samples and rolling in-memory count after PDR flush', () => {
  const afterFirstSensorEvent = updateRawMotionStatsAfterSensorEvent({
    currentStats: createRawMotionBatchStats(),
    rawSamplesInMemory: 1,
  });
  const afterSecondSensorEvent = updateRawMotionStatsAfterSensorEvent({
    currentStats: afterFirstSensorEvent,
    rawSamplesInMemory: 2,
  });
  const afterFlush = updateRawMotionStatsAfterFlush({
    currentStats: afterSecondSensorEvent,
    pdrResult: {
      acceptedSampleCount: 2,
      droppedSampleCount: 0,
      latencyMs: 25,
    },
    rawSamplesInMemory: 2,
  });

  assert.equal(afterFlush.totalRawSamplesSeen, 2);
  assert.equal(afterFlush.totalBatches, 1);
  assert.equal(afterFlush.lastAcceptedSampleCount, 2);
  assert.equal(afterFlush.rawSamplesInMemory, 2);
});

test('tracks latest heading separately from raw sample batching', () => {
  const stats = updateRawMotionStatsAfterHeading({
    currentStats: createRawMotionBatchStats(),
    headingDegrees: 135,
  });

  assert.equal(stats.lastHeadingDegrees, 135);
  assert.equal(stats.rawSamplesInMemory, 0);
  assert.equal(stats.totalRawSamplesSeen, 0);
});
