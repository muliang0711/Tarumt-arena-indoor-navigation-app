import assert from 'node:assert/strict';
import test from 'node:test';

import { createViewConeGeometry } from './viewConeModel';

test('creates a symmetric 60-degree fan facing right', () => {
  assert.deepEqual(
    createViewConeGeometry({ fieldOfViewDegrees: 60, length: 100 }),
    {
      path: 'M 100 100 L 186.603 50 A 100 100 0 0 1 186.603 150 Z',
      size: 200,
    },
  );
});

test('clamps invalid field of view and length inputs', () => {
  assert.equal(
    createViewConeGeometry({ fieldOfViewDegrees: 0, length: 0 }).size,
    2,
  );
  assert.match(
    createViewConeGeometry({ fieldOfViewDegrees: 360, length: 20 }).path,
    /^M 20 20 /,
  );
});
