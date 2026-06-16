import { ActorLayer, buildBobActorAtNode, routeNodeToPixels } from './actor_system/actorSystem';
import {
  CameraViewport,
  createInitialCameraState,
  centerCameraOnPoint,
  fitCameraToBounds,
  setCameraZoom,
  panCamera,
  zoomCamera,
} from './cameran_system/cameranSystem';
import { ArenaMapEngineView, ArenaMapView } from './map-controller';
import { extractMovementConstraintMapInput } from './mapEngineController';
import {
  getVisualBounds,
  normalizeMapSchema,
  orderVisualLayers,
} from './map_rendering_system/mapRenderingSystem';
import { createMovementConstraintProvider, updateMovementSystem } from './movement_system/indoorposition_engine';

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
const exactZoomCamera = setCameraZoom(zoomedCamera, 2);
const pannedCamera = panCamera(zoomedCamera, { x: 12, y: -8 });
const constraintInput = extractMovementConstraintMapInput({
  schemaVersion: 3,
  map: { id: 'constraint-test-map', tileSize: 16, width: 10, height: 10 },
  movement: {
    walkableAreas: [
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
      ],
    ],
    blockedAreas: [
      [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
    ],
    walls: [[{ x: 3, y: 0 }, { x: 3, y: 4 }]],
  },
});
const constraintProvider = createMovementConstraintProvider(constraintInput);
const movementUpdate = updateMovementSystem([], constraintInput, {
  position: { x: 0.5, y: 0.5 },
  headingRadians: 0,
});

void ActorLayer;
void ArenaMapEngineView;
void ArenaMapView;
void CameraViewport;
void constraintInput;
void constraintProvider;
void movementUpdate;
void orderedIds;
void bounds;
void bobPixels;
void initialCamera;
void exactZoomCamera;
void pannedCamera;
