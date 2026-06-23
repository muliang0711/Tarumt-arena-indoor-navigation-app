import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendActorMovementTargets,
  consumeActorMovementTarget,
  createActorMovementQueue,
} from './actorMovementQueue';

test('queues accepted positions in order using cadence-derived duration', () => {
  const queue = appendActorMovementTargets(
    createActorMovementQueue(),
    [{ x: 1, y: 0 }, { x: 2, y: 0 }],
    { cadenceStepsPerMinute: 120, eventIntervalMs: 1000 },
  );

  assert.deepEqual(
    queue.targets.map((target) => target.position.x),
    [1, 2],
  );
  assert.deepEqual(
    queue.targets.map((target) => target.durationMs),
    [500, 500],
  );
});

test('caps stale backlog to the newest bounded targets', () => {
  const positions = Array.from({ length: 20 }, (_, index) => ({
    x: index + 1,
    y: 0,
  }));
  const queue = appendActorMovementTargets(
    createActorMovementQueue(),
    positions,
    { cadenceStepsPerMinute: null, eventIntervalMs: null },
  );

  assert.ok(queue.targets.length <= 8);
  assert.deepEqual(queue.targets.at(-1)?.position, { x: 20, y: 0 });
});

test('consumes the next target and reset starts empty', () => {
  const queue = appendActorMovementTargets(
    createActorMovementQueue(),
    [{ x: 1, y: 0 }],
    { cadenceStepsPerMinute: null, eventIntervalMs: null },
  );
  const consumed = consumeActorMovementTarget(queue);

  assert.deepEqual(consumed.target?.position, { x: 1, y: 0 });
  assert.deepEqual(consumed.queue.targets, []);
  assert.deepEqual(createActorMovementQueue().targets, []);
});
