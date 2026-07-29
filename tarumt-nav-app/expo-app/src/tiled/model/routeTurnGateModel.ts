import type { OverlayPoint, RoutePosition, RouteSnapResult } from '../type';
import {
  clamp,
  distanceBetweenPoints,
  headingBetweenPoints,
  lerp,
} from './geometryMath';
import { calculateRouteDistance, interpolateRoutePosition } from './routeProgressModel';

export type RouteTurnGateConfig = {
  headingToleranceDegrees: number;
  turnApproachRadiusPixels: number;
  turnCaptureRadiusPixels: number;
};

export const DEFAULT_ROUTE_TURN_GATE_CONFIG: RouteTurnGateConfig = {
  headingToleranceDegrees: 35,
  turnApproachRadiusPixels: 112,
  turnCaptureRadiusPixels: 24,
};

export function createTurnAwareRoutePosition(input: {
  config?: Partial<RouteTurnGateConfig>;
  observedHeadingDegrees: number;
  routePath: readonly OverlayPoint[];
  routePosition: RoutePosition;
}) {
  const config = {
    ...DEFAULT_ROUTE_TURN_GATE_CONFIG,
    ...input.config,
  };
  const nextSegmentHeading = getNextSegmentHeadingIfApproachAllowed({
    config,
    observedHeadingDegrees: input.observedHeadingDegrees,
    routePath: input.routePath,
    routePosition: input.routePosition,
  });
  const previousSegment = getPreviousSegmentIfReverseAllowed({
    config,
    observedHeadingDegrees: input.observedHeadingDegrees,
    routePath: input.routePath,
    routePosition: input.routePosition,
  });

  if (nextSegmentHeading !== null) {
    return {
      ...input.routePosition,
      headingDegrees: nextSegmentHeading,
    };
  }

  if (previousSegment !== null) {
    return {
      ...input.routePosition,
      headingDegrees: previousSegment.headingDegrees,
      segmentIndex: previousSegment.segmentIndex,
    };
  }

  return input.routePosition;
}

export function createAcceptedRouteHeadingDegrees(input: {
  config?: Partial<RouteTurnGateConfig>;
  routePath: readonly OverlayPoint[];
  routePosition: RoutePosition;
}) {
  const config = {
    ...DEFAULT_ROUTE_TURN_GATE_CONFIG,
    ...input.config,
  };
  const headings = [input.routePosition.headingDegrees];
  const nextSegmentHeading = getNextSegmentHeadingIfNearTurn({
    config: {
      turnCaptureRadiusPixels: config.turnApproachRadiusPixels,
    },
    routePath: input.routePath,
    routePosition: input.routePosition,
  });

  if (
    nextSegmentHeading !== null &&
    !headings.some(
      (heading) => shortestAngleDistanceDegrees(heading, nextSegmentHeading) < 1,
    )
  ) {
    headings.push(nextSegmentHeading);
  }

  return headings;
}

export function constrainEstimateToRouteProgress(input: {
  config?: Partial<RouteTurnGateConfig>;
  estimate: {
    headingDegrees: number;
    screenX: number;
    screenY: number;
  };
  previousPosition: RoutePosition;
  routePath: readonly OverlayPoint[];
}): RouteSnapResult {
  const config = {
    ...DEFAULT_ROUTE_TURN_GATE_CONFIG,
    ...input.config,
  };
  const currentSnap = snapPointToSegment({
    point: input.estimate,
    routePath: input.routePath,
    segmentIndex: input.previousPosition.segmentIndex,
  });
  const nextSegment = getNextSegmentIfTurnAllowed({
    config,
    observedHeadingDegrees: input.estimate.headingDegrees,
    routePath: input.routePath,
    routePosition: input.previousPosition,
  });
  const nextSnap =
    nextSegment === null
      ? null
      : snapPointToSegment({
          point: input.estimate,
          routePath: input.routePath,
          segmentIndex: nextSegment.segmentIndex,
        });
  const previousSegment = getPreviousSegmentIfReverseAllowed({
    config,
    observedHeadingDegrees: input.estimate.headingDegrees,
    routePath: input.routePath,
    routePosition: input.previousPosition,
  });
  const previousSnap =
    previousSegment === null
      ? null
      : snapPointToSegment({
          point: input.estimate,
          routePath: input.routePath,
          segmentIndex: previousSegment.segmentIndex,
        });
  const candidates = [currentSnap, nextSnap, previousSnap]
    .filter((candidate): candidate is RouteSnapResult => Boolean(candidate))
    .map((candidate) => clampTinyRouteProgressNoise(candidate, input.previousPosition));
  const bestCandidate = candidates.sort(
    (left, right) => left.driftPixels - right.driftPixels,
  )[0];

  if (!bestCandidate) {
    return {
      driftPixels: Math.hypot(
        input.estimate.screenX - input.previousPosition.screenX,
        input.estimate.screenY - input.previousPosition.screenY,
      ),
      position: input.previousPosition,
    };
  }

  return bestCandidate;
}

function clampTinyRouteProgressNoise(
  candidate: RouteSnapResult,
  previousPosition: RoutePosition,
) {
  if (
    candidate.position.segmentIndex === previousPosition.segmentIndex &&
    Math.abs(
      candidate.position.distanceAlongRoute -
        previousPosition.distanceAlongRoute,
    ) < 0.5
  ) {
    return {
      driftPixels: candidate.driftPixels,
      position: previousPosition,
    };
  }

  return candidate;
}

function getNextSegmentIfTurnAllowed(input: {
  config: RouteTurnGateConfig;
  observedHeadingDegrees: number;
  routePath: readonly OverlayPoint[];
  routePosition: RoutePosition;
}) {
  const nextSegmentIndex = input.routePosition.segmentIndex + 1;
  const nextSegmentHeading = getSegmentHeading(input.routePath, nextSegmentIndex);
  if (nextSegmentHeading === null) {
    return null;
  }

  const currentSegmentEndDistance = getSegmentEndDistance(
    input.routePath,
    input.routePosition.segmentIndex,
  );
  const distanceToTurn =
    currentSegmentEndDistance - input.routePosition.distanceAlongRoute;
  const isAtTurn = distanceToTurn <= input.config.turnCaptureRadiusPixels;
  const isFacingNextSegment =
    shortestAngleDistanceDegrees(
      input.observedHeadingDegrees,
      nextSegmentHeading,
    ) <= input.config.headingToleranceDegrees;

  return isAtTurn && isFacingNextSegment
    ? {
        headingDegrees: nextSegmentHeading,
        segmentIndex: nextSegmentIndex,
      }
    : null;
}

function getNextSegmentHeadingIfApproachAllowed(input: {
  config: RouteTurnGateConfig;
  observedHeadingDegrees: number;
  routePath: readonly OverlayPoint[];
  routePosition: RoutePosition;
}) {
  const nextSegmentHeading = getNextSegmentHeadingIfNearTurn({
    config: {
      ...input.config,
      turnCaptureRadiusPixels: input.config.turnApproachRadiusPixels,
    },
    routePath: input.routePath,
    routePosition: input.routePosition,
  });
  if (nextSegmentHeading === null) {
    return null;
  }

  return shortestAngleDistanceDegrees(
    input.observedHeadingDegrees,
    nextSegmentHeading,
  ) <= input.config.headingToleranceDegrees
    ? nextSegmentHeading
    : null;
}

function getNextSegmentHeadingIfNearTurn(input: {
  config: Pick<RouteTurnGateConfig, 'turnCaptureRadiusPixels'>;
  routePath: readonly OverlayPoint[];
  routePosition: RoutePosition;
}) {
  const nextSegmentIndex = input.routePosition.segmentIndex + 1;
  const nextSegmentHeading = getSegmentHeading(input.routePath, nextSegmentIndex);
  if (nextSegmentHeading === null) {
    return null;
  }

  const currentSegmentEndDistance = getSegmentEndDistance(
    input.routePath,
    input.routePosition.segmentIndex,
  );
  const distanceToTurn =
    currentSegmentEndDistance - input.routePosition.distanceAlongRoute;

  return distanceToTurn <= input.config.turnCaptureRadiusPixels
    ? nextSegmentHeading
    : null;
}

function getPreviousSegmentIfReverseAllowed(input: {
  config: RouteTurnGateConfig;
  observedHeadingDegrees: number;
  routePath: readonly OverlayPoint[];
  routePosition: RoutePosition;
}) {
  const previousSegmentIndex = input.routePosition.segmentIndex - 1;
  const previousSegmentHeading = getSegmentHeading(
    input.routePath,
    previousSegmentIndex,
  );
  if (previousSegmentHeading === null) {
    return null;
  }

  const currentSegmentStartDistance = getSegmentStartDistance(
    input.routePath,
    input.routePosition.segmentIndex,
  );
  const distanceToPreviousTurn =
    input.routePosition.distanceAlongRoute - currentSegmentStartDistance;
  const isAtTurn =
    distanceToPreviousTurn <= input.config.turnCaptureRadiusPixels;
  const isFacingBackwardOnPreviousSegment =
    shortestAngleDistanceDegrees(
      input.observedHeadingDegrees,
      previousSegmentHeading + 180,
    ) <= input.config.headingToleranceDegrees;

  return isAtTurn && isFacingBackwardOnPreviousSegment
    ? {
        headingDegrees: previousSegmentHeading,
        segmentIndex: previousSegmentIndex,
      }
    : null;
}

function snapPointToSegment(input: {
  point: {
    screenX: number;
    screenY: number;
  };
  routePath: readonly OverlayPoint[];
  segmentIndex: number;
}): RouteSnapResult | null {
  const from = input.routePath[input.segmentIndex];
  const to = input.routePath[input.segmentIndex + 1];
  if (!from || !to) {
    return null;
  }

  const segmentDistance = distanceBetweenPoints(from, to);
  if (segmentDistance <= 0.001) {
    return null;
  }

  const segmentProgress = projectPointProgressOnSegment({
    from,
    point: input.point,
    to,
  });
  const segmentStartDistance = getSegmentStartDistance(
    input.routePath,
    input.segmentIndex,
  );
  const snappedPoint = {
    screenX: lerp(from.screenX, to.screenX, segmentProgress),
    screenY: lerp(from.screenY, to.screenY, segmentProgress),
    tiledX: lerp(from.tiledX, to.tiledX, segmentProgress),
    tiledY: lerp(from.tiledY, to.tiledY, segmentProgress),
  };

  return {
    driftPixels: Math.hypot(
      input.point.screenX - snappedPoint.screenX,
      input.point.screenY - snappedPoint.screenY,
    ),
    position: {
      ...snappedPoint,
      distanceAlongRoute: segmentStartDistance + segmentDistance * segmentProgress,
      headingDegrees: headingBetweenPoints(from, to),
      segmentIndex: input.segmentIndex,
    },
  };
}

function getSegmentHeading(
  routePath: readonly OverlayPoint[],
  segmentIndex: number,
) {
  const from = routePath[segmentIndex];
  const to = routePath[segmentIndex + 1];

  return from && to ? headingBetweenPoints(from, to) : null;
}

function getSegmentStartDistance(
  routePath: readonly OverlayPoint[],
  segmentIndex: number,
) {
  if (segmentIndex <= 0) {
    return 0;
  }

  return calculateRouteDistance(routePath.slice(0, segmentIndex + 1));
}

function getSegmentEndDistance(
  routePath: readonly OverlayPoint[],
  segmentIndex: number,
) {
  const distance = calculateRouteDistance(routePath.slice(0, segmentIndex + 2));
  return distance || calculateRouteDistance(routePath);
}

function projectPointProgressOnSegment(input: {
  from: OverlayPoint;
  point: {
    screenX: number;
    screenY: number;
  };
  to: OverlayPoint;
}) {
  const segmentX = input.to.screenX - input.from.screenX;
  const segmentY = input.to.screenY - input.from.screenY;
  const pointX = input.point.screenX - input.from.screenX;
  const pointY = input.point.screenY - input.from.screenY;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared <= 0.001) {
    return 0;
  }

  return clamp(
    (pointX * segmentX + pointY * segmentY) / segmentLengthSquared,
    0,
    1,
  );
}

function normalizeDegrees(degrees: number) {
  return ((degrees % 360) + 360) % 360;
}

function shortestAngleDistanceDegrees(from: number, to: number) {
  const difference = Math.abs(normalizeDegrees(from) - normalizeDegrees(to));
  return Math.min(difference, 360 - difference);
}
