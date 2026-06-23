import type {
  MovementRouteGraph,
  RawSensorSample,
  RouteNode,
  SensorKind,
} from '../shared';
import type { MovementSystemState } from '../movement_system';

export type MovementProcessingStatus =
  | 'processed'
  | 'ignored'
  | 'reset'
  | 'waiting';

export type SensorKindCounts = Record<SensorKind, number>;

export type MovementDebugSnapshot = {
  totalSamples: number;
  counts: SensorKindCounts;
  latestSampleKind: SensorKind | null;
  latestTimestamp: number | null;
  latestKnownPedometerSteps: number | null;
  pedometerBaselineSteps: number | null;
  stepsSinceReset: number | null;
  latestStepDelta: number | null;
  status: MovementProcessingStatus;
  position: { x: number; y: number };
  headingDegrees: number;
  headingConfidence: number | null;
  confidence: number | null;
  acceptedStepPositionCount: number;
  particleGeneration: number | null;
  latestStepDiagnostics: {
    batchPedometerSampleCount: number;
    batchLatestPedometerSteps: number | null;
    batchLatestPedometerTimestamp: number | null;
    previousStepCountBefore: number | null;
    previousStepCountAfter: number | null;
    computedStepDelta: number;
    reason:
      | 'no-pedometer-in-batch'
      | 'baseline-established'
      | 'same-cumulative-count'
      | 'counter-rollback-rebaseline'
      | 'positive-increment';
  } | null;
  latestMovementAttempt: MovementSystemState['latestMovementAttempt'] | null;
  destinationLabel: string;
};

export type PedometerDebugState = {
  latestKnownSteps: number | null;
  baselineSteps: number | null;
};

type BuildMovementDebugSnapshotInput = {
  samples: readonly RawSensorSample[];
  state: MovementSystemState;
  status: MovementProcessingStatus;
  destinationNodeId: string;
  destinationAvailable: boolean;
  pedometer: PedometerDebugState;
  acceptedStepPositionCount?: number;
};

const EMPTY_COUNTS: SensorKindCounts = {
  accelerometer: 0,
  gyroscope: 0,
  magnetometer: 0,
  pedometer: 0,
  deviceMotion: 0,
};

export function buildMovementDebugSnapshot({
  samples,
  state,
  status,
  destinationNodeId,
  destinationAvailable,
  pedometer,
  acceptedStepPositionCount = 0,
}: BuildMovementDebugSnapshotInput): MovementDebugSnapshot {
  const orderedSamples = [...samples].sort(
    (left, right) => left.timestamp - right.timestamp,
  );
  const latestSample = orderedSamples.at(-1) ?? null;
  const counts = samples.reduce<SensorKindCounts>(
    (result, sample) => ({
      ...result,
      [sample.kind]: result[sample.kind] + 1,
    }),
    { ...EMPTY_COUNTS },
  );
  const stepsSinceReset =
    pedometer.latestKnownSteps !== null && pedometer.baselineSteps !== null
      ? Math.max(0, pedometer.latestKnownSteps - pedometer.baselineSteps)
      : null;

  return {
    totalSamples: samples.length,
    counts,
    latestSampleKind: latestSample?.kind ?? null,
    latestTimestamp: latestSample?.timestamp ?? null,
    latestKnownPedometerSteps: pedometer.latestKnownSteps,
    pedometerBaselineSteps: pedometer.baselineSteps,
    stepsSinceReset,
    latestStepDelta: state.lastStepDelta ?? null,
    status,
    position: { ...state.position },
    headingDegrees: Math.round((state.headingRadians * 180) / Math.PI),
    headingConfidence: state.headingConfidence ?? null,
    confidence: state.confidence ?? null,
    acceptedStepPositionCount,
    particleGeneration: state.particleFilter?.generation ?? null,
    latestStepDiagnostics: state.latestStepDiagnostics
      ? {
          batchPedometerSampleCount: state.latestStepDiagnostics.batchPedometerSampleCount,
          batchLatestPedometerSteps:
            state.latestStepDiagnostics.batchLatestPedometerSteps ?? null,
          batchLatestPedometerTimestamp:
            state.latestStepDiagnostics.batchLatestPedometerTimestamp ?? null,
          previousStepCountBefore:
            state.latestStepDiagnostics.previousStepCountBefore ?? null,
          previousStepCountAfter:
            state.latestStepDiagnostics.previousStepCountAfter ?? null,
          computedStepDelta: state.latestStepDiagnostics.computedStepDelta,
          reason: state.latestStepDiagnostics.reason,
        }
      : null,
    latestMovementAttempt: state.latestMovementAttempt ?? null,
    destinationLabel: destinationAvailable
      ? destinationNodeId.replace(/^node_/, 'Node ')
      : 'unavailable',
  };
}

export function findDestinationNode(
  routeGraph: MovementRouteGraph,
  nodeId: string,
): RouteNode | null {
  return (
    routeGraph.nodes.find(
      (node) => node.node_id === nodeId || node.id === nodeId,
    ) ?? null
  );
}
