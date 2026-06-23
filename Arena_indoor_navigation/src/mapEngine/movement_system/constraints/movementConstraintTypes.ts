import type { Point } from '../../shared';

export type { MovementConstraintMapInput } from '../../shared';

export type MovementConstraintRejectionReason =
  | 'outside-walkable-area'
  | 'inside-blocked-area'
  | 'crossed-wall'
  | 'crossed-blocked-area';

export type MovementConstraintAnalysis = {
  currentPosition: Point;
  candidatePosition: Point;
  canMove: boolean;
  insideWalkableArea: boolean;
  insideBlockedArea: boolean;
  crossedWall: boolean;
  crossedBlockedArea: boolean;
  rejectionReasons: readonly MovementConstraintRejectionReason[];
};

export interface MovementConstraintProvider {
  isWalkable(point: Point): boolean;
  canMove(from: Point, to: Point): boolean;
  analyzeMove(from: Point, to: Point): MovementConstraintAnalysis;
  distanceToWall?(point: Point): number;
}
