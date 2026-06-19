import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBobActorAtNode, routeNodeToPixels } from './actor_system/actorModel';
import { extractMovementConstraintMapInput } from './mapEngineController';
import { normalizeMapSchema } from './map_rendering_system/mapRendererModel';
import {
  extractMapCoordinateSystem,
  pixelsToWorldMeters,
  tilesToWorldMeters,
  worldMetersToPixels,
} from './shared/coordinateSystem';

function rawMap(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 3,
    map: { id: 'coordinate-test', tileSize: 16, width: 10, height: 10 },
    assets: { resourceRoot: 'resources', items: [] },
    layers: { visual: [] },
    movement: {
      coordinateSystem: {
        unit: 'meter',
        origin: 'top-left',
        pixelsPerMeter: 40,
        tilesPerMeter: 2.5,
        scale: 0.4,
      },
      bounds: { x: 0, y: 0, width: 4, height: 4 },
      walkableAreas: [[
        { x: 0.4, y: 0.4 },
        { x: 2, y: 0.4 },
        { x: 2, y: 2 },
      ]],
      blockedAreas: [],
      walls: [[{ x: 1, y: 0 }, { x: 1, y: 2 }]],
      doors: [],
      corridors: [],
      routeGraph: {
        nodes: [{ node_id: 'start', position: { x: 0.4, y: 0.4 } }],
        edges: [],
      },
    },
    ...overrides,
  };
}

test('converts 0.4 meter to 16 pixels and round-trips', () => {
  const coordinateSystem = extractMapCoordinateSystem(rawMap());
  const pixels = worldMetersToPixels({ x: 0.4, y: 0.4 }, coordinateSystem);

  assert.deepEqual(pixels, { x: 16, y: 16 });
  assert.deepEqual(pixelsToWorldMeters(pixels, coordinateSystem), { x: 0.4, y: 0.4 });
  assert.deepEqual(tilesToWorldMeters({ x: 1, y: 1 }, coordinateSystem), { x: 0.4, y: 0.4 });
});

test('rejects invalid, contradictory and unsupported coordinate metadata', () => {
  assert.throws(
    () => extractMapCoordinateSystem(rawMap({
      map: { id: 'bad', tileSize: 16, width: 10, height: 10 },
      movement: { coordinateSystem: { unit: 'meter', pixelsPerMeter: 0 } },
    })),
    /pixelsPerMeter must be finite and greater than zero/,
  );
  assert.throws(
    () => extractMapCoordinateSystem(rawMap({
      movement: {
        coordinateSystem: {
          unit: 'meter',
          pixelsPerMeter: 40,
          tilesPerMeter: 3,
        },
      },
    })),
    /pixelsPerMeter must equal tileSizePixels/,
  );
  assert.throws(
    () => extractMapCoordinateSystem(rawMap({
      movement: { coordinateSystem: { unit: 'foot', pixelsPerMeter: 40, tilesPerMeter: 2.5 } },
    })),
    /worldUnit must equal "meter"/,
  );
});

test('reports backward-compatible coordinate fallbacks explicitly', () => {
  const coordinateSystem = extractMapCoordinateSystem({
    map: { tileSize: 16 },
    movement: { coordinateSystem: {} },
  });

  assert.equal(coordinateSystem.pixelsPerMeter, 40);
  assert.equal(coordinateSystem.tilesPerMeter, 2.5);
  assert.ok(coordinateSystem.fallbacks.includes('worldUnit'));
  assert.ok(coordinateSystem.fallbacks.includes('origin'));
  assert.ok(coordinateSystem.fallbacks.includes('pixelsPerMeter'));
});

test('rendering and movement projections share equivalent coordinate metadata', () => {
  const source = rawMap();
  const coordinateSystem = extractMapCoordinateSystem(source);
  const renderProjection = normalizeMapSchema(source, coordinateSystem);
  const movementProjection = extractMovementConstraintMapInput(source, coordinateSystem);

  assert.strictEqual(renderProjection.coordinateSystem, movementProjection.coordinateSystem);
  assert.deepEqual(renderProjection.coordinateSystem, movementProjection.coordinateSystem);
  assert.deepEqual(renderProjection.movement.routeGraph.nodes[0].position, { x: 0.4, y: 0.4 });
  assert.deepEqual(movementProjection.routeGraph.nodes[0].position, { x: 0.4, y: 0.4 });
  assert.deepEqual(movementProjection.walkableAreas[0][0], { x: 0.4, y: 0.4 });
  assert.deepEqual(movementProjection.walls[0].from, { x: 1, y: 0 });

  const actor = buildBobActorAtNode(renderProjection, 'start');
  assert.deepEqual(actor.position, { x: 0.4, y: 0.4 });
  assert.deepEqual(routeNodeToPixels(actor, renderProjection.coordinateSystem), { x: 16, y: 16 });
});

test('rejects non-finite movement coordinates', () => {
  const source = rawMap();
  source.movement.routeGraph.nodes[0].position.x = Number.NaN;
  assert.throws(
    () => extractMovementConstraintMapInput(source),
    /routeGraph\.nodes\[0\]\.position must contain finite/,
  );
});
