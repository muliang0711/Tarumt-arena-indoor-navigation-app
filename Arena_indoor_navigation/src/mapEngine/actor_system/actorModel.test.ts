import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBobActorAtNode,
  deriveActorDirectionFromHeading,
  deriveActorMotionState,
  type Actor,
} from './actorModel';

test('derives Bob run direction from horizontal and vertical movement deltas', () => {
  const actor: Actor = {
    id: 'bob',
    name: 'Bob',
    nodeId: 'node_1',
    position: { x: 0, y: 0 },
    headingRadians: Math.PI / 2,
    direction: 'down',
    action: 'idle',
  };

  assert.deepEqual(
    deriveActorMotionState(actor, { x: 1, y: 0 }),
    { direction: 'right', action: 'run' },
  );
  assert.deepEqual(
    deriveActorMotionState(actor, { x: -1, y: 0 }),
    { direction: 'left', action: 'run' },
  );
  assert.deepEqual(
    deriveActorMotionState(actor, { x: 0, y: -1 }),
    { direction: 'up', action: 'run' },
  );
  assert.deepEqual(
    deriveActorMotionState(actor, { x: 0, y: 1 }),
    { direction: 'down', action: 'run' },
  );
});

test('keeps Bob idle and facing the last direction when movement is below epsilon', () => {
  const actor: Actor = {
    id: 'bob',
    name: 'Bob',
    nodeId: 'node_1',
    position: { x: 0, y: 0 },
    headingRadians: Math.PI,
    direction: 'left',
    action: 'run',
  };

  assert.deepEqual(
    deriveActorMotionState(actor, { x: 0.0001, y: 0.0001 }),
    { direction: 'left', action: 'idle' },
  );
});

test('buildBobActorAtNode starts Bob facing down and idle', () => {
  const actor = buildBobActorAtNode(
    {
      movement: {
        routeGraph: {
          nodes: [{ node_id: 'node_1', position: { x: 4.8, y: 5.2 } }],
          edges: [],
        },
      },
    },
    'node_1',
  );

  assert.equal(actor.direction, 'down');
  assert.equal(actor.action, 'idle');
});

test('maps heading radians to the nearest cardinal Bob sprite direction', () => {
  assert.equal(deriveActorDirectionFromHeading(0, 'down'), 'right');
  assert.equal(deriveActorDirectionFromHeading(Math.PI / 2, 'right'), 'down');
  assert.equal(deriveActorDirectionFromHeading(Math.PI, 'down'), 'left');
  assert.equal(deriveActorDirectionFromHeading((Math.PI * 3) / 2, 'left'), 'up');
});

test('keeps the fallback direction when heading is invalid', () => {
  assert.equal(deriveActorDirectionFromHeading(Number.NaN, 'left'), 'left');
});
