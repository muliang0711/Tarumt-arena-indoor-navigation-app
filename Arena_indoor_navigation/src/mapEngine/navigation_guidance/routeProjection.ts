import type { MovementRouteGraph, RouteNode } from '../shared';
import type { HighlightedRoute } from '../debugger';
import type { RoutePoint, RoutePolyline, RouteProjection } from './guidanceTypes';

function nodeId(node: RouteNode): string | null {
  return node.node_id ?? node.id ?? null;
}

export function buildRoutePolyline(
  route: HighlightedRoute | null,
  routeGraph: MovementRouteGraph,
): RoutePolyline {
  if (!route || route.nodeIds.length === 0) {
    return [];
  }

  const nodes = new Map(
    routeGraph.nodes.flatMap((node) => {
      const id = nodeId(node);
      return id ? [[id, node] as const] : [];
    }),
  );

  const polyline = route.nodeIds
    .map((id) => nodes.get(id))
    .filter((node): node is RouteNode => node !== undefined)
    .map((node) => ({ x: node.position.x, y: node.position.y }));

  return polyline.filter(
    (point, index, allPoints) =>
      index === 0 ||
      point.x !== allPoints[index - 1].x ||
      point.y !== allPoints[index - 1].y,
  );
}

export function distanceBetweenPoints(from: RoutePoint, to: RoutePoint): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

export function measureRoutePolyline(polyline: RoutePolyline): number {
  let distance = 0;
  for (let index = 0; index < polyline.length - 1; index += 1) {
    distance += distanceBetweenPoints(polyline[index], polyline[index + 1]);
  }
  return distance;
}

function projectOntoSegment(
  point: RoutePoint,
  from: RoutePoint,
  to: RoutePoint,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return {
      projectedPoint: from,
      ratio: 0,
      distanceToPoint: distanceBetweenPoints(point, from),
    };
  }

  const rawRatio = ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared;
  const ratio = Math.max(0, Math.min(1, rawRatio));
  const projectedPoint = {
    x: from.x + dx * ratio,
    y: from.y + dy * ratio,
  };

  return {
    projectedPoint,
    ratio,
    distanceToPoint: distanceBetweenPoints(point, projectedPoint),
  };
}

export function projectPointOntoRoute(
  point: RoutePoint,
  polyline: RoutePolyline,
): RouteProjection | null {
  if (polyline.length === 0) {
    return null;
  }
  if (polyline.length === 1) {
    return {
      projectedPoint: polyline[0],
      segmentIndex: 0,
      distanceAlongRoute: 0,
      distanceToRoute: distanceBetweenPoints(point, polyline[0]),
    };
  }

  let bestProjection: RouteProjection | null = null;
  let traversedDistance = 0;

  for (let index = 0; index < polyline.length - 1; index += 1) {
    const from = polyline[index];
    const to = polyline[index + 1];
    const segmentLength = distanceBetweenPoints(from, to);
    const projection = projectOntoSegment(point, from, to);
    const candidate: RouteProjection = {
      projectedPoint: projection.projectedPoint,
      segmentIndex: index,
      distanceAlongRoute: traversedDistance + segmentLength * projection.ratio,
      distanceToRoute: projection.distanceToPoint,
    };

    if (
      bestProjection === null ||
      candidate.distanceToRoute < bestProjection.distanceToRoute
    ) {
      bestProjection = candidate;
    }

    traversedDistance += segmentLength;
  }

  return bestProjection;
}

export function pointAtDistanceAlongRoute(
  polyline: RoutePolyline,
  targetDistance: number,
): RoutePoint | null {
  if (polyline.length === 0) {
    return null;
  }
  if (polyline.length === 1) {
    return polyline[0];
  }

  const clampedDistance = Math.max(0, targetDistance);
  let traversedDistance = 0;

  for (let index = 0; index < polyline.length - 1; index += 1) {
    const from = polyline[index];
    const to = polyline[index + 1];
    const segmentLength = distanceBetweenPoints(from, to);
    if (clampedDistance <= traversedDistance + segmentLength) {
      const ratio = segmentLength === 0 ? 0 : (clampedDistance - traversedDistance) / segmentLength;
      return {
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio,
      };
    }
    traversedDistance += segmentLength;
  }

  return polyline.at(-1) ?? null;
}

export function directionAtDistanceAlongRoute(
  polyline: RoutePolyline,
  targetDistance: number,
): number {
  if (polyline.length < 2) {
    return 0;
  }

  const clampedDistance = Math.max(0, targetDistance);
  let traversedDistance = 0;

  for (let index = 0; index < polyline.length - 1; index += 1) {
    const from = polyline[index];
    const to = polyline[index + 1];
    const segmentLength = distanceBetweenPoints(from, to);
    if (clampedDistance <= traversedDistance + segmentLength) {
      return Math.atan2(to.y - from.y, to.x - from.x);
    }
    traversedDistance += segmentLength;
  }

  const beforeLast = polyline.at(-2) ?? polyline[0];
  const last = polyline.at(-1) ?? polyline[0];
  return Math.atan2(last.y - beforeLast.y, last.x - beforeLast.x);
}
