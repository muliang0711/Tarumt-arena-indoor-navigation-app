import type { WorldPosition } from '../shared';

const SNAP_DISTANCE_METERS = 0.01;

function isFinitePosition(position: WorldPosition): boolean {
  return Number.isFinite(position.x) && Number.isFinite(position.y);
}

export function distanceBetweenPositions(
  from: WorldPosition,
  to: WorldPosition,
): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

export function stepActorRenderPosition(
  current: WorldPosition,
  target: WorldPosition,
  maxDistanceMeters: number,
): WorldPosition {
  if (
    !isFinitePosition(current) ||
    !isFinitePosition(target) ||
    !Number.isFinite(maxDistanceMeters) ||
    maxDistanceMeters <= 0
  ) {
    return { ...target };
  }

  const distance = distanceBetweenPositions(current, target);
  if (distance <= SNAP_DISTANCE_METERS || distance <= maxDistanceMeters) {
    return { ...target };
  }

  const ratio = maxDistanceMeters / distance;
  return {
    x: current.x + (target.x - current.x) * ratio,
    y: current.y + (target.y - current.y) * ratio,
  };
}

export function shouldContinueActorSmoothing(
  current: WorldPosition,
  target: WorldPosition,
): boolean {
  if (!isFinitePosition(current) || !isFinitePosition(target)) {
    return false;
  }

  return distanceBetweenPositions(current, target) > SNAP_DISTANCE_METERS;
}
