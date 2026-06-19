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
  type MovementConstraintProvider,
} from './constraints';
import { createHeadingEstimateFromRadians } from './estimate/headingEstimate';
import { createMotionEstimate } from './estimate/motionEstimate';
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

function stepFromSamples(samples: readonly RawSensorSample[], previousStepCount = 0): PedometerStepSample {
  const matchingSamples = samples.filter((sample): sample is PedometerStepSample => sample.kind === 'pedometer');
  const pedometer = matchingSamples[matchingSamples.length - 1];
  return (
    pedometer ?? {
      kind: 'pedometer',
      timestamp: samples[samples.length - 1]?.timestamp ?? 0,
      steps: previousStepCount,
    }
  );
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
  const stepSample = stepFromSamples(normalizedSamples, currentState.previousStepCount);
  const step = createStepEstimateFromCount(
    stepSample.timestamp,
    stepSample.steps,
    currentState.previousStepCount,
    sensorSamples.length > 0 ? 1 : 0,
    stepSample.cadence,
    stepSample.kind === 'pedometer' ? 'pedometer' : 'unknown',
  );
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
    stepSample.timestamp + stepSample.steps * 31 + previousFilter.generation * 997,
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
  const canUseCandidate = constraintProvider.canMove(currentState.position, candidatePosition);
  const position = canUseCandidate ? candidatePosition : currentState.position;
  const state: MovementSystemState = {
    position,
    headingRadians: nextFilter.headingRadians ?? heading.radians,
    confidence: clamp01(canUseCandidate ? nextFilter.confidence : (currentState.confidence ?? 0.5) * 0.5),
    particleFilter: nextFilter,
    previousStepCount: stepSample.steps,
    lastStepDelta: step.stepDelta,
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
