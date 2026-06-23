import assert from 'node:assert/strict';
import test from 'node:test';

import { extractMapCoordinateSystem } from '../../shared';
import { createMovementConstraintProvider } from './movementConstraintProvider';
import type { MovementConstraintMapInput } from './movementConstraintTypes';

const coordinateSystem = extractMapCoordinateSystem({
  map: { tileSize: 16 },
  movement: { coordinateSystem: { unit: 'meter', pixelsPerMeter: 40, tilesPerMeter: 2.5 } },
});

function constraintInput(overrides: Partial<MovementConstraintMapInput>): MovementConstraintMapInput {
  return {
    coordinateSystem,
    routeGraph: { nodes: [], edges: [] },
    walkableAreas: [],
    blockedAreas: [],
    walls: [],
    doors: [],
    corridors: [],
    ...overrides,
  };
}

test('reports outside walkable area rejection', () => {
  const provider = createMovementConstraintProvider(
    constraintInput({
      walkableAreas: [[
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ]],
    }),
  );

  const analysis = provider.analyzeMove({ x: 0.5, y: 0.5 }, { x: 1.2, y: 0.5 });

  assert.equal(analysis.canMove, false);
  assert.equal(analysis.insideWalkableArea, false);
  assert.equal(analysis.insideBlockedArea, false);
  assert.equal(analysis.crossedWall, false);
  assert.equal(analysis.crossedBlockedArea, false);
  assert.deepEqual(analysis.rejectionReasons, ['outside-walkable-area']);
});

test('reports inside blocked area rejection', () => {
  const provider = createMovementConstraintProvider(
    constraintInput({
      walkableAreas: [[
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
      ]],
      blockedAreas: [[
        { x: 1, y: 1 },
        { x: 1.5, y: 1 },
        { x: 1.5, y: 1.5 },
        { x: 1, y: 1.5 },
      ]],
    }),
  );

  const analysis = provider.analyzeMove({ x: 0.5, y: 0.5 }, { x: 1.2, y: 1.2 });

  assert.equal(analysis.canMove, false);
  assert.equal(analysis.insideWalkableArea, true);
  assert.equal(analysis.insideBlockedArea, true);
  assert.equal(analysis.crossedWall, false);
  assert.equal(analysis.crossedBlockedArea, true);
  assert.deepEqual(analysis.rejectionReasons, ['inside-blocked-area', 'crossed-blocked-area']);
});

test('reports crossed wall rejection', () => {
  const provider = createMovementConstraintProvider(
    constraintInput({
      walkableAreas: [[
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
      ]],
      walls: [
        {
          from: { x: 1, y: 0 },
          to: { x: 1, y: 2 },
        },
      ],
    }),
  );

  const analysis = provider.analyzeMove({ x: 0.5, y: 0.5 }, { x: 1.5, y: 0.5 });

  assert.equal(analysis.canMove, false);
  assert.equal(analysis.insideWalkableArea, true);
  assert.equal(analysis.insideBlockedArea, false);
  assert.equal(analysis.crossedWall, true);
  assert.equal(analysis.crossedBlockedArea, false);
  assert.deepEqual(analysis.rejectionReasons, ['crossed-wall']);
});

test('reports crossed blocked polygon rejection when destination remains outside the blocked area', () => {
  const provider = createMovementConstraintProvider(
    constraintInput({
      walkableAreas: [[
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 2 },
        { x: 0, y: 2 },
      ]],
      blockedAreas: [[
        { x: 1, y: 0.2 },
        { x: 1.4, y: 0.2 },
        { x: 1.4, y: 0.8 },
        { x: 1, y: 0.8 },
      ]],
    }),
  );

  const analysis = provider.analyzeMove({ x: 0.5, y: 0.5 }, { x: 2, y: 0.5 });

  assert.equal(analysis.canMove, false);
  assert.equal(analysis.insideWalkableArea, true);
  assert.equal(analysis.insideBlockedArea, false);
  assert.equal(analysis.crossedWall, false);
  assert.equal(analysis.crossedBlockedArea, true);
  assert.deepEqual(analysis.rejectionReasons, ['crossed-blocked-area']);
});
