import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MovementRuntime,
  type MovementConstraintMapInput,
  MovementSystemResult,
  MovementSystemState,
  type MovementUpdateFunction,
  type RawSensorSample,
} from './movement_system';
import { extractMapCoordinateSystem } from './shared';

const constraints: MovementConstraintMapInput = {
  coordinateSystem: extractMapCoordinateSystem({
    map: { tileSize: 16 },
    movement: { coordinateSystem: { unit: 'meter', pixelsPerMeter: 40, tilesPerMeter: 2.5 } },
  }),
  routeGraph: { nodes: [], edges: [] },
  walkableAreas: [],
  blockedAreas: [],
  walls: [],
  doors: [],
  corridors: [],
};

function sample(id: string, timestamp: number, steps: number): RawSensorSample {
  return {
    id,
    kind: 'pedometer',
    timestamp,
    steps,
  };
}

function resultFor(
  previousState: MovementSystemState,
  generation: number,
): MovementSystemResult {
  const particleFilter = {
    particles: [],
    generation,
    position: { x: generation, y: generation },
    headingRadians: 0,
    confidence: 0.9,
    bestParticle: null,
    totalWeight: 1,
  } satisfies MovementSystemResult['particleFilter'];
  const state: MovementSystemState = {
    position: { x: generation, y: generation },
    headingRadians: 0,
    confidence: 0.9,
    particleFilter,
    previousStepCount: (previousState.previousStepCount ?? 0) + 1,
  };

  return {
    position: state.position,
    headingRadians: state.headingRadians,
    confidence: state.confidence ?? 0,
    constraintProvider: {
      canMove: () => true,
      isWalkable: () => true,
      distanceToWall: () => Infinity,
    },
    particleFilter,
    state,
  };
}

test('carries the returned movement state and particle filter into the next batch', () => {
  const receivedStates: MovementSystemState[] = [];
  const update: MovementUpdateFunction = (_samples, _constraints, currentState) => {
    receivedStates.push(currentState);
    return resultFor(currentState, receivedStates.length);
  };
  const runtime = new MovementRuntime({ x: 10, y: 20 }, update);

  const first = runtime.process([sample('step-1', 100, 1)], constraints);
  const second = runtime.process([sample('step-2', 200, 2)], constraints);

  assert.ok(first);
  assert.ok(second);
  assert.equal(receivedStates.length, 2);
  assert.strictEqual(receivedStates[1], first.state);
  assert.strictEqual(receivedStates[1].particleFilter, first.particleFilter);
  assert.equal(second.particleFilter.generation, 2);
});

test('the real movement pipeline advances one persistent particle filter across batches', () => {
  const runtime = new MovementRuntime({ x: 0, y: 0 });
  const first = runtime.process(
    [
      sample('step-1', 100, 1),
      {
        id: 'motion-1',
        kind: 'deviceMotion',
        timestamp: 101,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    constraints,
  );
  const second = runtime.process(
    [
      sample('step-2', 200, 2),
      {
        id: 'motion-2',
        kind: 'deviceMotion',
        timestamp: 201,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    constraints,
  );

  assert.ok(first);
  assert.ok(second);
  assert.equal(first.particleFilter.generation, 1);
  assert.equal(second.particleFilter.generation, 2);
  assert.equal(second.state.previousStepCount, 2);
});

test('does not update for empty, duplicate, invalid, or older samples', () => {
  let updateCount = 0;
  const update: MovementUpdateFunction = (_samples, _constraints, currentState) => {
    updateCount += 1;
    return resultFor(currentState, updateCount);
  };
  const runtime = new MovementRuntime({ x: 0, y: 0 }, update);
  const newest = sample('step-2', 200, 2);

  assert.equal(runtime.process([], constraints), null);
  assert.ok(runtime.process([newest], constraints));
  assert.equal(runtime.process([newest], constraints), null);
  assert.equal(runtime.process([sample('step-1', 100, 1)], constraints), null);
  assert.equal(
    runtime.process([{ ...sample('invalid', 300, 3), timestamp: Number.NaN }], constraints),
    null,
  );
  assert.equal(updateCount, 1);
});

test('reset discards prior filter state and samples already present at the reset boundary', () => {
  const receivedStates: MovementSystemState[] = [];
  const update: MovementUpdateFunction = (_samples, _constraints, currentState) => {
    receivedStates.push(currentState);
    return resultFor(currentState, receivedStates.length);
  };
  const runtime = new MovementRuntime({ x: 1, y: 1 }, update);
  const oldBatch = [sample('old', 100, 1)];

  assert.ok(runtime.process(oldBatch, constraints));
  runtime.reset({ x: 50, y: 60 }, oldBatch);

  assert.deepEqual(runtime.getState().position, { x: 50, y: 60 });
  assert.equal(runtime.getState().particleFilter, undefined);
  assert.equal(runtime.process(oldBatch, constraints), null);
  assert.ok(runtime.process([sample('new', 200, 1)], constraints));
  assert.deepEqual(receivedStates[1].position, { x: 50, y: 60 });
  assert.equal(receivedStates[1].particleFilter, undefined);
});

test('reset uses the current pedometer count as the next movement baseline', () => {
  const receivedStates: MovementSystemState[] = [];
  const update: MovementUpdateFunction = (_samples, _constraints, currentState) => {
    receivedStates.push(currentState);
    return resultFor(currentState, receivedStates.length);
  };
  const runtime = new MovementRuntime({ x: 1, y: 1 }, update);

  runtime.reset({ x: 50, y: 60 }, [sample('reset-step', 100, 8)]);

  assert.equal(
    runtime.process([sample('next-step', 200, 9)], constraints)?.state.previousStepCount,
    9,
  );
  assert.equal(receivedStates[0].previousStepCount, 8);
  assert.deepEqual(receivedStates[0].position, { x: 50, y: 60 });
});

test('reset accepts an explicit pedometer baseline when the current batch has no pedometer sample', () => {
  const receivedStates: MovementSystemState[] = [];
  const update: MovementUpdateFunction = (_samples, _constraints, currentState) => {
    receivedStates.push(currentState);
    return resultFor(currentState, receivedStates.length);
  };
  const runtime = new MovementRuntime({ x: 1, y: 1 }, update);

  runtime.reset(
    { x: 50, y: 60 },
    {
      samplesToIgnore: [
        {
          id: 'motion-only',
          kind: 'deviceMotion',
          timestamp: 100,
          attitude: { alpha: 0, beta: 0, gamma: 0 },
        },
      ],
      previousStepCount: 8,
    },
  );

  assert.equal(
    runtime.process([sample('next-step', 200, 9)], constraints)?.state.previousStepCount,
    9,
  );
  assert.equal(receivedStates[0].previousStepCount, 8);
  assert.deepEqual(receivedStates[0].position, { x: 50, y: 60 });
});

test('repeated zero-step batches keep the actor at exactly the same position', () => {
  const runtime = new MovementRuntime({ x: 4.8, y: 5.2 });

  const first = runtime.process(
    [
      sample('step-0', 100, 0),
      {
        id: 'motion-0',
        kind: 'deviceMotion',
        timestamp: 101,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    constraints,
  );
  const second = runtime.process(
    [
      {
        id: 'motion-1',
        kind: 'deviceMotion',
        timestamp: 200,
        attitude: { alpha: Math.PI / 2, beta: 0, gamma: 0 },
      },
    ],
    constraints,
  );
  const third = runtime.process(
    [
      {
        id: 'motion-2',
        kind: 'deviceMotion',
        timestamp: 300,
        attitude: { alpha: Math.PI, beta: 0, gamma: 0 },
      },
    ],
    constraints,
  );

  assert.ok(first);
  assert.ok(second);
  assert.ok(third);
  assert.deepEqual(first.position, { x: 4.8, y: 5.2 });
  assert.deepEqual(second.position, { x: 4.8, y: 5.2 });
  assert.deepEqual(third.position, { x: 4.8, y: 5.2 });
});
