import type { LineSegment, Point, Polygon } from './geometry';
import type { MapCoordinateSystem } from './coordinateSystem';

export type RouteNode = {
  node_id?: string;
  id?: string;
  position: Point;
};

export type MovementRouteGraph = {
  nodes: RouteNode[];
  edges: unknown[];
};

export type MovementConstraintMapInput = {
  coordinateSystem: MapCoordinateSystem;
  routeGraph: MovementRouteGraph;
  walkableAreas: Polygon[];
  blockedAreas?: Polygon[];
  walls: LineSegment[];
  doors?: Polygon[];
  corridors?: Polygon[];
};
