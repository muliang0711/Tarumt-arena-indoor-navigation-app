import type { Point } from '../../shared';

export type { MovementConstraintMapInput } from '../../shared';

export interface MovementConstraintProvider {
  isWalkable(point: Point): boolean;
  canMove(from: Point, to: Point): boolean;
  distanceToWall?(point: Point): number;
}
