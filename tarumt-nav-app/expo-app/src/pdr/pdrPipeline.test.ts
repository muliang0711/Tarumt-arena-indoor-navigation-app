import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createTransientMotionBatch,
  DEFAULT_PDR_PIPELINE_CONFIG,
  detectStepCount,
  getRouteMovementDirection,
  rankHeadingCandidates,
  runPdrPipeline,
  shouldMoveForHeading,
} from './model';
import type { MotionInputSample, PdrPipelineState } from './type';

const previousState: PdrPipelineState = {
  headingDegrees: 350,
  timestampMs: 900,
  x: 236,
  y: 648,
};

function sample(
  timestampMs: number,
  headingDegrees: number,
  magnitude: number,
): MotionInputSample {
  return {
    acceleration: { x: magnitude, y: 0, z: 0 },
    headingDegrees,
    timestampMs,
  };
}

test('creates a short transient batch and drops stale or excess samples', () => {
  const samples = [
    sample(700, 0, 1.4),
    sample(910, 2, 1.4),
    sample(940, 5, 1.4),
    sample(970, 8, 1.4),
    sample(995, 10, 1.4),
  ];

  const batch = createTransientMotionBatch({
    config: { ...DEFAULT_PDR_PIPELINE_CONFIG, maxSamplesPerBatch: 3 },
    nowMs: 1000,
    samples,
  });

  assert.deepEqual(
    batch.acceptedSamples.map((acceptedSample) => acceptedSample.timestampMs),
    [940, 970, 995],
  );
  assert.equal(batch.droppedSampleCount, 2);
});

test('ranks desired heading above noisy observed heading when desired is close', () => {
  const candidates = rankHeadingCandidates({
    desiredHeadingDegrees: 0,
    observedHeadingDegrees: 10,
    previousHeadingDegrees: 350,
  });

  assert.equal(candidates[0]?.label, 'desired');
  assert.equal(candidates[0]?.headingDegrees, 0);
});

test('runs PDR summary under the real-time batch latency target', () => {
  const result = runPdrPipeline({
    desiredHeadingDegrees: 0,
    nowMs: 1000,
    previousState,
    samples: [
      sample(920, 7, 0.2),
      sample(940, 8, 0.4),
      sample(960, 10, 1.9),
      sample(990, 12, 1.1),
    ],
  });

  assert.equal(result.acceptedSampleCount, 4);
  assert.equal(result.droppedSampleCount, 0);
  assert.equal(result.latencyMs, 10);
  assert.ok(result.latencyMs <= 100);
  assert.equal(result.estimate.source, 'pdr-summary');
  assert.equal(Math.round(result.estimate.headingDegrees), 9);
  assert.equal(result.estimate.x, 264);
  assert.equal(result.estimate.y, 648);
  assert.equal(result.diagnostics.step.rejectReason, 'ACCEPTED');
  assert.equal(result.diagnostics.step.stepCount, 1);
  assert.equal(result.diagnostics.movement.direction, 'forward');
  assert.equal(result.diagnostics.movement.movedStepCount, 1);
  assert.equal(Math.round(result.nextState.headingDegrees), 9);
  assert.equal(result.nextState.lastStepTimestampMs, 960);
});

test('reports observed facing heading while route-ranked heading controls movement', () => {
  const result = runPdrPipeline({
    desiredHeadingDegrees: 0,
    nowMs: 1000,
    previousState: {
      ...previousState,
      headingDegrees: 60,
    },
    samples: [
      sample(920, 58, 0.2),
      sample(940, 60, 0.4),
      sample(960, 62, 1.9),
      sample(990, 60, 1.1),
    ],
  });

  assert.equal(Math.round(result.estimate.headingDegrees), 60);
  assert.equal(Math.round(result.nextState.headingDegrees), 60);
  assert.equal(result.headingCandidates[0]?.label, 'desired');
  assert.equal(result.estimate.x, 264);
  assert.equal(result.estimate.y, 648);
});

test('moves backward when observed heading faces opposite the route direction', () => {
  const result = runPdrPipeline({
    desiredHeadingDegrees: 0,
    nowMs: 1000,
    previousState: {
      ...previousState,
      backwardConfirmationTimestampMs: 500,
    },
    samples: [
      sample(920, 178, 0.2),
      sample(940, 180, 0.4),
      sample(960, 182, 1.9),
      sample(990, 180, 1.1),
    ],
  });

  assert.equal(Math.round(result.estimate.headingDegrees), 180);
  assert.equal(result.diagnostics.movement.direction, 'backward');
  assert.equal(result.diagnostics.movement.movedStepCount, 1);
  assert.equal(result.estimate.x, 208);
  assert.equal(result.estimate.y, previousState.y);
  assert.equal(result.nextState.lastStepTimestampMs, 960);
});

test('locks movement during startup warm-up while still de-duping the step peak', () => {
  const result = runPdrPipeline({
    desiredHeadingDegrees: 0,
    nowMs: 2000,
    previousState: {
      ...previousState,
      startedAtMs: 500,
    },
    samples: [
      sample(1920, 0, 0.2),
      sample(1940, 0, 0.4),
      sample(1960, 0, 2),
      sample(1990, 0, 1),
    ],
  });

  assert.equal(result.diagnostics.step.rejectReason, 'ACCEPTED');
  assert.equal(result.diagnostics.movement.blockedReason, 'startup-lock');
  assert.equal(result.diagnostics.movement.movedStepCount, 0);
  assert.equal(result.estimate.x, previousState.x);
  assert.equal(result.estimate.y, previousState.y);
  assert.equal(result.nextState.lastStepTimestampMs, 1960);
});

test('blocks weak backward steps to avoid reverse drift while adjusting the phone', () => {
  const result = runPdrPipeline({
    desiredHeadingDegrees: 0,
    nowMs: 4000,
    previousState: {
      ...previousState,
      startedAtMs: 0,
    },
    samples: [
      sample(3920, 180, 0.2),
      sample(3940, 180, 0.4),
      sample(3960, 180, 1.75),
      sample(3990, 180, 0.8),
    ],
  });

  assert.equal(result.diagnostics.step.rejectReason, 'ACCEPTED');
  assert.equal(result.diagnostics.movement.direction, 'backward');
  assert.equal(result.diagnostics.movement.blockedReason, 'backward-weak-step');
  assert.equal(result.diagnostics.movement.movedStepCount, 0);
  assert.equal(result.estimate.x, previousState.x);
  assert.equal(result.nextState.lastStepTimestampMs, 3960);
});

test('requires two strong backward steps before moving backward', () => {
  const first = runPdrPipeline({
    desiredHeadingDegrees: 0,
    nowMs: 4000,
    previousState: {
      ...previousState,
      startedAtMs: 0,
    },
    samples: [
      sample(3920, 180, 0.2),
      sample(3940, 180, 0.4),
      sample(3960, 180, 2.1),
      sample(3990, 180, 0.8),
    ],
  });
  const second = runPdrPipeline({
    desiredHeadingDegrees: 0,
    nowMs: 4600,
    previousState: first.nextState,
    samples: [
      sample(4520, 180, 0.2),
      sample(4540, 180, 0.4),
      sample(4560, 180, 2.1),
      sample(4590, 180, 0.8),
    ],
  });

  assert.equal(first.diagnostics.movement.blockedReason, 'backward-confirming');
  assert.equal(first.diagnostics.movement.movedStepCount, 0);
  assert.equal(second.diagnostics.movement.blockedReason, null);
  assert.equal(second.diagnostics.movement.movedStepCount, 1);
  assert.equal(second.estimate.x, 208);
});

test('blocks movement during shake cooldown after repeated shake spikes', () => {
  const firstShake = runPdrPipeline({
    desiredHeadingDegrees: 0,
    nowMs: 1000,
    previousState: {
      ...previousState,
      startedAtMs: 0,
    },
    samples: [
      sample(920, 0, 0.3),
      sample(960, 0, 6.2),
      sample(990, 0, 0.5),
    ],
  });
  const secondShake = runPdrPipeline({
    desiredHeadingDegrees: 0,
    nowMs: 1400,
    previousState: firstShake.nextState,
    samples: [
      sample(1320, 0, 0.3),
      sample(1360, 0, 6.1),
      sample(1390, 0, 0.5),
    ],
  });
  const blockedStep = runPdrPipeline({
    desiredHeadingDegrees: 0,
    nowMs: 1800,
    previousState: secondShake.nextState,
    samples: [
      sample(1720, 0, 0.2),
      sample(1740, 0, 0.4),
      sample(1760, 0, 2.1),
      sample(1790, 0, 0.9),
    ],
  });
  const afterCooldown = runPdrPipeline({
    desiredHeadingDegrees: 0,
    nowMs: 2800,
    previousState: blockedStep.nextState,
    samples: [
      sample(2720, 0, 0.2),
      sample(2740, 0, 0.4),
      sample(2760, 0, 2.1),
      sample(2790, 0, 0.9),
    ],
  });

  assert.equal(firstShake.diagnostics.step.rejectReason, 'SHAKE_TOO_HIGH');
  assert.equal(secondShake.diagnostics.step.rejectReason, 'SHAKE_TOO_HIGH');
  assert.equal(secondShake.nextState.shakeCooldownUntilMs, 2560);
  assert.equal(blockedStep.diagnostics.step.rejectReason, 'ACCEPTED');
  assert.equal(blockedStep.diagnostics.movement.blockedReason, 'shake-cooldown');
  assert.equal(blockedStep.diagnostics.movement.movedStepCount, 0);
  assert.equal(blockedStep.estimate.x, previousState.x);
  assert.equal(afterCooldown.diagnostics.movement.blockedReason, null);
  assert.equal(afterCooldown.diagnostics.movement.movedStepCount, 1);
});

test('blocks movement briefly when the phone turns in place', () => {
  const result = runPdrPipeline({
    desiredHeadingDegrees: 90,
    nowMs: 4000,
    previousState: {
      ...previousState,
      headingDegrees: 0,
      startedAtMs: 0,
    },
    samples: [
      sample(3920, 90, 0.2),
      sample(3940, 90, 0.4),
      sample(3960, 90, 2.1),
      sample(3990, 90, 0.8),
    ],
  });

  assert.equal(result.diagnostics.step.rejectReason, 'ACCEPTED');
  assert.equal(result.diagnostics.movement.blockedReason, 'turning-in-place');
  assert.equal(result.diagnostics.movement.movedStepCount, 0);
  assert.equal(Math.round(result.estimate.headingDegrees), 90);
  assert.equal(result.estimate.x, previousState.x);
  assert.equal(result.estimate.y, previousState.y);
  assert.equal(result.nextState.turnInPlaceUntilMs, 4700);
});

test('rejects accepted-looking steps caused by phone rotation while standing', () => {
  const result = runPdrPipeline({
    desiredHeadingDegrees: 210,
    nowMs: 4000,
    previousState: {
      ...previousState,
      headingDegrees: 204,
      rotationHeadingSnapshots: [
        { headingDegrees: 190, timestampMs: 3400 },
        { headingDegrees: 204, timestampMs: 3700 },
      ],
      rotationHeadingTravelDegrees: 14,
      startedAtMs: 0,
    },
    samples: [
      sample(3920, 214, 0.5),
      sample(3960, 214, 2.1),
      sample(3990, 214, 1.1),
    ],
  });

  assert.equal(result.diagnostics.step.rejectReason, 'PHONE_ROTATION');
  assert.equal(result.diagnostics.step.stepCount, 0);
  assert.equal(result.diagnostics.step.rotationHeadingTravelDegrees, 24);
  assert.equal(result.diagnostics.movement.movedStepCount, 0);
  assert.equal(result.estimate.x, previousState.x);
  assert.equal(result.nextState.lastStepTimestampMs, undefined);
});

test('keeps real walking turns when average acceleration is walking-like', () => {
  const result = runPdrPipeline({
    desiredHeadingDegrees: 210,
    nowMs: 4000,
    previousState: {
      ...previousState,
      headingDegrees: 204,
      rotationHeadingSnapshots: [
        { headingDegrees: 190, timestampMs: 3400 },
        { headingDegrees: 204, timestampMs: 3700 },
      ],
      rotationHeadingTravelDegrees: 14,
      startedAtMs: 0,
    },
    samples: [
      sample(3920, 214, 0.6),
      sample(3960, 214, 3.4),
      sample(3990, 214, 2),
    ],
  });

  assert.equal(result.diagnostics.step.rejectReason, 'ACCEPTED');
  assert.equal(result.diagnostics.step.rotationHeadingTravelDegrees, 24);
  assert.equal(result.diagnostics.movement.blockedReason, null);
  assert.equal(result.diagnostics.movement.movedStepCount, 1);
});

test('allows forward or backward movement only inside route heading cones', () => {
  assert.equal(
    shouldMoveForHeading({
      config: DEFAULT_PDR_PIPELINE_CONFIG,
      desiredHeadingDegrees: 0,
      observedHeadingDegrees: 45,
    }),
    true,
  );
  assert.equal(
    shouldMoveForHeading({
      config: DEFAULT_PDR_PIPELINE_CONFIG,
      desiredHeadingDegrees: 0,
      observedHeadingDegrees: 180,
    }),
    true,
  );
  assert.equal(
    shouldMoveForHeading({
      config: DEFAULT_PDR_PIPELINE_CONFIG,
      desiredHeadingDegrees: 0,
      observedHeadingDegrees: 90,
    }),
    false,
  );
  assert.equal(
    getRouteMovementDirection({
      config: DEFAULT_PDR_PIPELINE_CONFIG,
      desiredHeadingDegrees: 0,
      observedHeadingDegrees: 180,
    }),
    'backward',
  );
});

test('does not move when no fresh batch samples are accepted', () => {
  const result = runPdrPipeline({
    desiredHeadingDegrees: 0,
    nowMs: 1000,
    previousState,
    samples: [sample(100, 45, 2)],
  });

  assert.equal(result.acceptedSampleCount, 0);
  assert.equal(result.diagnostics.step.rejectReason, 'NO_SAMPLES');
  assert.equal(result.estimate.x, previousState.x);
  assert.equal(result.estimate.y, previousState.y);
});

test('rejects shake-only acceleration without a quiet-to-peak step pattern', () => {
  const result = runPdrPipeline({
    desiredHeadingDegrees: 0,
    nowMs: 1000,
    previousState,
    samples: [
      sample(920, 5, 2.4),
      sample(940, 6, 2.2),
      sample(960, 7, 2.6),
      sample(990, 8, 2.3),
    ],
  });

  assert.equal(result.acceptedSampleCount, 4);
  assert.equal(result.diagnostics.step.rejectReason, 'NO_QUIET_SAMPLE');
  assert.equal(result.estimate.x, previousState.x);
  assert.equal(result.estimate.y, previousState.y);
  assert.equal(result.nextState.lastStepTimestampMs, undefined);
});

test('rejects extreme acceleration spikes as shake instead of walking', () => {
  const result = runPdrPipeline({
    desiredHeadingDegrees: 0,
    nowMs: 1000,
    previousState,
    samples: [
      sample(920, 5, 0.2),
      sample(960, 7, 6),
      sample(990, 8, 0.3),
    ],
  });

  assert.equal(result.diagnostics.step.rejectReason, 'SHAKE_TOO_HIGH');
  assert.equal(result.estimate.x, previousState.x);
  assert.equal(result.estimate.y, previousState.y);
});

test('rejects another step inside the minimum step interval', () => {
  const result = runPdrPipeline({
    desiredHeadingDegrees: 0,
    nowMs: 1000,
    previousState: {
      ...previousState,
      lastStepTimestampMs: 800,
    },
    samples: [
      sample(920, 5, 0.2),
      sample(960, 7, 1.9),
      sample(990, 8, 0.3),
    ],
  });

  assert.equal(result.diagnostics.step.rejectReason, 'TOO_SOON_AFTER_LAST_STEP');
  assert.equal(result.estimate.x, previousState.x);
  assert.equal(result.estimate.y, previousState.y);
});

test('detects at most one step peak per short batch', () => {
  assert.equal(
    detectStepCount({
      config: DEFAULT_PDR_PIPELINE_CONFIG,
      previousState,
      samples: [
        sample(920, 5, 0.2),
        sample(960, 7, 1.9),
        sample(990, 8, 2.1),
      ],
    }),
    1,
  );
});
