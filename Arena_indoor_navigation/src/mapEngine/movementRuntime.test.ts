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
      analyzeMove: (from, to) => ({
        currentPosition: from,
        candidatePosition: to,
        canMove: true,
        insideWalkableArea: true,
        insideBlockedArea: false,
        crossedWall: false,
        crossedBlockedArea: false,
        rejectionReasons: [],
      }),
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

test('preserves the latest attempted movement diagnostics across later zero-step batches', () => {
  const rejectionConstraints: MovementConstraintMapInput = {
    ...constraints,
    walkableAreas: [[
      { x: 4.75, y: 5.15 },
      { x: 4.85, y: 5.15 },
      { x: 4.85, y: 5.25 },
      { x: 4.75, y: 5.25 },
    ]],
  };
  const runtime = new MovementRuntime({ x: 4.8, y: 5.2 });

  runtime.process(
    [
      sample('baseline-step-0', 50, 0),
      {
        id: 'baseline-motion-0',
        kind: 'deviceMotion',
        timestamp: 51,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    rejectionConstraints,
  );
  const attempted = runtime.process(
    [
      sample('step-1', 100, 1),
      {
        id: 'motion-1',
        kind: 'deviceMotion',
        timestamp: 101,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    rejectionConstraints,
  );
  const laterZeroStep = runtime.process(
    [
      {
        id: 'motion-2',
        kind: 'deviceMotion',
        timestamp: 200,
        attitude: { alpha: Math.PI / 2, beta: 0, gamma: 0 },
      },
    ],
    rejectionConstraints,
  );

  assert.ok(attempted);
  assert.ok(laterZeroStep);
  assert.equal(attempted.state.lastStepDelta, 1);
  assert.ok(attempted.state.latestMovementAttempt);
  assert.equal(attempted.state.latestMovementAttempt?.canMove, false);
  assert.deepEqual(
    laterZeroStep.state.latestMovementAttempt,
    attempted.state.latestMovementAttempt,
  );
  assert.equal(laterZeroStep.state.lastStepDelta, 0);
});

test('first cumulative pedometer reading establishes the baseline with zero movement', () => {
  const runtime = new MovementRuntime({ x: 4.8, y: 5.2 });

  const first = runtime.process(
    [
      sample('step-16', 100, 16),
      {
        id: 'motion-16',
        kind: 'deviceMotion',
        timestamp: 101,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    constraints,
  );

  assert.ok(first);
  assert.equal(first.state.previousStepCount, 16);
  assert.equal(first.state.lastStepDelta, 0);
  assert.deepEqual(first.position, { x: 4.8, y: 5.2 });
  assert.equal(first.state.latestMovementAttempt, undefined);
});

test('next cumulative pedometer increment after baseline produces one-step movement', () => {
  const runtime = new MovementRuntime({ x: 4.8, y: 5.2 });

  runtime.process(
    [
      sample('step-16', 100, 16),
      {
        id: 'motion-16',
        kind: 'deviceMotion',
        timestamp: 101,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    constraints,
  );
  const next = runtime.process(
    [
      sample('step-17', 200, 17),
      {
        id: 'motion-17',
        kind: 'deviceMotion',
        timestamp: 201,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    constraints,
  );

  assert.ok(next);
  assert.equal(next.state.previousStepCount, 17);
  assert.equal(next.state.lastStepDelta, 1);
});

test('reset baseline at 28 makes a repeated 28-step reading produce zero movement', () => {
  const runtime = new MovementRuntime({ x: 4.8, y: 5.2 });

  runtime.reset({ x: 4.8, y: 5.2 }, {
    samplesToIgnore: [sample('reset-step-28', 100, 28)],
    previousStepCount: 28,
  });

  const repeated = runtime.process(
    [
      sample('repeat-step-28', 200, 28),
      {
        id: 'motion-repeat-28',
        kind: 'deviceMotion',
        timestamp: 201,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    constraints,
  );

  assert.ok(repeated);
  assert.equal(repeated.state.previousStepCount, 28);
  assert.equal(repeated.state.lastStepDelta, 0);
  assert.deepEqual(repeated.position, { x: 4.8, y: 5.2 });
});

test('reset baseline at 28 makes the next 29-step reading produce one-step movement', () => {
  const runtime = new MovementRuntime({ x: 4.8, y: 5.2 });

  runtime.reset({ x: 4.8, y: 5.2 }, {
    samplesToIgnore: [sample('reset-step-28', 100, 28)],
    previousStepCount: 28,
  });

  const next = runtime.process(
    [
      sample('step-29', 200, 29),
      {
        id: 'motion-29',
        kind: 'deviceMotion',
        timestamp: 201,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    constraints,
  );

  assert.ok(next);
  assert.equal(next.state.previousStepCount, 29);
  assert.equal(next.state.lastStepDelta, 1);
});

test('pedometer counter rollback re-establishes the baseline without movement', () => {
  const runtime = new MovementRuntime({ x: 4.8, y: 5.2 });

  runtime.process(
    [
      sample('step-20', 100, 20),
      {
        id: 'motion-20',
        kind: 'deviceMotion',
        timestamp: 101,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    constraints,
  );
  const rollback = runtime.process(
    [
      sample('step-3', 200, 3),
      {
        id: 'motion-3',
        kind: 'deviceMotion',
        timestamp: 201,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    constraints,
  );

  assert.ok(rollback);
  assert.equal(rollback.state.previousStepCount, 3);
  assert.equal(rollback.state.lastStepDelta, 0);
  assert.deepEqual(rollback.position, { x: 4.8, y: 5.2 });
  assert.equal(rollback.state.latestMovementAttempt, undefined);
});

test('reset clears the previous rejected movement-attempt diagnostics', () => {
  const rejectionConstraints: MovementConstraintMapInput = {
    ...constraints,
    walkableAreas: [[
      { x: 4.75, y: 5.15 },
      { x: 4.85, y: 5.15 },
      { x: 4.85, y: 5.25 },
      { x: 4.75, y: 5.25 },
    ]],
  };
  const runtime = new MovementRuntime({ x: 4.8, y: 5.2 });

  runtime.process(
    [
      sample('baseline-step-0', 50, 0),
      {
        id: 'baseline-motion-0',
        kind: 'deviceMotion',
        timestamp: 51,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    rejectionConstraints,
  );
  const rejected = runtime.process(
    [
      sample('step-1', 100, 1),
      {
        id: 'motion-1',
        kind: 'deviceMotion',
        timestamp: 101,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    rejectionConstraints,
  );
  assert.ok(rejected);
  assert.ok(rejected.state.latestMovementAttempt);

  runtime.reset({ x: 4.8, y: 5.2 }, {
    samplesToIgnore: [sample('reset-step-28', 200, 28)],
    previousStepCount: 28,
  });

  assert.equal(runtime.getState().latestMovementAttempt, undefined);
});

test('records a baseline-established step diagnostic for the first cumulative pedometer reading', () => {
  const runtime = new MovementRuntime({ x: 4.8, y: 5.2 });

  const first = runtime.process(
    [
      sample('step-16', 100, 16),
      {
        id: 'motion-16',
        kind: 'deviceMotion',
        timestamp: 101,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    constraints,
  );

  assert.ok(first);
  assert.deepEqual(first.state.latestStepDiagnostics, {
    batchPedometerSampleCount: 1,
    batchLatestPedometerSteps: 16,
    batchLatestPedometerTimestamp: 100,
    previousStepCountBefore: undefined,
    previousStepCountAfter: 16,
    computedStepDelta: 0,
    reason: 'baseline-established',
  });
});

test('records a same-cumulative-count diagnostic when the latest pedometer value does not change', () => {
  const runtime = new MovementRuntime({ x: 4.8, y: 5.2 });

  runtime.process(
    [
      sample('step-16', 100, 16),
      {
        id: 'motion-16',
        kind: 'deviceMotion',
        timestamp: 101,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    constraints,
  );
  const repeated = runtime.process(
    [
      sample('step-16-repeat', 200, 16),
      {
        id: 'motion-16-repeat',
        kind: 'deviceMotion',
        timestamp: 201,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    constraints,
  );

  assert.ok(repeated);
  assert.deepEqual(repeated.state.latestStepDiagnostics, {
    batchPedometerSampleCount: 1,
    batchLatestPedometerSteps: 16,
    batchLatestPedometerTimestamp: 200,
    previousStepCountBefore: 16,
    previousStepCountAfter: 16,
    computedStepDelta: 0,
    reason: 'same-cumulative-count',
  });
});

test('records a no-pedometer-in-batch diagnostic when a processed batch contains only motion samples', () => {
  const runtime = new MovementRuntime({ x: 4.8, y: 5.2 });

  runtime.process(
    [
      sample('step-16', 100, 16),
      {
        id: 'motion-16',
        kind: 'deviceMotion',
        timestamp: 101,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    constraints,
  );
  const motionOnly = runtime.process(
    [
      {
        id: 'motion-only',
        kind: 'deviceMotion',
        timestamp: 300,
        attitude: { alpha: Math.PI / 2, beta: 0, gamma: 0 },
      },
    ],
    constraints,
  );

  assert.ok(motionOnly);
  assert.deepEqual(motionOnly.state.latestStepDiagnostics, {
    batchPedometerSampleCount: 0,
    batchLatestPedometerSteps: undefined,
    batchLatestPedometerTimestamp: undefined,
    previousStepCountBefore: 16,
    previousStepCountAfter: 16,
    computedStepDelta: 0,
    reason: 'no-pedometer-in-batch',
  });
});

test('records a positive-increment diagnostic when the batch advances cumulative steps', () => {
  const runtime = new MovementRuntime({ x: 4.8, y: 5.2 });

  runtime.process(
    [
      sample('step-16', 100, 16),
      {
        id: 'motion-16',
        kind: 'deviceMotion',
        timestamp: 101,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    constraints,
  );
  const increment = runtime.process(
    [
      sample('step-17-a', 200, 17),
      sample('step-17-b', 210, 17),
      {
        id: 'motion-17',
        kind: 'deviceMotion',
        timestamp: 211,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    constraints,
  );

  assert.ok(increment);
  assert.deepEqual(increment.state.latestStepDiagnostics, {
    batchPedometerSampleCount: 2,
    batchLatestPedometerSteps: 17,
    batchLatestPedometerTimestamp: 210,
    previousStepCountBefore: 16,
    previousStepCountAfter: 17,
    computedStepDelta: 1,
    reason: 'positive-increment',
  });
});

test('records a counter-rollback-rebaseline diagnostic when cumulative steps decrease', () => {
  const runtime = new MovementRuntime({ x: 4.8, y: 5.2 });

  runtime.process(
    [
      sample('step-20', 100, 20),
      {
        id: 'motion-20',
        kind: 'deviceMotion',
        timestamp: 101,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    constraints,
  );
  const rollback = runtime.process(
    [
      sample('step-3', 200, 3),
      {
        id: 'motion-3',
        kind: 'deviceMotion',
        timestamp: 201,
        attitude: { alpha: 0, beta: 0, gamma: 0 },
      },
    ],
    constraints,
  );

  assert.ok(rollback);
  assert.deepEqual(rollback.state.latestStepDiagnostics, {
    batchPedometerSampleCount: 1,
    batchLatestPedometerSteps: 3,
    batchLatestPedometerTimestamp: 200,
    previousStepCountBefore: 20,
    previousStepCountAfter: 3,
    computedStepDelta: 0,
    reason: 'counter-rollback-rebaseline',
  });
});
