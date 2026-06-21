import assert from 'node:assert/strict';
import test from 'node:test';

import {
  shortestHeadingDelta,
  stepHeadingToward,
} from './actorHeadingSmoothing';

test('shortestHeadingDelta crosses the zero-degree boundary by the short path', () => {
  const delta = shortestHeadingDelta(
    (359 * Math.PI) / 180,
    (1 * Math.PI) / 180,
  );

  assert.ok(Math.abs(delta - (2 * Math.PI) / 180) < 0.000001);
});

test('stepHeadingToward limits rotation without taking the long path', () => {
  const next = stepHeadingToward(
    (359 * Math.PI) / 180,
    (1 * Math.PI) / 180,
    Math.PI / 180,
  );

  assert.ok(Math.abs(next) < 0.000001);
});
