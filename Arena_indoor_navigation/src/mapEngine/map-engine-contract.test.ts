import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBobActorAtNode, routeNodeToPixels } from './actor_system/actorModel';
import {
  centerCameraOnPoint,
  createInitialCameraState,
  panCamera,
  setCameraZoom,
  zoomCamera,
} from './cameran_system/cameraModel';
import { extractMovementConstraintMapInput } from './mapEngineController';
import {
  getVisualBounds,
  normalizeMapSchema,
  orderVisualLayers,
} from './map_rendering_system/mapRendererModel';
import { createMovementConstraintProvider, updateMovementSystem } from './movement_system';

const rawMap = {
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
    coordinateSystem: {
      unit: 'meter',
      origin: 'top-left',
      pixelsPerMeter: 40,
      tilesPerMeter: 2.5,
      scale: 0.4,
    },
    routeGraph: {
      nodes: [{ node_id: 'node_1', position: { x: 4.8, y: 5.2 } }],
      edges: [],
    },
    bounds: { x: 0, y: 0, width: 28, height: 24 },
    walkableAreas: [],
    blockedAreas: [],
    walls: [],
  },
};

test('map, actor, movement and camera contracts compose in their intended units', () => {
  const parsed = normalizeMapSchema(rawMap);
  const orderedIds = orderVisualLayers(parsed.visualLayers).map((layer) => layer.id);
  const bounds = getVisualBounds(parsed);
  const bob = buildBobActorAtNode(parsed, 'node_1');
  const bobPixels = routeNodeToPixels(bob, parsed.coordinateSystem);
  const initialCamera = createInitialCameraState(bounds, { width: 360, height: 390 });
  const followedCamera = centerCameraOnPoint(initialCamera, bobPixels, { width: 360, height: 390 });
  const zoomedCamera = zoomCamera(followedCamera, 1.2);

  assert.deepEqual(orderedIds, ['floor', 'wall']);
  assert.deepEqual(bob.position, { x: 4.8, y: 5.2 });
  assert.deepEqual(bobPixels, { x: 192, y: 208 });
  assert.equal(setCameraZoom(zoomedCamera, 2).scale, 2);
  assert.equal(panCamera(zoomedCamera, { x: 12, y: -8 }).offsetX, zoomedCamera.offsetX + 12);
});

test('movement extraction produces usable meter-space constraints', () => {
  const constraintInput = extractMovementConstraintMapInput(rawMap);
  const constraintProvider = createMovementConstraintProvider(constraintInput);
  const movementUpdate = updateMovementSystem([], constraintInput, {
    position: { x: 0.5, y: 0.5 },
    headingRadians: 0,
  });

  assert.equal(constraintInput.coordinateSystem.worldUnit, 'meter');
  assert.deepEqual(constraintInput.routeGraph.nodes[0].position, { x: 4.8, y: 5.2 });
  assert.equal(constraintProvider.isWalkable({ x: 0.5, y: 0.5 }), true);
  assert.equal(Number.isFinite(movementUpdate.position.x), true);
  assert.equal(Number.isFinite(movementUpdate.position.y), true);
  assert.equal(constraintProvider.isWalkable(movementUpdate.position), true);
});
