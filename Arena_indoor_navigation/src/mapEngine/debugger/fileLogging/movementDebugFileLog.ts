import type { MovementDebugSnapshot } from '../movementDebugModel';

export const MOVEMENT_DEBUG_LOG_SERVER_PORT = 4123;
export const MOVEMENT_DEBUG_LOG_SERVER_PATH = '/__movement-debug-log';

export type MovementDebugLogEntry = {
  deviceTimeIso: string;
  sourceRawCumulativeSteps: number | null;
  latestKnownPedometerSteps: number | null;
  pedometerBaselineSteps: number | null;
  stepsSinceReset: number | null;
  latestStepDelta: number | null;
  batchPedometerSampleCount: number | null;
  batchLatestPedometerSteps: number | null;
  batchLatestPedometerTimestamp: number | null;
  runtimePreviousStepCountBefore: number | null;
  runtimePreviousStepCountAfter: number | null;
  computedStepDelta: number | null;
  reason:
    | 'no-pedometer-in-batch'
    | 'baseline-established'
    | 'same-cumulative-count'
    | 'counter-rollback-rebaseline'
    | 'positive-increment'
    | null;
  status: MovementDebugSnapshot['status'];
  latestTimestamp: number | null;
  latestSampleKind: MovementDebugSnapshot['latestSampleKind'];
  position: { x: number; y: number };
  headingDegrees: number;
  confidence: number | null;
  particleGeneration: number | null;
  canMove: boolean | null;
  rejectionReasons: readonly string[];
};

export function createMovementDebugLogEntry(
  snapshot: MovementDebugSnapshot,
  options: {
    sourceRawCumulativeSteps: number | null;
    deviceTimeIso?: string;
  },
): MovementDebugLogEntry {
  return {
    deviceTimeIso: options.deviceTimeIso ?? new Date().toISOString(),
    sourceRawCumulativeSteps: options.sourceRawCumulativeSteps,
    latestKnownPedometerSteps: snapshot.latestKnownPedometerSteps,
    pedometerBaselineSteps: snapshot.pedometerBaselineSteps,
    stepsSinceReset: snapshot.stepsSinceReset,
    latestStepDelta: snapshot.latestStepDelta,
    batchPedometerSampleCount:
      snapshot.latestStepDiagnostics?.batchPedometerSampleCount ?? null,
    batchLatestPedometerSteps:
      snapshot.latestStepDiagnostics?.batchLatestPedometerSteps ?? null,
    batchLatestPedometerTimestamp:
      snapshot.latestStepDiagnostics?.batchLatestPedometerTimestamp ?? null,
    runtimePreviousStepCountBefore:
      snapshot.latestStepDiagnostics?.previousStepCountBefore ?? null,
    runtimePreviousStepCountAfter:
      snapshot.latestStepDiagnostics?.previousStepCountAfter ?? null,
    computedStepDelta: snapshot.latestStepDiagnostics?.computedStepDelta ?? null,
    reason: snapshot.latestStepDiagnostics?.reason ?? null,
    status: snapshot.status,
    latestTimestamp: snapshot.latestTimestamp,
    latestSampleKind: snapshot.latestSampleKind,
    position: { ...snapshot.position },
    headingDegrees: snapshot.headingDegrees,
    confidence: snapshot.confidence,
    particleGeneration: snapshot.particleGeneration,
    canMove: snapshot.latestMovementAttempt?.canMove ?? null,
    rejectionReasons: snapshot.latestMovementAttempt?.rejectionReasons ?? [],
  };
}

export function serializeMovementDebugLogEntry(
  entry: MovementDebugLogEntry,
): string {
  return `${JSON.stringify(entry)}\n`;
}

export function resolveMovementDebugLogServerOrigin(
  scriptUrl: string | null | undefined,
  port = MOVEMENT_DEBUG_LOG_SERVER_PORT,
): string | null {
  if (!scriptUrl) {
    return null;
  }

  try {
    const normalized =
      scriptUrl.startsWith('exp://')
        ? scriptUrl.replace(/^exp:\/\//, 'http://')
        : scriptUrl;
    const url = new URL(normalized);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return `http://${url.hostname}:${port}`;
  } catch {
    return null;
  }
}
