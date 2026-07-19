import assert from 'node:assert/strict';
import { test } from 'node:test';

import demoMap from '../../assets/maps/demo_1.tmj.json';
import {
  calculateRouteDistance,
  createPngMapModel,
  interpolateRoutePosition,
} from '../tiled/model';
import type { TiledMap } from '../tiled/type';
import {
  createNavigationUiState,
  formatNavigationInstruction,
  getCurrentSegmentLabel,
  getNavigationInstruction,
} from './navigationUiModel';

const map = demoMap as TiledMap;

test('reports segment progress distance and ready status', () => {
  const model = createPngMapModel(map);
  const routePosition = interpolateRoutePosition(model.routePath, 506);
  const routeDistancePixels = calculateRouteDistance(model.routePath);

  const navigation = createNavigationUiState({
    distanceRemainingPixels: routeDistancePixels - 506,
    routeDistancePixels,
    routePath: model.routePath,
    routePosition,
    status: 'ready',
  });

  assert.equal(navigation.currentSegment, 'node-19 -> node-18');
  assert.equal(Math.round(navigation.progressPercent), 20);
  assert.equal(Math.round(navigation.distanceRemainingPixels), 2036);
  assert.equal(navigation.status, 'ready');
});

test('derives geometry instructions from the straight fixed route', () => {
  const model = createPngMapModel(map);

  assert.equal(
    getNavigationInstruction(model.routePath, 0, 'moving'),
    'straight',
  );
  assert.equal(
    getNavigationInstruction(model.routePath, 1, 'moving'),
    'straight',
  );
  assert.equal(
    getNavigationInstruction(model.routePath, 0, 'arrived'),
    'arrived',
  );
});

test('formats navigation instruction labels for the UI', () => {
  assert.equal(formatNavigationInstruction('straight'), 'Continue straight');
  assert.equal(formatNavigationInstruction('left'), 'Turn left');
  assert.equal(formatNavigationInstruction('right'), 'Turn right');
  assert.equal(formatNavigationInstruction('arrived'), 'Arrived');
});

test('returns arrived segment label when segment index is past the route', () => {
  const model = createPngMapModel(map);

  assert.equal(getCurrentSegmentLabel(model.routePath, 99), 'Arrived');
});
