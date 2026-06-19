import type { LineSegment, Point, Polygon } from '../../shared';
import type { MovementConstraintMapInput, MovementConstraintProvider } from './movementConstraintTypes';

const EPSILON = 0.000001;

function squaredDistance(left: Point, right: Point): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}

function distanceToSegment(point: Point, segment: LineSegment): number {
  const dx = segment.to.x - segment.from.x;
  const dy = segment.to.y - segment.from.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared <= EPSILON) {
    return Math.sqrt(squaredDistance(point, segment.from));
  }

  const projection = Math.max(
    0,
    Math.min(1, ((point.x - segment.from.x) * dx + (point.y - segment.from.y) * dy) / lengthSquared),
  );
  const closestPoint = {
    x: segment.from.x + projection * dx,
    y: segment.from.y + projection * dy,
  };

  return Math.sqrt(squaredDistance(point, closestPoint));
}

function orientation(a: Point, b: Point, c: Point): number {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) <= EPSILON) {
    return 0;
  }
  return value > 0 ? 1 : 2;
}

function isPointOnSegment(point: Point, segment: LineSegment): boolean {
  return (
    point.x <= Math.max(segment.from.x, segment.to.x) + EPSILON &&
    point.x + EPSILON >= Math.min(segment.from.x, segment.to.x) &&
    point.y <= Math.max(segment.from.y, segment.to.y) + EPSILON &&
    point.y + EPSILON >= Math.min(segment.from.y, segment.to.y) &&
    orientation(segment.from, point, segment.to) === 0
  );
}

function segmentsIntersect(left: LineSegment, right: LineSegment): boolean {
  const o1 = orientation(left.from, left.to, right.from);
  const o2 = orientation(left.from, left.to, right.to);
  const o3 = orientation(right.from, right.to, left.from);
  const o4 = orientation(right.from, right.to, left.to);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  return (
    (o1 === 0 && isPointOnSegment(right.from, left)) ||
    (o2 === 0 && isPointOnSegment(right.to, left)) ||
    (o3 === 0 && isPointOnSegment(left.from, right)) ||
    (o4 === 0 && isPointOnSegment(left.to, right))
  );
}

function polygonEdges(polygon: Polygon): LineSegment[] {
  if (polygon.length < 2) {
    return [];
  }

  return polygon.map((point, index) => ({
    from: point,
    to: polygon[(index + 1) % polygon.length],
  }));
}

function pointInPolygon(point: Point, polygon: Polygon): boolean {
  if (polygon.length < 3) {
    return false;
  }

  if (polygonEdges(polygon).some((edge) => isPointOnSegment(point, edge))) {
    return true;
  }

  let inside = false;
  for (let currentIndex = 0, previousIndex = polygon.length - 1; currentIndex < polygon.length; previousIndex = currentIndex++) {
    const current = polygon[currentIndex];
    const previous = polygon[previousIndex];
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function movementCrossesPolygon(move: LineSegment, polygon: Polygon): boolean {
  return pointInPolygon(move.to, polygon) || polygonEdges(polygon).some((edge) => segmentsIntersect(move, edge));
}

export function createMovementConstraintProvider(input: MovementConstraintMapInput): MovementConstraintProvider {
  const walkableAreas = input.walkableAreas;
  const blockedAreas = input.blockedAreas ?? [];
  const walls = input.walls;

  function isWalkable(point: Point): boolean {
    const insideWalkableArea = walkableAreas.length === 0 || walkableAreas.some((area) => pointInPolygon(point, area));
    const insideBlockedArea = blockedAreas.some((area) => pointInPolygon(point, area));
    return insideWalkableArea && !insideBlockedArea;
  }

  function canMove(from: Point, to: Point): boolean {
    if (!isWalkable(from) || !isWalkable(to)) {
      return false;
    }

    const movement = { from, to };
    const crossesWall = walls.some((wall) => segmentsIntersect(movement, wall));
    const crossesBlockedArea = blockedAreas.some((area) => movementCrossesPolygon(movement, area));
    return !crossesWall && !crossesBlockedArea;
  }

  function distanceToWall(point: Point): number {
    if (walls.length === 0) {
      return Infinity;
    }

    return Math.min(...walls.map((wall) => distanceToSegment(point, wall)));
  }

  return {
    isWalkable,
    canMove,
    distanceToWall,
  };
}

export function isParticlePositionValid(
  provider: MovementConstraintProvider,
  previousPosition: Point | undefined,
  nextPosition: Point,
): boolean {
  return previousPosition ? provider.canMove(previousPosition, nextPosition) : provider.isWalkable(nextPosition);
}
