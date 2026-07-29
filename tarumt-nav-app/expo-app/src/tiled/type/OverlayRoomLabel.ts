import type { OverlayPoint } from './OverlayPoint';

export type OverlayRoomLabel = OverlayPoint & {
  height: number;
  id: number;
  name: string;
  width: number;
};
