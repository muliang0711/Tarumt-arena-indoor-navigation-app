export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Point = {
  x: number;
  y: number;
};

export type Polygon = Point[];

export type LineSegment = {
  from: Point;
  to: Point;
};
