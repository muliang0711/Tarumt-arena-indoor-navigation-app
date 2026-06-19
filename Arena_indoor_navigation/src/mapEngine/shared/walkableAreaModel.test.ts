import assert from 'node:assert/strict';
import test from 'node:test';

import { extractMapCoordinateSystem } from './coordinateSystem';
import {
  extractTemporaryWalkableAreas,
  isTemporaryWalkableAssetId,
} from './walkableAreaModel';

const coordinateSystem = extractMapCoordinateSystem({
  map: { tileSize: 16 },
  movement: { coordinateSystem: { unit: 'meter', pixelsPerMeter: 40, tilesPerMeter: 2.5 } },
});

test('recognizes temporary floor assets as walkable', () => {
  assert.equal(isTemporaryWalkableAssetId('walkable_road_clean'), true);
  assert.equal(isTemporaryWalkableAssetId('road_2'), true);
  assert.equal(isTemporaryWalkableAssetId('wall_up'), false);
});

test('extracts one-tile walkable polygons from floor-like visual layers', () => {
  const polygons = extractTemporaryWalkableAreas(
    [
      { assetId: 'walkable_road_clean', x: 1, y: 1 },
      { assetId: 'road_2', x: 2, y: 1 },
      { assetId: 'wall_up', x: 4, y: 4 },
    ],
    coordinateSystem,
  );

  assert.equal(polygons.length, 2);
  assert.deepEqual(polygons[0], [
    { x: 0.4, y: 0.4 },
    { x: 0.8, y: 0.4 },
    { x: 0.8, y: 0.8 },
    { x: 0.4, y: 0.8 },
  ]);
});
