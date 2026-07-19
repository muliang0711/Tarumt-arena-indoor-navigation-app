import assert from 'node:assert/strict';
import { test } from 'node:test';

import { magnetometerToHeadingDegrees } from './magnetometerHeadingModel';

test('converts magnetometer x/y into normalized heading degrees', () => {
  assert.equal(
    Math.round(
      magnetometerToHeadingDegrees({
        timestamp: 1,
        x: 1,
        y: 0,
        z: 0,
      }),
    ),
    0,
  );
  assert.equal(
    Math.round(
      magnetometerToHeadingDegrees({
        timestamp: 1,
        x: 0,
        y: 1,
        z: 0,
      }),
    ),
    90,
  );
  assert.equal(
    Math.round(
      magnetometerToHeadingDegrees({
        timestamp: 1,
        x: 0,
        y: -1,
        z: 0,
      }),
    ),
    270,
  );
});
