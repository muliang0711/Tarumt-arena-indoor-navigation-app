import {
  actionLabel,
  classifyNavigationAction,
  shortestAngleDeltaRadians,
} from './angleUtils';
import {
  directionAtDistanceAlongRoute,
  measureRoutePolyline,
  pointAtDistanceAlongRoute,
  projectPointOntoRoute,
} from './routeProjection';
import type {
  NavigationAction,
  NavigationCue,
  NavigationGuidance,
  RoutePolyline,
  UserPose,
} from './guidanceTypes';

type BuildNavigationGuidanceOptions = {
  arrivalThresholdMeters?: number;
  minLookaheadMeters?: number;
  maxLookaheadMeters?: number;
  walkingSpeedMetersPerSecond?: number;
};

function cueConfidence(distanceToRoute: number, headingConfidence?: number): NavigationCue['confidence'] {
  if (distanceToRoute <= 0.75 && (headingConfidence ?? 1) >= 0.7) {
    return 'high';
  }
  if (distanceToRoute <= 2 && (headingConfidence ?? 0.5) >= 0.35) {
    return 'medium';
  }
  return 'low';
}

function formatDistance(distanceMeters: number): string {
  return `${Math.max(1, Math.round(distanceMeters))} m`;
}

function buildCueMessage(action: NavigationAction, distanceMeters: number): string {
  if (action === 'arrived') {
    return 'You have arrived';
  }
  if (action === 'straight') {
    return `Go straight ${formatDistance(distanceMeters)}`;
  }
  return actionLabel(action);
}

function buildCue(
  action: NavigationAction,
  distanceMeters: number,
  routeDirectionRadians: number,
  confidence: NavigationCue['confidence'],
  userHeadingRadians?: number,
  deltaAngleRadians?: number,
): NavigationCue {
  return {
    action,
    message: buildCueMessage(action, distanceMeters),
    distanceMeters,
    routeDirectionRadians,
    userHeadingRadians,
    deltaAngleRadians,
    confidence,
  };
}

function firstUpcomingTurn(
  polyline: RoutePolyline,
  startSegmentIndex: number,
): { action: NavigationAction; routeDirectionRadians: number } | null {
  for (let index = startSegmentIndex; index < polyline.length - 2; index += 1) {
    const current = polyline[index];
    const next = polyline[index + 1];
    const afterNext = polyline[index + 2];
    const currentDirection = Math.atan2(next.y - current.y, next.x - current.x);
    const nextDirection = Math.atan2(afterNext.y - next.y, afterNext.x - next.x);
    const action = classifyNavigationAction(
      shortestAngleDeltaRadians(nextDirection, currentDirection),
    );
    if (action !== 'straight') {
      return {
        action,
        routeDirectionRadians: nextDirection,
      };
    }
  }
  return null;
}

export function buildNavigationGuidance(
  userPose: UserPose,
  routePolyline: RoutePolyline,
  options: BuildNavigationGuidanceOptions = {},
): NavigationGuidance | null {
  if (routePolyline.length < 2) {
    return null;
  }

  const arrivalThresholdMeters = options.arrivalThresholdMeters ?? 0.75;
  const minLookaheadMeters = options.minLookaheadMeters ?? 2;
  const maxLookaheadMeters = options.maxLookaheadMeters ?? 5;
  const walkingSpeedMetersPerSecond = options.walkingSpeedMetersPerSecond ?? 1.2;

  const projection = projectPointOntoRoute(userPose.positionMeters, routePolyline);
  if (!projection) {
    return null;
  }

  const totalDistance = measureRoutePolyline(routePolyline);
  const remainingDistanceMeters = Math.max(0, totalDistance - projection.distanceAlongRoute);
  const estimatedTimeSeconds = remainingDistanceMeters / walkingSpeedMetersPerSecond;

  if (remainingDistanceMeters <= arrivalThresholdMeters) {
    return {
      cue: buildCue('arrived', 0, 0, 'high', userPose.headingRadians),
      nextCue: null,
      remainingDistanceMeters,
      estimatedTimeSeconds,
      projectedDistanceMeters: projection.distanceAlongRoute,
      lookaheadDistanceMeters: 0,
    };
  }

  const lookaheadDistanceMeters = Math.max(
    minLookaheadMeters,
    Math.min(maxLookaheadMeters, remainingDistanceMeters),
  );
  const lookaheadTargetDistance = projection.distanceAlongRoute + lookaheadDistanceMeters;
  const lookaheadPoint = pointAtDistanceAlongRoute(routePolyline, lookaheadTargetDistance);
  const routeDirectionRadians = directionAtDistanceAlongRoute(
    routePolyline,
    lookaheadTargetDistance,
  );
  if (!lookaheadPoint) {
    return null;
  }

  const userHeadingRadians = userPose.headingRadians;
  const deltaAngleRadians =
    userHeadingRadians === undefined
      ? undefined
      : shortestAngleDeltaRadians(routeDirectionRadians, userHeadingRadians);
  const action =
    deltaAngleRadians === undefined
      ? 'straight'
      : classifyNavigationAction(deltaAngleRadians);
  const confidence = cueConfidence(
    projection.distanceToRoute,
    userPose.headingConfidence,
  );

  const currentCue = buildCue(
    action,
    Math.min(remainingDistanceMeters, lookaheadDistanceMeters),
    routeDirectionRadians,
    confidence,
    userHeadingRadians,
    deltaAngleRadians,
  );

  const upcomingTurn = firstUpcomingTurn(routePolyline, projection.segmentIndex);
  const nextCue =
    upcomingTurn === null
      ? null
      : buildCue(
          upcomingTurn.action,
          remainingDistanceMeters,
          upcomingTurn.routeDirectionRadians,
          confidence,
          userHeadingRadians,
          userHeadingRadians === undefined
            ? undefined
            : shortestAngleDeltaRadians(
                upcomingTurn.routeDirectionRadians,
                userHeadingRadians,
              ),
        );

  return {
    cue: currentCue,
    nextCue,
    remainingDistanceMeters,
    estimatedTimeSeconds,
    projectedDistanceMeters: projection.distanceAlongRoute,
    lookaheadDistanceMeters,
  };
}
