import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createMockMotionBatch } from './model';

test('creates a short transient mock batch around the desired heading', () => {
  const batch = createMockMotionBatch({
    desiredHeadingDegrees: 90,
    nowMs: 1000,
  });

  assert.equal(batch.length, 4);
  assert.deepEqual(
    batch.map((sample) => sample.headingDegrees),
    [84, 94, 99, 87],
  );
  assert.deepEqual(
    batch.map((sample) => sample.timestampMs),
    [928, 946, 964, 982],
  );
  assert.equal(batch.filter((sample) => sample.acceleration.x >= 1.45).length, 3);
});
