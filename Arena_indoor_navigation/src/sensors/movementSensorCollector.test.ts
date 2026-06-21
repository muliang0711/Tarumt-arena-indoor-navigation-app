import assert from 'node:assert/strict';
import test from 'node:test';

import type { RawSensorSample } from '../mapEngine/shared';
import {
  MovementSensorCollector,
  type MovementSensorCollectorDiagnostic,
  type IntervalScheduler,
  type MovementSensorAdapter,
} from './movementSensorCollector';

class ManualScheduler implements IntervalScheduler {
  callback: (() => void) | null = null;
  clearCount = 0;

  setInterval(callback: () => void): unknown {
    this.callback = callback;
    return 1;
  }

  clearInterval(): void {
    this.clearCount += 1;
    this.callback = null;
  }

  tick(): void {
    this.callback?.();
  }
}

test('creates subscriptions once, removes them on cleanup, and bounds pending samples', async () => {
  const scheduler = new ManualScheduler();
  const removed = [0, 0];
  let subscribeCount = 0;
  let emit: (sample: RawSensorSample) => void = () => {
    throw new Error('Sensor adapter was not subscribed.');
  };
  const adapter: MovementSensorAdapter = {
    async subscribe(onSample) {
      subscribeCount += 1;
      emit = onSample;
      return [
        { remove: () => { removed[0] += 1; } },
        { remove: () => { removed[1] += 1; } },
      ];
    },
  };
  const batches: Array<readonly RawSensorSample[]> = [];
  const collector = new MovementSensorCollector(
    adapter,
    (batch) => batches.push(batch),
    { capacity: 3, batchIntervalMs: 250, scheduler },
  );

  await collector.start();
  await collector.start();
  assert.equal(subscribeCount, 1);

  for (let index = 1; index <= 5; index += 1) {
    emit({
      id: `step-${index}`,
      kind: 'pedometer',
      timestamp: index,
      steps: index,
    });
  }
  assert.equal(collector.getBufferedSampleCount(), 3);

  scheduler.tick();
  assert.equal(batches.length, 2);
  assert.deepEqual(batches[0].map((item) => item.id), ['step-1']);
  assert.deepEqual(batches[1].map((item) => item.id), ['step-3', 'step-4', 'step-5']);
  assert.equal(collector.getBufferedSampleCount(), 0);

  collector.stop();
  assert.deepEqual(removed, [1, 1]);
  assert.equal(scheduler.clearCount, 1);
});

test('removes subscriptions that resolve after cleanup', async () => {
  let resolveSubscriptions: (value: readonly { remove(): void }[]) => void = () => {
    throw new Error('Subscription promise was not created.');
  };
  let removeCount = 0;
  const adapter: MovementSensorAdapter = {
    subscribe() {
      return new Promise((resolve) => {
        resolveSubscriptions = resolve;
      });
    },
  };
  const collector = new MovementSensorCollector(adapter, () => undefined);

  const startPromise = collector.start();
  collector.stop();
  resolveSubscriptions([{ remove: () => { removeCount += 1; } }]);
  await startPromise;

  assert.equal(removeCount, 1);
});

test('emits the first valid sample immediately and batches later samples on the interval', async () => {
  const scheduler = new ManualScheduler();
  let emit: (sample: RawSensorSample) => void = () => {
    throw new Error('Sensor adapter was not subscribed.');
  };
  const adapter: MovementSensorAdapter = {
    async subscribe(onSample) {
      emit = onSample;
      return [];
    },
  };
  const batches: Array<readonly RawSensorSample[]> = [];
  const collector = new MovementSensorCollector(
    adapter,
    (batch) => batches.push(batch),
    { batchIntervalMs: 250, scheduler },
  );

  await collector.start();
  emit({ id: 'first', kind: 'pedometer', timestamp: 100, steps: 1 });

  assert.deepEqual(batches.map((batch) => batch.map((item) => item.id)), [['first']]);

  emit({ id: 'second', kind: 'pedometer', timestamp: 200, steps: 2 });
  assert.equal(batches.length, 1);
  scheduler.tick();
  assert.deepEqual(batches[1].map((item) => item.id), ['second']);
  collector.stop();
});

test('reports collector startup and first-delivery timestamps', async () => {
  let emit: (sample: RawSensorSample) => void = () => {
    throw new Error('Sensor adapter was not subscribed.');
  };
  const adapter: MovementSensorAdapter = {
    async subscribe(onSample) {
      emit = onSample;
      return [];
    },
  };
  const diagnostics: MovementSensorCollectorDiagnostic[] = [];
  let now = 1000;
  const collector = new MovementSensorCollector(
    adapter,
    () => undefined,
    {
      now: () => now,
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    },
  );

  await collector.start();
  now = 1100;
  emit({ id: 'first', kind: 'pedometer', timestamp: 100, steps: 1 });
  const receivingDiagnostic = diagnostics.at(-1);
  collector.stop();

  assert.deepEqual(receivingDiagnostic, {
    status: 'receiving',
    startedAt: 1000,
    subscribedAt: 1000,
    firstSampleAt: 1100,
    firstBatchAt: 1100,
  });
});
