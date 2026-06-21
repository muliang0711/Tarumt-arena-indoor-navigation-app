import assert from 'node:assert/strict';
import test from 'node:test';

import {
  distanceBetweenPositions,
  shouldContinueActorSmoothing,
  stepActorRenderPosition,
} from './actorRenderSmoothing';

test('distanceBetweenPositions returns the Euclidean distance in meters', () => {
  assert.ok(
    Math.abs(
      distanceBetweenPositions({ x: 4.8, y: 5.2 }, { x: 5.5, y: 5.2 }) - 0.7,
    ) < 0.000001,
  );
});

test('stepActorRenderPosition moves toward the target by the configured maximum distance', () => {
  const next = stepActorRenderPosition(
    { x: 4.8, y: 5.2 },
    { x: 5.5, y: 5.2 },
    0.2,
  );

  assert.deepEqual(next, { x: 5.0, y: 5.2 });
});

test('stepActorRenderPosition snaps to the target when the remaining gap fits inside one step', () => {
  const next = stepActorRenderPosition(
    { x: 5.45, y: 5.2 },
    { x: 5.5, y: 5.2 },
    0.2,
  );

  assert.deepEqual(next, { x: 5.5, y: 5.2 });
});

test('stepActorRenderPosition falls back to the target when the current or target position is invalid', () => {
  const next = stepActorRenderPosition(
    { x: Number.NaN, y: 5.2 },
    { x: 5.5, y: 5.2 },
    0.2,
  );

  assert.deepEqual(next, { x: 5.5, y: 5.2 });
});

test('shouldContinueActorSmoothing stops once the render position is effectively at the target', () => {
  assert.equal(
    shouldContinueActorSmoothing({ x: 5.495, y: 5.2 }, { x: 5.5, y: 5.2 }),
    false,
  );
  assert.equal(
    shouldContinueActorSmoothing({ x: 5.2, y: 5.2 }, { x: 5.5, y: 5.2 }),
    true,
  );
});
