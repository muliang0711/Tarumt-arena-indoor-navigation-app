import type { TiledMap } from '../type';
import { DEMO_PNG_SIZE } from './demoMapConfig';
import { createBlueMarkerState, createRedMarkerState } from './markerModel';
import { getRoomLabels, getRouteNodes } from './objectOverlayModel';
import { createPathSegmentsFromPoints } from './pathSegmentModel';
import { createRoutePath } from './routePathModel';
import { calculateChunkTileBounds, createSurface } from './surfaceModel';
import { assertSupportedMap, getVisibleTileLayers } from './tiledMapLayers';

export function createPngMapModel(map: TiledMap) {
  assertSupportedMap(map);

  const bounds = calculateChunkTileBounds(getVisibleTileLayers(map));
  const surface = createSurface(bounds, map);

  if (
    surface.width !== DEMO_PNG_SIZE.width ||
    surface.height !== DEMO_PNG_SIZE.height
  ) {
    throw new Error(
      `demo_1.png is ${DEMO_PNG_SIZE.width}x${DEMO_PNG_SIZE.height}, but the TMJ bounds are ${surface.width}x${surface.height}.`,
    );
  }

  const routeNodes = getRouteNodes(map, surface);
  const blueMarker = createBlueMarkerState(routeNodes);
  const redMarker = createRedMarkerState(blueMarker);
  const routePath = createRoutePath(routeNodes);

  return {
    blueMarker,
    bounds,
    map,
    routePath,
    pathSegments: createPathSegmentsFromPoints(routePath),
    png: DEMO_PNG_SIZE,
    redMarker,
    roomLabels: getRoomLabels(map, surface),
    routeNodes,
    surface,
  };
}
