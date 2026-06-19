import type { LineSegment, Point, Polygon } from './geometry';
import type { MapCoordinateSystem } from './coordinateSystem';

export type RouteNode = {
  node_id?: string;
  id?: string;
  position: Point;
};

export type RouteEdge = {
  edge_id?: string;
  id?: string;
  from_node: string;
  to_node: string;
  bidirectional?: boolean;
  weight?: number;
  distance_m?: number;
  enabled?: boolean;
};

export type MovementRouteGraph = {
  nodes: RouteNode[];
  edges: RouteEdge[];
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
