import type { LineSegment, Point, Polygon } from '../../mapGeometry';

export type MovementConstraintMapInput = {
  walkableAreas: Polygon[];
  blockedAreas?: Polygon[];
  walls: LineSegment[];
  doors?: Polygon[];
  corridors?: Polygon[];
};

export interface MovementConstraintProvider {
  isWalkable(point: Point): boolean;
  canMove(from: Point, to: Point): boolean;
  distanceToWall?(point: Point): number;
}
