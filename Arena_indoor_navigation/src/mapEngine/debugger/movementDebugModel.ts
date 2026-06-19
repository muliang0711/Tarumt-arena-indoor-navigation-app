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
  pedometerSteps: number | null;
  status: MovementProcessingStatus;
  position: { x: number; y: number };
  headingDegrees: number;
  confidence: number | null;
  particleGeneration: number | null;
  destinationLabel: string;
};

type BuildMovementDebugSnapshotInput = {
  samples: readonly RawSensorSample[];
  state: MovementSystemState;
  status: MovementProcessingStatus;
  destinationNodeId: string;
  destinationAvailable: boolean;
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
}: BuildMovementDebugSnapshotInput): MovementDebugSnapshot {
  const orderedSamples = [...samples].sort(
    (left, right) => left.timestamp - right.timestamp,
  );
  const latestSample = orderedSamples.at(-1) ?? null;
  const latestPedometer = orderedSamples
    .filter(
      (sample): sample is Extract<RawSensorSample, { kind: 'pedometer' }> =>
        sample.kind === 'pedometer',
    )
    .at(-1);
  const counts = samples.reduce<SensorKindCounts>(
    (result, sample) => ({
      ...result,
      [sample.kind]: result[sample.kind] + 1,
    }),
    { ...EMPTY_COUNTS },
  );

  return {
    totalSamples: samples.length,
    counts,
    latestSampleKind: latestSample?.kind ?? null,
    latestTimestamp: latestSample?.timestamp ?? null,
    pedometerSteps: latestPedometer?.steps ?? null,
    status,
    position: { ...state.position },
    headingDegrees: Math.round((state.headingRadians * 180) / Math.PI),
    confidence: state.confidence ?? null,
    particleGeneration: state.particleFilter?.generation ?? null,
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
