import assert from 'node:assert/strict';
import test from 'node:test';

import { MovementRuntime, type MovementConstraintMapInput } from '../../mapEngine/movement_system';
import { extractMapCoordinateSystem } from '../../mapEngine/shared';
import {
  MovementSensorCollector,
  type IntervalScheduler,
} from '../movementSensorCollector';
import { MockMovementSensorAdapter } from './mockMovementSensorAdapter';

class ManualScheduler implements IntervalScheduler {
  callback: (() => void) | null = null;

  setInterval(callback: () => void): unknown {
    this.callback = callback;
    return 1;
  }

  clearInterval(): void {
    this.callback = null;
  }

  tick(): void {
    this.callback?.();
  }
}

const constraints: MovementConstraintMapInput = {
  coordinateSystem: extractMapCoordinateSystem({
    map: { tileSize: 16 },
    movement: { coordinateSystem: { unit: 'meter', pixelsPerMeter: 40, tilesPerMeter: 2.5 } },
  }),
  routeGraph: { nodes: [], edges: [] },
  walkableAreas: [],
  blockedAreas: [],
  walls: [],
  doors: [],
  corridors: [],
};

async function runStraightWalkScenario(): Promise<Array<{ x: number; y: number }>> {
  const scheduler = new ManualScheduler();
  const adapter = new MockMovementSensorAdapter({ scenarioId: 'straight-walk' });
  const runtime = new MovementRuntime({ x: 0, y: 0 });
  const positions: Array<{ x: number; y: number }> = [];
  const collector = new MovementSensorCollector(
    adapter,
    (batch) => {
      const result = runtime.process(batch, constraints);
      if (result) {
        positions.push(result.position);
      }
    },
    { batchIntervalMs: 250, scheduler },
  );

  await collector.start();

  for (let index = 0; index < 4; index += 1) {
    adapter.advanceOneBatch();
    scheduler.tick();
  }

  collector.stop();
  adapter.stop();
  return positions;
}

test('mock straight-walk uses the collector/runtime pipeline and stays deterministic', async () => {
  const firstRun = await runStraightWalkScenario();
  const secondRun = await runStraightWalkScenario();

  assert.deepEqual(firstRun, secondRun);
  assert.equal(firstRun.length, 4);
  assert.ok(firstRun.at(-1));
  assert.ok((firstRun.at(-1)?.x ?? 0) > 0);
  assert.ok(firstRun.every((position, index) => Number.isFinite(position.x) && Number.isFinite(position.y)));
  assert.notDeepEqual(firstRun[0], firstRun.at(-1));
});

test('stop halts mock playback emissions so the real sensor mode can cleanly take over', async () => {
  const adapter = new MockMovementSensorAdapter({
    scenarioId: 'straight-walk',
    batchIntervalMs: 20,
    batchLeadMs: 1,
  });
  let emissionCount = 0;
  const [subscription] = await adapter.subscribe(() => {
    emissionCount += 1;
  });

  adapter.start();
  await new Promise((resolve) => setTimeout(resolve, 10));
  adapter.stop();
  const emissionCountAfterStop = emissionCount;
  await new Promise((resolve) => setTimeout(resolve, 40));

  assert.ok(emissionCountAfterStop > 0);
  assert.equal(emissionCount, emissionCountAfterStop);
  subscription.remove();
});
