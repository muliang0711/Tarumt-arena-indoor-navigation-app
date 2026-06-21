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
  headingConfidence?: number;
  headingTimestamp?: number;
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

type MovementExecutionResult = {
  filter: ParticleFilterSnapshot;
  position: WorldPosition;
  confidence: number;
  latestAttempt?: MovementSystemState['latestMovementAttempt'];
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

function createSingleStepEstimate(step: StepEstimate, offset: number): StepEstimate {
  return {
    ...step,
    steps: Math.max(0, step.steps - step.stepDelta + offset + 1),
    stepDelta: 1,
  };
}

function projectPositionAlongHeading(
  position: WorldPosition,
  headingRadians: number,
  distanceMeters: number,
): WorldPosition {
  return {
    x: position.x + Math.cos(headingRadians) * distanceMeters,
    y: position.y + Math.sin(headingRadians) * distanceMeters,
  };
}

function executeMovementIncrement(
  step: StepEstimate,
  heading: ReturnType<typeof createHeadingEstimateFromRadians>,
  initialFilter: ParticleFilterSnapshot,
  initialPosition: WorldPosition,
  currentConfidence: number,
  constraintProvider: MovementConstraintProvider,
  randomSource: () => number,
): MovementExecutionResult {
  if (step.stepDelta <= 0) {
    return {
      filter: initialFilter,
      position: initialPosition,
      confidence: clamp01(currentConfidence),
    };
  }

  let activeFilter = initialFilter;
  let activePosition = initialPosition;
  let activeConfidence = currentConfidence;
  let latestAttempt: MovementSystemState['latestMovementAttempt'] | undefined;

  for (let index = 0; index < step.stepDelta; index += 1) {
    const motion = createMotionEstimate(createSingleStepEstimate(step, index), heading);
    const candidateFilter = updateParticleFilterState(activeFilter, motion, {
      particleCount: 60,
      weightFloor: 0,
      randomSource,
      customScore: (particle) =>
        isParticlePositionValid(constraintProvider, particle.previousPosition, particle.position) ? 1 : 0,
    });
    const candidatePosition = projectPositionAlongHeading(
      activePosition,
      motion.heading.radians,
      motion.displacement.distanceMeters,
    );
    const movementAnalysis = constraintProvider.analyzeMove(activePosition, candidatePosition);
    const canUseCandidate = movementAnalysis.canMove;

    latestAttempt = {
      currentPosition: { ...movementAnalysis.currentPosition },
      candidatePosition: { ...movementAnalysis.candidatePosition },
      finalAcceptedPosition: canUseCandidate
        ? { ...candidatePosition }
        : { ...activePosition },
      headingRadians: motion.heading.radians,
      distanceMeters: motion.displacement.distanceMeters,
      canMove: movementAnalysis.canMove,
      insideWalkableArea: movementAnalysis.insideWalkableArea,
      insideBlockedArea: movementAnalysis.insideBlockedArea,
      crossedWall: movementAnalysis.crossedWall,
      crossedBlockedArea: movementAnalysis.crossedBlockedArea,
      rejectionReasons: [...movementAnalysis.rejectionReasons],
    };

    if (!canUseCandidate) {
      activeConfidence = clamp01(activeConfidence * 0.5);
      break;
    }

    activeFilter = candidateFilter;
    activePosition = candidatePosition;
    activeConfidence = candidateFilter.confidence;
  }

  return {
    filter: activeFilter,
    position: activePosition,
    confidence: clamp01(activeConfidence),
    latestAttempt,
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
    headingConfidence: 0,
    headingTimestamp: 0,
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
  const movementExecution = executeMovementIncrement(
    step,
    heading,
    previousFilter,
    currentState.position,
    currentState.confidence ?? 0.8,
    constraintProvider,
    randomSource,
  );
  const nextFilter = movementExecution.filter;
  const position = movementExecution.position;
  const hasFreshHeading = heading.source !== 'unknown';
  const stateHeadingRadians = hasFreshHeading
    ? heading.radians
    : currentState.headingRadians;
  const stateHeadingConfidence = hasFreshHeading
    ? heading.confidence
    : currentState.headingConfidence ?? 0;
  const stateHeadingTimestamp = hasFreshHeading
    ? heading.timestamp
    : currentState.headingTimestamp ?? 0;
  const state: MovementSystemState = {
    position,
    headingRadians: stateHeadingRadians,
    headingConfidence: stateHeadingConfidence,
    headingTimestamp: stateHeadingTimestamp,
    confidence: movementExecution.confidence,
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
      movementExecution.latestAttempt !== undefined
        ? movementExecution.latestAttempt
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
