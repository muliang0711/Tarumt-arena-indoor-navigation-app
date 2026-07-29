import type { OverlayPoint, RouteSnapResult } from '../type';
import {
  clamp,
  distanceBetweenPoints,
  headingBetweenPoints,
  lerp,
} from './geometryMath';

type ScreenPoint = {
  screenX: number;
  screenY: number;
};

export function snapPointToRoute(
  routePath: readonly OverlayPoint[],
  point: ScreenPoint,
): RouteSnapResult {
  if (routePath.length === 0) {
    throw new Error('Cannot snap to an empty route path.');
  }

  if (routePath.length === 1) {
    const onlyPoint = routePath[0];
    if (!onlyPoint) {
      throw new Error('Cannot snap to an empty route path.');
    }

    return {
      driftPixels: distanceToScreenPoint(point, onlyPoint),
      position: {
        ...onlyPoint,
        distanceAlongRoute: 0,
        headingDegrees: 0,
        segmentIndex: 0,
      },
    };
  }

  let bestSnap: RouteSnapResult | null = null;
  let traversedDistance = 0;

  for (let index = 0; index < routePath.length - 1; index += 1) {
    const from = routePath[index];
    const to = routePath[index + 1];
    if (!from || !to) {
      continue;
    }

    const segmentDistance = distanceBetweenPoints(from, to);
    if (segmentDistance <= 0.001) {
      continue;
    }

    const segmentProgress = projectPointProgressOnSegment({
      from,
      point,
      to,
    });
    const snappedPoint = {
      screenX: lerp(from.screenX, to.screenX, segmentProgress),
      screenY: lerp(from.screenY, to.screenY, segmentProgress),
      tiledX: lerp(from.tiledX, to.tiledX, segmentProgress),
      tiledY: lerp(from.tiledY, to.tiledY, segmentProgress),
    };
    const driftPixels = distanceToScreenPoint(point, snappedPoint);
    const candidate: RouteSnapResult = {
      driftPixels,
      position: {
        ...snappedPoint,
        distanceAlongRoute: traversedDistance + segmentDistance * segmentProgress,
        headingDegrees: headingBetweenPoints(from, to),
        segmentIndex: index,
      },
    };

    if (!bestSnap || candidate.driftPixels < bestSnap.driftPixels) {
      bestSnap = candidate;
    }

    traversedDistance += segmentDistance;
  }

  if (!bestSnap) {
    throw new Error('Cannot snap to a route path without valid segments.');
  }

  return bestSnap;
}

function projectPointProgressOnSegment(input: {
  from: OverlayPoint;
  point: ScreenPoint;
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

function distanceToScreenPoint(from: ScreenPoint, to: ScreenPoint) {
  return Math.hypot(to.screenX - from.screenX, to.screenY - from.screenY);
}
