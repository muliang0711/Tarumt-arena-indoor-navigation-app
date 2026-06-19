export type Point = {
  x: number;
  y: number;
};

export type WorldPosition = Point;

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Polygon = Point[];

export type LineSegment = {
  from: Point;
  to: Point;
};

export function assertFinitePoint(point: Point, label = 'point'): Point {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error(`${label} must contain finite x and y coordinates.`);
  }
  return point;
}
