import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deriveActorVisualFacing,
  fanRotationDegrees,
} from './facingFanModel';

test('rotates the upward-facing sector to the continuous movement heading', () => {
  assert.equal(fanRotationDegrees(0), 90);
  assert.equal(fanRotationDegrees(Math.PI / 2), 180);
  assert.equal(fanRotationDegrees(Math.PI), 270);
  assert.equal(fanRotationDegrees(-Math.PI / 2), 0);
});

test('derives the sprite direction and fan rotation from the same heading', () => {
  assert.deepEqual(deriveActorVisualFacing(0, 'down'), {
    direction: 'right',
    fanRotationDegrees: 90,
  });
  assert.deepEqual(deriveActorVisualFacing(Math.PI / 2, 'right'), {
    direction: 'down',
    fanRotationDegrees: 180,
  });
  assert.deepEqual(deriveActorVisualFacing(Math.PI, 'down'), {
    direction: 'left',
    fanRotationDegrees: 270,
  });
  assert.deepEqual(deriveActorVisualFacing(-Math.PI / 2, 'left'), {
    direction: 'up',
    fanRotationDegrees: 0,
  });
});
