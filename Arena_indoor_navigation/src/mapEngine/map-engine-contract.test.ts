import { ActorLayer, buildBobActorAtNode, routeNodeToPixels } from './actor_system/actorSystem';
import {
  CameraViewport,
  createInitialCameraState,
  centerCameraOnPoint,
  fitCameraToBounds,
  panCamera,
  zoomCamera,
} from './cameran_system/cameranSystem';
import { ArenaMapEngineView, ArenaMapView } from './map-controller';
import {
  getVisualBounds,
  normalizeMapSchema,
  orderVisualLayers,
} from './map_rendering_system/mapRenderingSystem';

const parsed = normalizeMapSchema({
  schemaVersion: 3,
  map: { id: 'test-map', tileSize: 16, width: 70, height: 60 },
  assets: {
    resourceRoot: 'resources/serious_shit',
    items: [{ id: 'road_1', src: 'road_1.png', widthTiles: 2, heightTiles: 1 }],
  },
  layers: {
    visual: [
      { id: 'wall', assetId: 'wall_up', x: 1, y: 1 },
      { id: 'floor', assetId: 'walkable_road_clean', x: 1, y: 1 },
    ],
  },
  movement: {
    coordinateSystem: { pixelsPerMeter: 40 },
    routeGraph: {
      nodes: [{ node_id: 'node_1', position: { x: 4.8, y: 5.2 } }],
      edges: [],
    },
  },
});

const orderedIds: string[] = orderVisualLayers(parsed.visualLayers).map((layer) => layer.id);
const bounds = getVisualBounds(parsed);
const bob = buildBobActorAtNode(parsed, 'node_1');
const bobPixels = routeNodeToPixels(bob, parsed.movement.coordinateSystem.pixelsPerMeter);
const fittedCamera = fitCameraToBounds(bounds, { width: 360, height: 390 });
const initialCamera = createInitialCameraState(bounds, { width: 360, height: 390 });
const followedCamera = centerCameraOnPoint(fittedCamera, bobPixels, { width: 360, height: 390 });
const zoomedCamera = zoomCamera(followedCamera, 1.2);
const pannedCamera = panCamera(zoomedCamera, { x: 12, y: -8 });

void ActorLayer;
void ArenaMapEngineView;
void ArenaMapView;
void CameraViewport;
void orderedIds;
void bounds;
void bobPixels;
void initialCamera;
void pannedCamera;
