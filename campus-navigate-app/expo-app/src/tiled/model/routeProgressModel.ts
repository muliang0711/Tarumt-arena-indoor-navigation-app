import type { OverlayPoint, RoutePosition } from '../type';
import {
  clamp,
  distanceBetweenPoints,
  headingBetweenPoints,
  lerp,
} from './geometryMath';
import { createPathSegmentsFromPoints } from './pathSegmentModel';

export function calculateRouteDistance(points: readonly OverlayPoint[]) {
  let distance = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (from && to) {
      distance += distanceBetweenPoints(from, to);
    }
  }

  return distance;
}

export function interpolateRoutePosition(
  points: readonly OverlayPoint[],
  distanceAlongRoute: number,
): RoutePosition {
  if (points.length === 0) {
    throw new Error('Cannot interpolate an empty route path.');
  }

  const totalDistance = calculateRouteDistance(points);
  const clampedDistance = clamp(distanceAlongRoute, 0, totalDistance);
  let traversedDistance = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (!from || !to) {
      continue;
    }

    const segmentDistance = distanceBetweenPoints(from, to);
    const segmentEndDistance = traversedDistance + segmentDistance;
    if (clampedDistance <= segmentEndDistance || index === points.length - 2) {
      const segmentProgress =
        segmentDistance === 0
          ? 0
          : (clampedDistance - traversedDistance) / segmentDistance;

      return {
        distanceAlongRoute: clampedDistance,
        headingDegrees: headingBetweenPoints(from, to),
        segmentIndex: index,
        screenX: lerp(from.screenX, to.screenX, segmentProgress),
        screenY: lerp(from.screenY, to.screenY, segmentProgress),
        tiledX: lerp(from.tiledX, to.tiledX, segmentProgress),
        tiledY: lerp(from.tiledY, to.tiledY, segmentProgress),
      };
    }

    traversedDistance = segmentEndDistance;
  }

  const lastPoint = points[points.length - 1];
  if (!lastPoint) {
    throw new Error('Cannot interpolate an empty route path.');
  }

  return {
    ...lastPoint,
    distanceAlongRoute: clampedDistance,
    headingDegrees: 0,
    segmentIndex: 0,
  };
}

export function createRemainingRouteSegments(
  points: readonly OverlayPoint[],
  distanceAlongRoute: number,
) {
  if (points.length < 2) {
    return [];
  }

  const routePosition = interpolateRoutePosition(points, distanceAlongRoute);
  const remainingPoints = [
    routePosition,
    ...points.slice(routePosition.segmentIndex + 1),
  ];

  return createPathSegmentsFromPoints(remainingPoints);
}
