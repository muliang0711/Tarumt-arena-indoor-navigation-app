import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createDerivedEstimateBuffer,
  getLatestDerivedEstimate,
  ingestDerivedEstimate,
} from './derivedEstimateBufferModel';
import type { DerivedNavigationEstimate } from './type';

function estimate(
  timestampMs: number,
  x: number,
): DerivedNavigationEstimate {
  return {
    confidence: 0.8,
    headingDegrees: 0,
    source: 'external-derived',
    timestampMs,
    x,
    y: 648,
  };
}

test('ingests only low-rate derived estimates into a small UI buffer', () => {
  const initialBuffer = createDerivedEstimateBuffer({ maxSize: 2 });
  const first = ingestDerivedEstimate({
    buffer: initialBuffer,
    estimate: estimate(1000, 236),
  });
  const rateLimited = ingestDerivedEstimate({
    buffer: first.buffer,
    estimate: estimate(1050, 260),
  });
  const second = ingestDerivedEstimate({
    buffer: rateLimited.buffer,
    estimate: estimate(1100, 280),
  });
  const third = ingestDerivedEstimate({
    buffer: second.buffer,
    estimate: estimate(1200, 320),
  });

  assert.equal(first.accepted, true);
  assert.equal(rateLimited.accepted, false);
  assert.equal(rateLimited.reason, 'rate-limited');
  assert.equal(third.buffer.droppedEstimateCount, 1);
  assert.deepEqual(
    third.buffer.acceptedEstimates.map((acceptedEstimate) => acceptedEstimate.x),
    [280, 320],
  );
  assert.equal(getLatestDerivedEstimate(third.buffer)?.x, 320);
});
