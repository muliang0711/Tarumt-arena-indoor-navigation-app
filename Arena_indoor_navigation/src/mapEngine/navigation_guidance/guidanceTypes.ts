import type { WorldPosition } from '../shared';

export type UserPose = {
  positionMeters: WorldPosition;
  headingRadians?: number;
  headingConfidence?: number;
  positionConfidence?: number;
};

export type RoutePoint = {
  x: number;
  y: number;
};

export type RoutePolyline = RoutePoint[];

export type NavigationAction =
  | 'straight'
  | 'slight_left'
  | 'left'
  | 'sharp_left'
  | 'slight_right'
  | 'right'
  | 'sharp_right'
  | 'u_turn'
  | 'arrived';

export type NavigationCue = {
  action: NavigationAction;
  message: string;
  distanceMeters: number;
  routeDirectionRadians: number;
  userHeadingRadians?: number;
  deltaAngleRadians?: number;
  confidence: 'high' | 'medium' | 'low';
};

export type RouteProjection = {
  projectedPoint: RoutePoint;
  segmentIndex: number;
  distanceAlongRoute: number;
  distanceToRoute: number;
};

export type NavigationGuidance = {
  cue: NavigationCue;
  nextCue: NavigationCue | null;
  remainingDistanceMeters: number;
  estimatedTimeSeconds: number;
  projectedDistanceMeters: number;
  lookaheadDistanceMeters: number;
};
