import type { BlueMarkerState } from './BlueMarkerState';
import type { OverlayPathSegment } from './OverlayPathSegment';
import type { OverlayRoomLabel } from './OverlayRoomLabel';
import type { OverlayRouteNode } from './OverlayRouteNode';
import type { RedMarkerState } from './RedMarkerState';
import type { SurfaceRect } from './SurfaceRect';
import type { TileBounds } from './TileBounds';
import type { TiledMap } from './TiledMap';

export type PngMapModel = {
  blueMarker: BlueMarkerState;
  bounds: TileBounds;
  map: TiledMap;
  routePath: OverlayRouteNode[];
  pathSegments: OverlayPathSegment[];
  png: {
    height: number;
    name: 'demo_1.png';
    width: number;
  };
  redMarker: RedMarkerState;
  roomLabels: OverlayRoomLabel[];
  routeNodes: OverlayRouteNode[];
  surface: SurfaceRect;
};
