import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyLiveHeadingToMotionSample } from './motionSampleHeadingModel';

const sample = {
  acceleration: {
    x: 1,
    y: 0,
    z: 0,
  },
  headingDegrees: 0,
  timestampMs: 1000,
};

test('overrides raw motion sample heading with the live red-arrow heading', () => {
  assert.deepEqual(
    applyLiveHeadingToMotionSample({
      liveHeadingDegrees: 180,
      sample,
    }),
    {
      ...sample,
      headingDegrees: 180,
    },
  );
});

test('keeps raw motion sample heading when no live heading exists yet', () => {
  assert.deepEqual(
    applyLiveHeadingToMotionSample({
      liveHeadingDegrees: null,
      sample,
    }),
    sample,
  );
});
