import assert from 'node:assert/strict';
import { test } from 'node:test';

import demoMap from '../../assets/maps/demo_1.tmj.json';
import {
  calculateChunkTileBounds,
  calculateRouteDistance,
  createBlueMarkerState,
  createPngMapModel,
  createRedMarkerState,
  createRemainingRouteSegments,
  createRoutePathSegments,
  createSurface,
  getRoomLabels,
  getRouteNodes,
  interpolateRoutePosition,
  snapPointToRoute,
  TEST_ROUTE_NODE_IDS,
  worldToScreenPoint,
} from './model';
import type { TiledMap } from './type';

const map = demoMap as TiledMap;

test('parses the demo TMJ as supported bounds metadata', () => {
  assert.equal(map.type, 'map');
  assert.equal(map.orientation, 'orthogonal');
  assert.equal(map.infinite, true);
  assert.equal(map.tilewidth, 16);
  assert.equal(map.tileheight, 16);
});

test('calculates chunk bounds and translated surface for the PNG map', () => {
  const layers = map.layers.filter((layer) => layer.type === 'tilelayer');
  const bounds = calculateChunkTileBounds(layers);
  const surface = createSurface(bounds, map);

  assert.deepEqual(bounds, {
    minX: -16,
    minY: 16,
    maxX: 80,
    maxY: 144,
    width: 96,
    height: 128,
  });
  assert.deepEqual(surface, {
    originX: -256,
    originY: 256,
    width: 1536,
    height: 2048,
  });
});

test('creates a PNG render model instead of a tile-sprite model', () => {
  const model = createPngMapModel(map);

  assert.deepEqual(model.png, {
    name: 'demo_1.png',
    width: 1536,
    height: 2048,
  });
  assert.equal(model.surface.width, model.png.width);
  assert.equal(model.surface.height, model.png.height);
  assert.equal('tiles' in model, false);
});

test('projects Tiled object coordinates using the negative chunk origin offset', () => {
  const model = createPngMapModel(map);

  assert.deepEqual(worldToScreenPoint({ x: -80, y: 904 }, model.surface), {
    tiledX: -80,
    tiledY: 904,
    screenX: 176,
    screenY: 648,
  });
});

test('returns room labels from object.name only', () => {
  const model = createPngMapModel(map);
  const labels = getRoomLabels(map, model.surface);

  assert.equal(labels.length, 13);
  assert.equal(labels.find((label) => label.id === 77)?.name, 'TA256');
  assert.equal(
    labels.some((label) => label.name === '你好，世界'),
    false,
  );
});

test('returns route nodes with node IDs only', () => {
  const model = createPngMapModel(map);
  const nodes = getRouteNodes(map, model.surface);

  assert.equal(nodes.length, 22);
  assert.deepEqual(nodes[0], {
    id: 50,
    nodeId: 'node-1',
    tiledX: -80,
    tiledY: 904,
    screenX: 176,
    screenY: 648,
    type: 'route-node',
  });
});

test('creates the configured EDGE-backed straight walk test route', () => {
  const model = createPngMapModel(map);
  const segments = createRoutePathSegments(model.routeNodes);

  assert.deepEqual([...TEST_ROUTE_NODE_IDS], [
    'node-21',
    'node-20',
    'node-19',
    'node-18',
    'node-17',
    'node-16',
    'node-12',
    'node-13',
    'node-14',
    'node-15',
    'node-2',
    'node-1',
  ]);
  assert.deepEqual(
    segments.map((segment) => `${segment.fromNodeId}->${segment.toNodeId}`),
    [
      'node-21->node-20',
      'node-20->node-19',
      'node-19->node-18',
      'node-18->node-17',
      'node-17->node-16',
      'node-16->node-12',
      'node-12->node-13',
      'node-13->node-14',
      'node-14->node-15',
      'node-15->node-2',
      'node-2->node-1',
    ],
  );
  assert.deepEqual(
    segments.map((segment) => ({
      x: segment.x,
      y: segment.y,
    })),
    [
      { x: 236, y: 648 },
      { x: 369, y: 648 },
      { x: 606, y: 648 },
      { x: 829, y: 648 },
      { x: 1048, y: 648 },
      { x: 1248, y: 648 },
      { x: 1248, y: 877 },
      { x: 829, y: 877 },
      { x: 606, y: 877 },
      { x: 369, y: 877 },
      { x: 176, y: 877 },
    ],
  );
});

test('keeps blue route marker and red debug marker as separate state', () => {
  const model = createPngMapModel(map);
  const blueMarker = createBlueMarkerState(model.routeNodes);
  const redMarker = createRedMarkerState(blueMarker);

  assert.deepEqual(blueMarker, {
    kind: 'blueMarker',
    routeNodeId: 'node-21',
    tiledX: -20,
    tiledY: 904,
    screenX: 236,
    screenY: 648,
  });
  assert.deepEqual(redMarker, {
    headingDegrees: 0,
    kind: 'redMarker',
    tiledX: 14,
    tiledY: 932,
    screenX: 270,
    screenY: 676,
  });
  assert.equal(model.blueMarker.routeNodeId, 'node-21');
  assert.equal(model.redMarker.kind, 'redMarker');
});

test('interpolates blue marker progress only along the fixed route polyline', () => {
  const model = createPngMapModel(map);
  const routeDistance = calculateRouteDistance(model.routePath);

  assert.equal(Math.round(routeDistance), 2542);
  assert.deepEqual(interpolateRoutePosition(model.routePath, 0), {
    distanceAlongRoute: 0,
    headingDegrees: 0,
    segmentIndex: 0,
    screenX: 236,
    screenY: 648,
    tiledX: -20,
    tiledY: 904,
  });
  assert.deepEqual(interpolateRoutePosition(model.routePath, 2542), {
    distanceAlongRoute: 2542,
    headingDegrees: -90,
    segmentIndex: 10,
    screenX: 176,
    screenY: 648,
    tiledX: -80,
    tiledY: 904,
  });
});

test('trims the remaining route from the blue marker progress point', () => {
  const model = createPngMapModel(map);

  const remainingAtStart = createRemainingRouteSegments(model.routePath, 0);
  assert.equal(remainingAtStart.length, 11);
  assert.equal(remainingAtStart[0]?.fromNodeId, 'point-0');

  assert.deepEqual(
    createRemainingRouteSegments(
      model.routePath,
      calculateRouteDistance(model.routePath),
    ),
    [],
  );
});

test('snaps free derived estimates to the fixed route for constrained blue marker movement', () => {
  const model = createPngMapModel(map);
  const snapOnFirstSegment = snapPointToRoute(model.routePath, {
    screenX: 500,
    screenY: 700,
  });
  const snapPastEnd = snapPointToRoute(model.routePath, {
    screenX: 1400,
    screenY: 760,
  });

  assert.equal(snapOnFirstSegment.position.segmentIndex, 1);
  assert.equal(snapOnFirstSegment.position.screenX, 500);
  assert.equal(snapOnFirstSegment.position.screenY, 648);
  assert.equal(Math.round(snapOnFirstSegment.driftPixels), 52);
  assert.equal(snapPastEnd.position.segmentIndex, 5);
  assert.equal(snapPastEnd.position.screenX, 1248);
  assert.equal(snapPastEnd.position.screenY, 760);
  assert.equal(Math.round(snapPastEnd.driftPixels), 152);
});
