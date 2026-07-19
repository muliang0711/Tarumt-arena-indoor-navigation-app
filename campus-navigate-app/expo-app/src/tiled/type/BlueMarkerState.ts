import type { OverlayPoint } from './OverlayPoint';

export type BlueMarkerState = OverlayPoint & {
  kind: 'blueMarker';
  routeNodeId: string;
};
