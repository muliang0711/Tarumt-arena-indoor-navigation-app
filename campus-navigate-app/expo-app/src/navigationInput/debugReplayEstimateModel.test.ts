import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createDebugReplayEstimate } from './debugReplayEstimateModel';

test('creates replay input as an already-derived estimate near route progress', () => {
  const estimate = createDebugReplayEstimate({
    nowMs: 1000,
    routePosition: {
      distanceAlongRoute: 0,
      headingDegrees: 0,
      screenX: 236,
      screenY: 648,
      segmentIndex: 0,
      tiledX: -20,
      tiledY: 904,
    },
    sequenceIndex: 2,
  });

  assert.deepEqual(estimate, {
    confidence: 0.76,
    headingDegrees: 0,
    source: 'debug-replay',
    timestampMs: 1000,
    x: 304,
    y: 666,
  });
});
