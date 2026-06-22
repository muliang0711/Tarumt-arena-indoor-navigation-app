import assert from 'node:assert/strict';
import test from 'node:test';

import { fanRotationDegrees } from './facingFanModel';

test('rotates the upward-facing sector to the continuous movement heading', () => {
  assert.equal(fanRotationDegrees(0), 90);
  assert.equal(fanRotationDegrees(Math.PI / 2), 180);
  assert.equal(fanRotationDegrees(Math.PI), 270);
  assert.equal(fanRotationDegrees(-Math.PI / 2), 0);
});
