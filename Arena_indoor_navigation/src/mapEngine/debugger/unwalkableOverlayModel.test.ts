import assert from 'node:assert/strict';
import test from 'node:test';

import type { MovementConstraintMapInput } from '../shared';
import { buildUnwalkableOverlayModel } from './unwalkableOverlayModel';

const input: MovementConstraintMapInput = {
  coordinateSystem: {
    worldUnit: 'meter',
    origin: 'top-left',
    pixelsPerMeter: 40,
    tileSizePixels: 16,
    tilesPerMeter: 2.5,
    metersPerTile: 0.4,
    fallbacks: [],
  },
  routeGraph: { nodes: [], edges: [] },
  walkableAreas: [[
    { x: 0, y: 0 },
    { x: 0.8, y: 0 },
    { x: 0.8, y: 0.8 },
    { x: 0, y: 0.8 },
  ]],
  blockedAreas: [[
    { x: 0.4, y: 0 },
    { x: 0.8, y: 0 },
    { x: 0.8, y: 0.4 },
    { x: 0.4, y: 0.4 },
  ]],
  walls: [{ from: { x: 0, y: 0.4 }, to: { x: 0.8, y: 0.4 } }],
};

test('retains the same normalized geometry used by movement constraints', () => {
  const model = buildUnwalkableOverlayModel(input, {
    x: 0,
    y: 0,
    width: 1.2,
    height: 1.2,
  });

  assert.equal(model.walkableAreas, input.walkableAreas);
  assert.equal(model.blockedAreas, input.blockedAreas);
  assert.equal(model.walls, input.walls);
});

test('classifies outside and blocked tile centers through the constraint provider', () => {
  const model = buildUnwalkableOverlayModel(input, {
    x: 0,
    y: 0,
    width: 1.2,
    height: 1.2,
  });

  assert.equal(
    model.unwalkableCells.some((cell) => cell.x === 0.4 && cell.y === 0),
    true,
  );
  assert.equal(
    model.unwalkableCells.some((cell) => cell.x === 0.8 && cell.y === 0),
    true,
  );
  assert.equal(
    model.unwalkableCells.some((cell) => cell.x === 0 && cell.y === 0),
    false,
  );
  assert.equal(model.mergedRectangles.length < model.unwalkableCells.length, true);
});
