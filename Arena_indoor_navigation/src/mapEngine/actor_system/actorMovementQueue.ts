import type { WorldPosition } from '../shared';

const DEFAULT_STEP_DURATION_MS = 450;
const MIN_STEP_DURATION_MS = 180;
const MAX_STEP_DURATION_MS = 900;
const MAX_QUEUED_TARGETS = 8;

export type ActorMovementTarget = {
  readonly position: WorldPosition;
  readonly durationMs: number;
};

export type ActorMovementQueue = {
  readonly targets: readonly ActorMovementTarget[];
};

export type ActorMovementTiming = {
  readonly cadenceStepsPerMinute: number | null;
  readonly eventIntervalMs: number | null;
};

export function createActorMovementQueue(): ActorMovementQueue {
  return { targets: [] };
}

function clampDuration(value: number): number {
  return Math.min(
    MAX_STEP_DURATION_MS,
    Math.max(MIN_STEP_DURATION_MS, value),
  );
}

function resolveStepDuration(
  stepCount: number,
  timing: ActorMovementTiming,
): number {
  if (
    timing.cadenceStepsPerMinute !== null &&
    Number.isFinite(timing.cadenceStepsPerMinute) &&
    timing.cadenceStepsPerMinute > 0
  ) {
    return clampDuration(60000 / timing.cadenceStepsPerMinute);
  }
  if (
    timing.eventIntervalMs !== null &&
    Number.isFinite(timing.eventIntervalMs) &&
    timing.eventIntervalMs > 0 &&
    stepCount > 0
  ) {
    return clampDuration(timing.eventIntervalMs / stepCount);
  }
  return DEFAULT_STEP_DURATION_MS;
}

export function appendActorMovementTargets(
  queue: ActorMovementQueue,
  positions: readonly WorldPosition[],
  timing: ActorMovementTiming,
): ActorMovementQueue {
  const durationMs = resolveStepDuration(positions.length, timing);
  const appended = [
    ...queue.targets,
    ...positions
      .filter(
        (position) =>
          Number.isFinite(position.x) && Number.isFinite(position.y),
      )
      .map((position) => ({
        position: { ...position },
        durationMs,
      })),
  ];

  return {
    targets: appended.slice(-MAX_QUEUED_TARGETS),
  };
}

export function consumeActorMovementTarget(queue: ActorMovementQueue): {
  target: ActorMovementTarget | null;
  queue: ActorMovementQueue;
} {
  return {
    target: queue.targets[0] ?? null,
    queue: {
      targets: queue.targets.slice(1),
    },
  };
}
