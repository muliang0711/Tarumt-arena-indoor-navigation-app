import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBobActorAtNode,
  deriveActorMotionState,
  type Actor,
} from './actorModel';

test('derives Bob run direction from horizontal and vertical movement deltas', () => {
  const actor: Actor = {
    id: 'bob',
    name: 'Bob',
    nodeId: 'node_1',
    position: { x: 0, y: 0 },
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
