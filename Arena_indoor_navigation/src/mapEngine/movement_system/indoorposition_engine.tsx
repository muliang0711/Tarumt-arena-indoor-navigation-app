import { updateParticleFilterState, createParticleFilterState } from './algorithms/particleFilter';
import type { ParticleFilterSnapshot } from './algorithms/particleTypes';
import type {
  MovementConstraintMapInput,
  RawSensorSample,
  WorldPosition,
} from '../shared';
import {
  createMovementConstraintProvider,
  isParticlePositionValid,
  type MovementConstraintAnalysis,
  type MovementConstraintProvider,
} from './constraints';
import { createHeadingEstimateFromRadians } from './estimate/headingEstimate';
import { createMotionEstimate } from './estimate/motionEstimate';
import type { StepEstimate } from './estimate/stepEstimate';
import { createStepEstimateFromCount } from './estimate/stepEstimate';
import { normalizeSensorSample } from './preprocessing/normalizeSensorSample';
import type { DeviceMotionSample, PedometerStepSample } from './sensor/sensorTypes';

export { createMovementConstraintProvider };
export type { MovementConstraintMapInput, MovementConstraintProvider, RawSensorSample, WorldPosition };

export type MovementSystemState = {
  position: WorldPosition;
  headingRadians: number;
  confidence?: number;
  particleFilter?: ParticleFilterSnapshot;
  previousStepCount?: number;
  lastStepDelta?: number;
  latestStepDiagnostics?: {
    batchPedometerSampleCount: number;
    batchLatestPedometerSteps?: number;
    batchLatestPedometerTimestamp?: number;
    previousStepCountBefore?: number;
    previousStepCountAfter?: number;
    computedStepDelta: number;
    reason:
      | 'no-pedometer-in-batch'
      | 'baseline-established'
      | 'same-cumulative-count'
      | 'counter-rollback-rebaseline'
      | 'positive-increment';
  };
  latestMovementAttempt?: {
    currentPosition: WorldPosition;
    candidatePosition: WorldPosition;
    finalAcceptedPosition: WorldPosition;
    headingRadians: number;
    distanceMeters: number;
    canMove: boolean;
    insideWalkableArea: boolean;
    insideBlockedArea: boolean;
    crossedWall: boolean;
    crossedBlockedArea: boolean;
    rejectionReasons: readonly string[];
  };
};

export type MovementSystemResult = {
  position: WorldPosition;
  headingRadians: number;
  confidence: number;
  constraintProvider: MovementConstraintProvider;
  particleFilter: ParticleFilterSnapshot;
  state: MovementSystemState;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function createDeterministicRandomSource(seed: number): () => number {
  let state = (Math.floor(seed) >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function headingFromSamples(samples: readonly RawSensorSample[], fallbackHeadingRadians: number) {
  const matchingSamples = samples.filter((sample): sample is DeviceMotionSample => sample.kind === 'deviceMotion');
  const deviceMotion = matchingSamples[matchingSamples.length - 1];
  if (deviceMotion?.attitude) {
    return createHeadingEstimateFromRadians(deviceMotion.timestamp, deviceMotion.attitude.alpha, 0.8, 'deviceMotion');
  }

  return createHeadingEstimateFromRadians(samples[samples.length - 1]?.timestamp ?? 0, fallbackHeadingRadians, 0.5, 'unknown');
}

function latestPedometerSample(
  samples: readonly RawSensorSample[],
): PedometerStepSample | undefined {
  const matchingSamples = samples.filter((sample): sample is PedometerStepSample => sample.kind === 'pedometer');
  return matchingSamples[matchingSamples.length - 1];
}

function createBaselineStepEstimate(
  timestamp: number,
  steps: number,
  cadence?: number,
): StepEstimate {
  const baselineEstimate = createStepEstimateFromCount(
    timestamp,
    steps,
    steps,
    1,
    cadence,
    'pedometer',
  );

  return {
    ...baselineEstimate,
    stepDelta: 0,
  };
}

function resolveStepEstimate(
  samples: readonly RawSensorSample[],
  previousStepCount: number | undefined,
): {
  step: StepEstimate;
  nextPreviousStepCount: number | undefined;
  clearsLatestMovementAttempt: boolean;
  reason:
    | 'no-pedometer-in-batch'
    | 'baseline-established'
    | 'same-cumulative-count'
    | 'counter-rollback-rebaseline'
    | 'positive-increment';
} {
  const pedometer = latestPedometerSample(samples);
  const fallbackTimestamp = samples[samples.length - 1]?.timestamp ?? 0;

  if (!pedometer) {
    if (previousStepCount === undefined) {
      return {
        step: createStepEstimateFromCount(
          fallbackTimestamp,
          0,
          0,
          samples.length > 0 ? 1 : 0,
          undefined,
          'unknown',
        ),
        nextPreviousStepCount: undefined,
        clearsLatestMovementAttempt: false,
        reason: 'no-pedometer-in-batch',
      };
    }

    return {
      step: createStepEstimateFromCount(
        fallbackTimestamp,
        previousStepCount,
        previousStepCount,
        samples.length > 0 ? 1 : 0,
        undefined,
        'unknown',
      ),
      nextPreviousStepCount: previousStepCount,
      clearsLatestMovementAttempt: false,
      reason: 'no-pedometer-in-batch',
    };
  }

  if (previousStepCount === undefined) {
    return {
      step: createBaselineStepEstimate(pedometer.timestamp, pedometer.steps, pedometer.cadence),
      nextPreviousStepCount: pedometer.steps,
      clearsLatestMovementAttempt: true,
      reason: 'baseline-established',
    };
  }

  if (pedometer.steps < previousStepCount) {
    return {
      step: createBaselineStepEstimate(pedometer.timestamp, pedometer.steps, pedometer.cadence),
      nextPreviousStepCount: pedometer.steps,
      clearsLatestMovementAttempt: true,
      reason: 'counter-rollback-rebaseline',
    };
  }

  const step = createStepEstimateFromCount(
    pedometer.timestamp,
    pedometer.steps,
    previousStepCount,
    samples.length > 0 ? 1 : 0,
    pedometer.cadence,
    'pedometer',
  );

  return {
    step,
    nextPreviousStepCount: pedometer.steps,
    clearsLatestMovementAttempt: false,
    reason: step.stepDelta > 0 ? 'positive-increment' : 'same-cumulative-count',
  };
}

export function updateMovementSystem(
  sensorSamples: readonly RawSensorSample[],
  constraintMapInput: MovementConstraintMapInput,
  currentState: MovementSystemState = {
    position: { x: 0, y: 0 },
    headingRadians: 0,
  },
): MovementSystemResult {
  const normalizedSamples = sensorSamples.map(normalizeSensorSample);
  const constraintProvider = createMovementConstraintProvider(constraintMapInput);
  const pedometerSamples = normalizedSamples.filter(
    (sample): sample is PedometerStepSample => sample.kind === 'pedometer',
  );
  const latestBatchPedometer = pedometerSamples[pedometerSamples.length - 1];
  const previousStepCountBefore = currentState.previousStepCount;
  const resolvedStep = resolveStepEstimate(
    normalizedSamples,
    previousStepCountBefore,
  );
  const step = resolvedStep.step;
  const heading = headingFromSamples(normalizedSamples, currentState.headingRadians);
  const motion = createMotionEstimate(step, heading);
  const previousFilter =
    currentState.particleFilter ??
    createParticleFilterState(currentState.position, 60, {
      initialHeadingRadians: currentState.headingRadians,
      positionSpreadMeters: 0,
      headingSpreadRadians: 0,
      initialConfidence: currentState.confidence ?? 0.8,
    });
  const randomSource = createDeterministicRandomSource(
    step.timestamp + step.steps * 31 + previousFilter.generation * 997,
  );
  const nextFilter = updateParticleFilterState(previousFilter, motion, {
    particleCount: 60,
    weightFloor: 0,
    randomSource,
    customScore: (particle) =>
      isParticlePositionValid(constraintProvider, particle.previousPosition, particle.position) ? 1 : 0,
  });
  const candidatePosition =
    step.stepDelta === 0
      ? currentState.position
      : nextFilter.position ?? currentState.position;
  const movementAnalysis: MovementConstraintAnalysis | undefined =
    step.stepDelta > 0
      ? constraintProvider.analyzeMove(currentState.position, candidatePosition)
      : undefined;
  const canUseCandidate = movementAnalysis?.canMove ?? constraintProvider.canMove(currentState.position, candidatePosition);
  const position = canUseCandidate ? candidatePosition : currentState.position;
  const state: MovementSystemState = {
    position,
    headingRadians: nextFilter.headingRadians ?? heading.radians,
    confidence: clamp01(canUseCandidate ? nextFilter.confidence : (currentState.confidence ?? 0.5) * 0.5),
    particleFilter: nextFilter,
    previousStepCount: resolvedStep.nextPreviousStepCount,
    lastStepDelta: step.stepDelta,
    latestStepDiagnostics: {
      batchPedometerSampleCount: pedometerSamples.length,
      batchLatestPedometerSteps: latestBatchPedometer?.steps,
      batchLatestPedometerTimestamp: latestBatchPedometer?.timestamp,
      previousStepCountBefore,
      previousStepCountAfter: resolvedStep.nextPreviousStepCount,
      computedStepDelta: step.stepDelta,
      reason: resolvedStep.reason,
    },
    latestMovementAttempt:
      movementAnalysis !== undefined
        ? {
            currentPosition: { ...movementAnalysis.currentPosition },
            candidatePosition: { ...movementAnalysis.candidatePosition },
            finalAcceptedPosition: { ...position },
            headingRadians: motion.heading.radians,
            distanceMeters: motion.displacement.distanceMeters,
            canMove: movementAnalysis.canMove,
            insideWalkableArea: movementAnalysis.insideWalkableArea,
            insideBlockedArea: movementAnalysis.insideBlockedArea,
            crossedWall: movementAnalysis.crossedWall,
            crossedBlockedArea: movementAnalysis.crossedBlockedArea,
            rejectionReasons: [...movementAnalysis.rejectionReasons],
          }
        : resolvedStep.clearsLatestMovementAttempt
          ? undefined
          : currentState.latestMovementAttempt,
  };

  return {
    position: state.position,
    headingRadians: state.headingRadians,
    confidence: state.confidence ?? 0,
    constraintProvider,
    particleFilter: nextFilter,
    state,
  };
}
