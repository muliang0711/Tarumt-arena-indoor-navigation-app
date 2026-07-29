import type { OverlayPoint } from './OverlayPoint';

export type OverlayRouteNode = OverlayPoint & {
  id: number;
  nodeId: string;
  type: string;
};
