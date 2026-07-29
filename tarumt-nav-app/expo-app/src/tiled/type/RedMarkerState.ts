import type { OverlayPoint } from './OverlayPoint';

export type RedMarkerState = OverlayPoint & {
  headingDegrees: number;
  kind: 'redMarker';
};
