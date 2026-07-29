import type { OverlayPoint } from './OverlayPoint';

export type RoutePosition = OverlayPoint & {
  distanceAlongRoute: number;
  headingDegrees: number;
  segmentIndex: number;
};
