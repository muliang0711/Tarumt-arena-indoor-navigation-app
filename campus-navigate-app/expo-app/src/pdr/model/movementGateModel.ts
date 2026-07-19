import type { PdrPipelineConfig } from '../type';
import { normalizeDegrees, shortestAngleDistanceDegrees } from './angleModel';

export type RouteMovementDirection = 'backward' | 'blocked' | 'forward';

export function shouldMoveForHeading(input: {
  config: PdrPipelineConfig;
  desiredHeadingDegrees: number;
  observedHeadingDegrees: number;
}) {
  return getRouteMovementDirection(input) !== 'blocked';
}

export function getRouteMovementDirection(input: {
  config: PdrPipelineConfig;
  desiredHeadingDegrees: number;
  observedHeadingDegrees: number;
}): RouteMovementDirection {
  const forwardDistance =
    shortestAngleDistanceDegrees(
      input.observedHeadingDegrees,
      input.desiredHeadingDegrees,
    );
  const backwardDistance = shortestAngleDistanceDegrees(
    input.observedHeadingDegrees,
    normalizeDegrees(input.desiredHeadingDegrees + 180),
  );

  if (forwardDistance <= input.config.movementHeadingToleranceDegrees) {
    return 'forward';
  }

  if (backwardDistance <= input.config.movementHeadingToleranceDegrees) {
    return 'backward';
  }

  return 'blocked';
}
