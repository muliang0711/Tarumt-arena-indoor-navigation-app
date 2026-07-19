import assert from 'node:assert/strict';
import test from 'node:test';

import {
  closestViewHeadingTarget,
  resolveUserFacingHeadingDegrees,
} from './viewHeadingModel';

test('uses observed heading and otherwise holds the last observed heading', () => {
  assert.equal(
    resolveUserFacingHeadingDegrees({
      lastObservedHeadingDegrees: 12,
      observedHeadingDegrees: 37,
    }),
    37,
  );
  assert.equal(
    resolveUserFacingHeadingDegrees({
      lastObservedHeadingDegrees: 37,
      observedHeadingDegrees: null,
    }),
    37,
  );
});

test('selects the shortest rotation across the zero-degree boundary', () => {
  assert.equal(closestViewHeadingTarget(350, 10), 370);
  assert.equal(closestViewHeadingTarget(10, 350), -10);
  assert.equal(closestViewHeadingTarget(30, 60), 60);
});
