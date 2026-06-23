# Real Sensor Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the real-sensor startup dead window, update heading while stationary, and render sparse multi-step pedometer events as ordered continuous movement.

**Architecture:** Keep raw sensor acquisition, logical movement, and visual playback separate. The Expo adapter reports per-sensor lifecycle state and subscribes independent sensors concurrently; the movement engine updates heading independently from displacement and returns accepted step positions; pure visual helpers smooth heading and schedule accepted positions before `ArenaMapEngineView` renders them.

**Tech Stack:** TypeScript 5.9, React 19, React Native 0.81, Expo Sensors 15, Node test runner through `tsx --test`.

---

## File Structure

- Modify `src/sensors/movementSensorCollector.ts`: first-batch fast path and collector timing diagnostics.
- Modify `src/sensors/movementSensorCollector.test.ts`: collector red/green tests.
- Modify `src/sensors/expoMovementSensorAdapter.ts`: dependency injection, concurrent subscriptions, per-sensor lifecycle state.
- Modify `src/sensors/expoMovementSensorAdapter.test.ts`: adapter lifecycle and concurrency tests.
- Modify `src/sensors/useMovementSensors.ts`: expose aggregate real-sensor startup state.
- Modify `src/sensors/debugger/MovementSensorDevPanel.tsx`: display startup and per-sensor diagnostics.
- Modify `src/mapEngine/movement_system/indoorposition_engine.tsx`: independent heading state and accepted step positions.
- Modify `src/mapEngine/movement_system/movementRuntime.ts`: initialize/reset heading confidence.
- Modify `src/mapEngine/movementRuntime.test.ts`: stationary heading and accepted-position regression tests.
- Create `src/mapEngine/actor_system/actorHeadingSmoothing.ts`: shortest-angle interpolation.
- Create `src/mapEngine/actor_system/actorHeadingSmoothing.test.ts`: angle-wrap tests.
- Create `src/mapEngine/actor_system/actorMovementQueue.ts`: bounded timed visual target queue.
- Create `src/mapEngine/actor_system/actorMovementQueue.test.ts`: queue timing/backlog/reset tests.
- Modify `src/mapEngine/actor_system/actorSystem.ts`: export new helpers and types.
- Modify `src/mapEngine/ArenaMapEngineView.tsx`: consume live heading and queued accepted positions.
- Modify `src/mapEngine/debugger/movementDebugModel.ts`: expose heading confidence and accepted-step count.
- Modify `src/mapEngine/debugger/movementDebugModel.test.ts`: debugger contract assertions.

### Task 1: Deliver the first sensor batch immediately

**Files:**
- Modify: `src/sensors/movementSensorCollector.test.ts`
- Modify: `src/sensors/movementSensorCollector.ts`

- [ ] **Step 1: Write the failing first-batch test**

Add:

```ts
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
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npx tsx --test src/sensors/movementSensorCollector.test.ts
```

Expected: the new test fails because `batches.length` remains `0` until `scheduler.tick()`.

- [ ] **Step 3: Implement the first-batch fast path and timing diagnostics**

Add these exported contracts:

```ts
export type MovementSensorCollectorDiagnostic = {
  readonly status: 'idle' | 'starting' | 'subscribed' | 'receiving' | 'stopped' | 'error';
  readonly startedAt: number | null;
  readonly subscribedAt: number | null;
  readonly firstSampleAt: number | null;
  readonly firstBatchAt: number | null;
};
```

Extend options:

```ts
export type MovementSensorCollectorOptions = {
  capacity?: number;
  batchIntervalMs?: number;
  scheduler?: IntervalScheduler;
  now?: () => number;
  onDiagnostic?: (diagnostic: MovementSensorCollectorDiagnostic) => void;
};
```

Add collector fields:

```ts
private readonly now: () => number;
private readonly onDiagnostic?: (diagnostic: MovementSensorCollectorDiagnostic) => void;
private hasEmittedBatch = false;
private diagnostic: MovementSensorCollectorDiagnostic = {
  status: 'idle',
  startedAt: null,
  subscribedAt: null,
  firstSampleAt: null,
  firstBatchAt: null,
};
```

Update lifecycle methods so `start()` records `starting` and `subscribed`, `stop()` records `stopped`, caught subscription errors record `error`, and `enqueue()` executes:

```ts
if (this.diagnostic.firstSampleAt === null) {
  this.updateDiagnostic({
    status: 'receiving',
    firstSampleAt: this.now(),
  });
}
this.pendingSamples = [...this.pendingSamples, sample].slice(-this.capacity);
if (!this.hasEmittedBatch) {
  this.flush();
}
```

Update `flush()`:

```ts
this.hasEmittedBatch = true;
if (this.diagnostic.firstBatchAt === null) {
  this.updateDiagnostic({
    status: 'receiving',
    firstBatchAt: this.now(),
  });
}
```

Reset `hasEmittedBatch` and diagnostic timestamps when a new collector starts.

- [ ] **Step 4: Run collector tests and verify GREEN**

Run:

```powershell
npx tsx --test src/sensors/movementSensorCollector.test.ts
```

Expected: all collector tests pass.

- [ ] **Step 5: Commit the isolated collector change**

```powershell
git add src/sensors/movementSensorCollector.ts src/sensors/movementSensorCollector.test.ts
git commit -m "fix: emit first real sensor batch immediately"
```

### Task 2: Subscribe independent Expo sensors concurrently and preserve lifecycle failures

**Files:**
- Modify: `src/sensors/expoMovementSensorAdapter.test.ts`
- Modify: `src/sensors/expoMovementSensorAdapter.ts`

- [ ] **Step 1: Write failing adapter lifecycle tests**

Add fake permission-capable sensors with deferred `isAvailableAsync()` promises, then add:

```ts
test('starts independent device sensor availability checks concurrently', async () => {
  const accelerometer = new FakeDeviceSensor();
  const gyroscope = new FakeDeviceSensor();
  const magnetometer = new FakeDeviceSensor();
  const deviceMotion = new FakeDeviceSensor();
  accelerometer.deferAvailability();
  gyroscope.deferAvailability();

  const adapter = createExpoMovementSensorAdapter({
    Accelerometer: accelerometer,
    Gyroscope: gyroscope,
    Magnetometer: magnetometer,
    DeviceMotion: deviceMotion,
    Pedometer: new FakePedometerDependency(),
    now: () => 1000,
  });

  const subscriptionPromise = adapter.subscribe(() => undefined);
  await Promise.resolve();

  assert.equal(accelerometer.availabilityCheckCount, 1);
  assert.equal(gyroscope.availabilityCheckCount, 1);
  assert.equal(magnetometer.availabilityCheckCount, 1);
  assert.equal(deviceMotion.availabilityCheckCount, 1);

  accelerometer.resolveAvailability(true);
  gyroscope.resolveAvailability(true);
  await subscriptionPromise;
});
```

Add:

```ts
test('reports unavailable, permission-denied, error, and receiving states per sensor', async () => {
  const accelerometer = new FakeDeviceSensor();
  accelerometer.availability = false;
  const gyroscope = new FakeDeviceSensor();
  gyroscope.permission = { granted: false };
  gyroscope.requestPermission = { granted: false };
  const magnetometer = new FakeDeviceSensor();
  magnetometer.listenerError = new Error('listener failed');
  const deviceMotion = new FakeDeviceSensor();

  const adapter = createExpoMovementSensorAdapter({
    Accelerometer: accelerometer,
    Gyroscope: gyroscope,
    Magnetometer: magnetometer,
    DeviceMotion: deviceMotion,
    Pedometer: new FakePedometerDependency(),
    now: () => 2000,
  });

  await adapter.subscribe(() => undefined);
  deviceMotion.emit({ rotation: { alpha: 1, beta: 0, gamma: 0 }, interval: 100 });

  const state = adapter.getDiagnosticState();
  assert.equal(state.sensors.accelerometer.status, 'unavailable');
  assert.equal(state.sensors.gyroscope.status, 'permission-denied');
  assert.equal(state.sensors.magnetometer.status, 'error');
  assert.equal(state.sensors.deviceMotion.status, 'receiving');
  assert.equal(state.sensors.deviceMotion.firstSampleAt, 2000);
});
```

- [ ] **Step 2: Run adapter tests and verify RED**

Run:

```powershell
npx tsx --test src/sensors/expoMovementSensorAdapter.test.ts
```

Expected: compile/test failure because dependency injection and diagnostic APIs do not exist.

- [ ] **Step 3: Add adapter diagnostics and dependency injection**

Add:

```ts
export type RealDeviceSensorKind =
  | 'accelerometer'
  | 'gyroscope'
  | 'magnetometer'
  | 'deviceMotion';

export type RealDeviceSensorDiagnostic = {
  readonly status:
    | 'idle'
    | 'starting'
    | 'subscribed'
    | 'receiving'
    | 'permission-denied'
    | 'unavailable'
    | 'error'
    | 'stopped';
  readonly subscriptionAttemptAt: number | null;
  readonly subscriptionReadyAt: number | null;
  readonly firstSampleAt: number | null;
  readonly errorMessage: string | null;
};

export type ExpoMovementSensorDiagnosticState = {
  readonly sensors: Record<RealDeviceSensorKind, RealDeviceSensorDiagnostic>;
};
```

Extend `ExpoMovementSensorAdapter`:

```ts
getDiagnosticState(): ExpoMovementSensorDiagnosticState;
subscribeDiagnosticState(
  listener: (state: ExpoMovementSensorDiagnosticState) => void,
): () => void;
```

Change the factory signature:

```ts
export function createExpoMovementSensorAdapter(
  dependencies: ExpoMovementSensorDependencies = {
    Accelerometer,
    Gyroscope,
    Magnetometer,
    DeviceMotion,
    Pedometer,
    now: () => Date.now(),
  },
): ExpoMovementSensorAdapter
```

Make `subscribeDeviceSensor()` accept `kind`, `now`, and a diagnostic updater. Set explicit states at each boundary and record caught error messages.

Replace the sequential array of awaits with:

```ts
const subscriptions = await Promise.all([
  subscribeDeviceSensor(/* accelerometer */),
  subscribeDeviceSensor(/* gyroscope */),
  subscribeDeviceSensor(/* magnetometer */),
  subscribeDeviceSensor(/* deviceMotion */),
  subscribePedometer(realPedometerMonitor, onSample),
]);
```

Inside each listener, update that sensor to `receiving` before forwarding its first sample.

- [ ] **Step 4: Run adapter tests and verify GREEN**

Run:

```powershell
npx tsx --test src/sensors/expoMovementSensorAdapter.test.ts
```

Expected: all adapter and pedometer monitor tests pass.

- [ ] **Step 5: Commit adapter lifecycle changes**

```powershell
git add src/sensors/expoMovementSensorAdapter.ts src/sensors/expoMovementSensorAdapter.test.ts
git commit -m "fix: initialize real device sensors concurrently"
```

### Task 3: Expose startup state to the hook and developer UI

**Files:**
- Modify: `src/sensors/useMovementSensors.ts`
- Modify: `src/sensors/debugger/MovementSensorDevPanel.tsx`

- [ ] **Step 1: Extend the public sensor feed contracts**

Add to `MovementSensorDevControls`:

```ts
realSensors: {
  collector: MovementSensorCollectorDiagnostic;
  adapter: ExpoMovementSensorDiagnosticState;
};
```

Add to `UseMovementSensorsResult`:

```ts
status: 'starting' | 'receiving' | 'unavailable' | 'error';
```

Store collector and adapter diagnostics in state. Subscribe to adapter diagnostics once, and pass `onDiagnostic` when constructing the collector.

Derive status:

```ts
const realSensorStatus =
  mode === 'mock'
    ? 'receiving'
    : collectorDiagnostic.status === 'receiving'
      ? 'receiving'
      : Object.values(realAdapterDiagnostic.sensors).some(
            (sensor) => sensor.status === 'starting' || sensor.status === 'subscribed',
          )
        ? 'starting'
        : Object.values(realAdapterDiagnostic.sensors).some(
              (sensor) => sensor.status === 'error',
            )
          ? 'error'
          : 'unavailable';
```

- [ ] **Step 2: Render lifecycle data without changing navigation behavior**

In `MovementSensorDevPanel`, render:

```tsx
<Text style={styles.meta}>
  Pipeline {controls.realSensors.collector.status} · first sample{' '}
  {displayTimestamp(controls.realSensors.collector.firstSampleAt)} · first batch{' '}
  {displayTimestamp(controls.realSensors.collector.firstBatchAt)}
</Text>
{Object.entries(controls.realSensors.adapter.sensors).map(([kind, diagnostic]) => (
  <Text key={kind} style={styles.meta}>
    {kind} · {diagnostic.status} · ready {displayTimestamp(diagnostic.subscriptionReadyAt)}
    {' '}· first sample {displayTimestamp(diagnostic.firstSampleAt)}
    {diagnostic.errorMessage ? ` · ${diagnostic.errorMessage}` : ''}
  </Text>
))}
```

Keep the existing pedometer diagnostics and retry action.

- [ ] **Step 3: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: exit code `0`.

- [ ] **Step 4: Commit hook/UI diagnostics**

```powershell
git add src/sensors/useMovementSensors.ts src/sensors/debugger/MovementSensorDevPanel.tsx
git commit -m "feat: expose real sensor startup diagnostics"
```

### Task 4: Update heading without requiring displacement

**Files:**
- Modify: `src/mapEngine/movementRuntime.test.ts`
- Modify: `src/mapEngine/movement_system/indoorposition_engine.tsx`
- Modify: `src/mapEngine/movement_system/movementRuntime.ts`

- [ ] **Step 1: Strengthen the existing stationary-turn regression test**

Extend `repeated zero-step batches keep the actor at exactly the same position`:

```ts
assert.equal(first.headingRadians, 0);
assert.equal(second.headingRadians, Math.PI / 2);
assert.equal(third.headingRadians, Math.PI);
assert.equal(second.state.headingConfidence, 0.8);
assert.deepEqual(second.particleFilter.position, first.particleFilter.position);
```

Add:

```ts
test('heading confidence is independent from movement position confidence', () => {
  const runtime = new MovementRuntime({ x: 4.8, y: 5.2 });
  runtime.process([sample('baseline', 100, 0)], constraints);

  const turned = runtime.process([
    {
      id: 'turn',
      kind: 'deviceMotion',
      timestamp: 200,
      attitude: { alpha: Math.PI / 3, beta: 0, gamma: 0 },
    },
  ], constraints);

  assert.ok(turned);
  assert.equal(turned.state.headingConfidence, 0.8);
  assert.equal(turned.state.confidence, 0.8);
});
```

- [ ] **Step 2: Run movement tests and verify RED**

Run:

```powershell
npx tsx --test src/mapEngine/movementRuntime.test.ts
```

Expected: stationary heading assertions fail because the old particle-filter heading wins.

- [ ] **Step 3: Store heading state separately from filter displacement**

Extend state:

```ts
headingConfidence?: number;
headingTimestamp?: number;
```

When `step.stepDelta <= 0`, keep filter and position unchanged but return the latest valid heading separately. Build state with:

```ts
const hasFreshHeading = heading.source !== 'unknown';
const stateHeadingRadians = hasFreshHeading
  ? heading.radians
  : currentState.headingRadians;
const stateHeadingConfidence = hasFreshHeading
  ? heading.confidence
  : currentState.headingConfidence ?? 0;
```

For positive displacement, use the live `heading.radians` as state heading after the accepted movement calculation. Do not use `nextFilter.headingRadians` as the user-facing live heading.

Initialize/reset:

```ts
headingRadians: 0,
headingConfidence: 0,
headingTimestamp: 0,
```

- [ ] **Step 4: Run movement tests and verify GREEN**

Run:

```powershell
npx tsx --test src/mapEngine/movementRuntime.test.ts
```

Expected: all movement runtime tests pass, including stationary heading updates.

- [ ] **Step 5: Commit heading fix**

```powershell
git add src/mapEngine/movementRuntime.test.ts src/mapEngine/movement_system/indoorposition_engine.tsx src/mapEngine/movement_system/movementRuntime.ts
git commit -m "fix: update live heading while stationary"
```

### Task 5: Return accepted intermediate step positions

**Files:**
- Modify: `src/mapEngine/movementRuntime.test.ts`
- Modify: `src/mapEngine/movement_system/indoorposition_engine.tsx`

- [ ] **Step 1: Write failing accepted-position tests**

Add to the existing multi-step test:

```ts
assert.equal(jumped.acceptedStepPositions.length, 1);
assert.deepEqual(jumped.acceptedStepPositions[0], jumped.position);
```

Add an unconstrained multi-step test:

```ts
test('returns every accepted intermediate position for a multi-step increment', () => {
  const runtime = new MovementRuntime({ x: 4.8, y: 5.2 });
  runtime.process([
    sample('baseline', 50, 0),
    {
      id: 'baseline-heading',
      kind: 'deviceMotion',
      timestamp: 51,
      attitude: { alpha: 0, beta: 0, gamma: 0 },
    },
  ], constraints);

  const moved = runtime.process([
    sample('step-3', 100, 3),
    {
      id: 'heading',
      kind: 'deviceMotion',
      timestamp: 101,
      attitude: { alpha: 0, beta: 0, gamma: 0 },
    },
  ], constraints);

  assert.ok(moved);
  assert.equal(moved.acceptedStepPositions.length, 3);
  assert.ok(moved.acceptedStepPositions[0].x < moved.acceptedStepPositions[1].x);
  assert.ok(moved.acceptedStepPositions[1].x < moved.acceptedStepPositions[2].x);
  assert.deepEqual(moved.acceptedStepPositions[2], moved.position);
});
```

- [ ] **Step 2: Run movement tests and verify RED**

Run:

```powershell
npx tsx --test src/mapEngine/movementRuntime.test.ts
```

Expected: compile failure because `acceptedStepPositions` does not exist.

- [ ] **Step 3: Collect accepted positions in the movement engine**

Extend `MovementExecutionResult` and `MovementSystemResult`:

```ts
acceptedStepPositions: readonly WorldPosition[];
```

Inside `executeMovementIncrement()`:

```ts
const acceptedStepPositions: WorldPosition[] = [];
```

After each accepted step:

```ts
activePosition = candidatePosition;
acceptedStepPositions.push({ ...activePosition });
```

Return an empty array for zero-step updates and expose the final array from `updateMovementSystem()`.

- [ ] **Step 4: Run movement tests and verify GREEN**

Run:

```powershell
npx tsx --test src/mapEngine/movementRuntime.test.ts
```

Expected: all tests pass and rejected multi-step movement returns only accepted partial progress.

- [ ] **Step 5: Commit intermediate logical positions**

```powershell
git add src/mapEngine/movementRuntime.test.ts src/mapEngine/movement_system/indoorposition_engine.tsx
git commit -m "feat: expose accepted step positions"
```

### Task 6: Add pure heading smoothing and timed movement queue helpers

**Files:**
- Create: `src/mapEngine/actor_system/actorHeadingSmoothing.test.ts`
- Create: `src/mapEngine/actor_system/actorHeadingSmoothing.ts`
- Create: `src/mapEngine/actor_system/actorMovementQueue.test.ts`
- Create: `src/mapEngine/actor_system/actorMovementQueue.ts`
- Modify: `src/mapEngine/actor_system/actorSystem.ts`

- [ ] **Step 1: Write failing shortest-angle tests**

Create `actorHeadingSmoothing.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { shortestHeadingDelta, stepHeadingToward } from './actorHeadingSmoothing';

test('shortestHeadingDelta crosses the zero-degree boundary by the short path', () => {
  const delta = shortestHeadingDelta((359 * Math.PI) / 180, (1 * Math.PI) / 180);
  assert.ok(Math.abs(delta - (2 * Math.PI) / 180) < 0.000001);
});

test('stepHeadingToward limits rotation without taking the long path', () => {
  const next = stepHeadingToward(
    (359 * Math.PI) / 180,
    (1 * Math.PI) / 180,
    Math.PI / 180,
  );
  assert.ok(Math.abs(next) < 0.000001);
});
```

- [ ] **Step 2: Run heading helper test and verify RED**

Run:

```powershell
npx tsx --test src/mapEngine/actor_system/actorHeadingSmoothing.test.ts
```

Expected: module-not-found failure.

- [ ] **Step 3: Implement heading smoothing**

Create:

```ts
const FULL_TURN = Math.PI * 2;

export function normalizeHeading(radians: number): number {
  if (!Number.isFinite(radians)) {
    return 0;
  }
  const wrapped = radians % FULL_TURN;
  return wrapped >= 0 ? wrapped : wrapped + FULL_TURN;
}

export function shortestHeadingDelta(from: number, to: number): number {
  const delta = normalizeHeading(to) - normalizeHeading(from);
  return ((delta + Math.PI) % FULL_TURN + FULL_TURN) % FULL_TURN - Math.PI;
}

export function stepHeadingToward(
  current: number,
  target: number,
  maximumDelta: number,
): number {
  if (!Number.isFinite(maximumDelta) || maximumDelta <= 0) {
    return normalizeHeading(target);
  }
  const delta = shortestHeadingDelta(current, target);
  if (Math.abs(delta) <= maximumDelta) {
    return normalizeHeading(target);
  }
  return normalizeHeading(current + Math.sign(delta) * maximumDelta);
}
```

- [ ] **Step 4: Write failing queue tests**

Create `actorMovementQueue.test.ts` with:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendActorMovementTargets,
  consumeActorMovementTarget,
  createActorMovementQueue,
} from './actorMovementQueue';

test('queues accepted positions in order using cadence-derived duration', () => {
  const queue = appendActorMovementTargets(
    createActorMovementQueue(),
    [{ x: 1, y: 0 }, { x: 2, y: 0 }],
    { cadenceStepsPerMinute: 120, eventIntervalMs: 1000 },
  );

  assert.deepEqual(queue.targets.map((target) => target.position.x), [1, 2]);
  assert.deepEqual(queue.targets.map((target) => target.durationMs), [500, 500]);
});

test('caps stale backlog to the newest bounded targets', () => {
  const positions = Array.from({ length: 20 }, (_, index) => ({ x: index + 1, y: 0 }));
  const queue = appendActorMovementTargets(
    createActorMovementQueue(),
    positions,
    { cadenceStepsPerMinute: null, eventIntervalMs: null },
  );

  assert.ok(queue.targets.length <= 8);
  assert.deepEqual(queue.targets.at(-1)?.position, { x: 20, y: 0 });
});

test('consumes the next target and reset starts empty', () => {
  const queue = appendActorMovementTargets(
    createActorMovementQueue(),
    [{ x: 1, y: 0 }],
    { cadenceStepsPerMinute: null, eventIntervalMs: null },
  );
  const consumed = consumeActorMovementTarget(queue);

  assert.deepEqual(consumed.target?.position, { x: 1, y: 0 });
  assert.deepEqual(consumed.queue.targets, []);
  assert.deepEqual(createActorMovementQueue().targets, []);
});
```

- [ ] **Step 5: Run queue tests and verify RED**

Run:

```powershell
npx tsx --test src/mapEngine/actor_system/actorMovementQueue.test.ts
```

Expected: module-not-found failure.

- [ ] **Step 6: Implement the bounded queue**

Create contracts and functions:

```ts
import type { WorldPosition } from '../shared';

const DEFAULT_STEP_DURATION_MS = 450;
const MIN_STEP_DURATION_MS = 180;
const MAX_STEP_DURATION_MS = 900;
const MAX_QUEUED_TARGETS = 8;

export type ActorMovementTarget = {
  readonly position: WorldPosition;
  readonly durationMs: number;
};

export type ActorMovementQueue = {
  readonly targets: readonly ActorMovementTarget[];
};

export type ActorMovementTiming = {
  readonly cadenceStepsPerMinute: number | null;
  readonly eventIntervalMs: number | null;
};

export function createActorMovementQueue(): ActorMovementQueue {
  return { targets: [] };
}

function clampDuration(value: number): number {
  return Math.min(MAX_STEP_DURATION_MS, Math.max(MIN_STEP_DURATION_MS, value));
}

function resolveStepDuration(
  stepCount: number,
  timing: ActorMovementTiming,
): number {
  if (
    timing.cadenceStepsPerMinute !== null &&
    Number.isFinite(timing.cadenceStepsPerMinute) &&
    timing.cadenceStepsPerMinute > 0
  ) {
    return clampDuration(60000 / timing.cadenceStepsPerMinute);
  }
  if (
    timing.eventIntervalMs !== null &&
    Number.isFinite(timing.eventIntervalMs) &&
    timing.eventIntervalMs > 0 &&
    stepCount > 0
  ) {
    return clampDuration(timing.eventIntervalMs / stepCount);
  }
  return DEFAULT_STEP_DURATION_MS;
}

export function appendActorMovementTargets(
  queue: ActorMovementQueue,
  positions: readonly WorldPosition[],
  timing: ActorMovementTiming,
): ActorMovementQueue {
  const durationMs = resolveStepDuration(positions.length, timing);
  const appended = [
    ...queue.targets,
    ...positions
      .filter((position) => Number.isFinite(position.x) && Number.isFinite(position.y))
      .map((position) => ({ position: { ...position }, durationMs })),
  ];
  return { targets: appended.slice(-MAX_QUEUED_TARGETS) };
}

export function consumeActorMovementTarget(queue: ActorMovementQueue): {
  target: ActorMovementTarget | null;
  queue: ActorMovementQueue;
} {
  return {
    target: queue.targets[0] ?? null,
    queue: { targets: queue.targets.slice(1) },
  };
}
```

Export the helpers and types from `actorSystem.ts`.

- [ ] **Step 7: Run helper tests and verify GREEN**

Run:

```powershell
npx tsx --test src/mapEngine/actor_system/actorHeadingSmoothing.test.ts src/mapEngine/actor_system/actorMovementQueue.test.ts
```

Expected: all helper tests pass.

- [ ] **Step 8: Commit pure rendering helpers**

```powershell
git add src/mapEngine/actor_system/actorHeadingSmoothing.ts src/mapEngine/actor_system/actorHeadingSmoothing.test.ts src/mapEngine/actor_system/actorMovementQueue.ts src/mapEngine/actor_system/actorMovementQueue.test.ts src/mapEngine/actor_system/actorSystem.ts
git commit -m "feat: add timed actor movement helpers"
```

### Task 7: Integrate live heading and timed targets into the map view

**Files:**
- Modify: `src/mapEngine/ArenaMapEngineView.tsx`
- Modify: `src/mapEngine/debugger/movementDebugModel.ts`
- Modify: `src/mapEngine/debugger/movementDebugModel.test.ts`

- [ ] **Step 1: Add debugger contract assertions first**

Extend the debugger fixture state with:

```ts
headingConfidence: 0.8,
```

Assert:

```ts
assert.equal(snapshot.headingConfidence, 0.8);
```

Add to `MovementDebugSnapshot`:

```ts
headingConfidence: number | null;
acceptedStepPositionCount: number;
```

Pass the latest result count from `ArenaMapEngineView` into the snapshot builder.

- [ ] **Step 2: Run debugger tests and verify RED**

Run:

```powershell
npx tsx --test src/mapEngine/debugger/movementDebugModel.test.ts
```

Expected: compile/assertion failure for missing fields.

- [ ] **Step 3: Integrate queue state**

In `ArenaMapEngineView`, add refs/state:

```ts
const movementQueueRef = useRef(createActorMovementQueue());
const activeMovementTargetRef = useRef<ActorMovementTarget | null>(null);
const lastPedometerEventTimestampRef = useRef<number | null>(null);
const [latestAcceptedStepPositionCount, setLatestAcceptedStepPositionCount] = useState(0);
```

When `movementRuntime.process()` returns:

1. Update logical `actorPosition` immediately.
2. Read the latest pedometer sample's cadence and timestamp.
3. Compute event interval from `lastPedometerEventTimestampRef`.
4. Append `movementUpdate.acceptedStepPositions`.
5. Set the smoothing target to the first queued target instead of the final logical position.

When a target is reached, consume the next queue target. If no target remains, set the display position to the logical position only when the distance is below the existing snap threshold or the queue was truncated as stale.

In `applyNavigationReset()`, clear:

```ts
movementQueueRef.current = createActorMovementQueue();
activeMovementTargetRef.current = null;
lastPedometerEventTimestampRef.current = null;
```

- [ ] **Step 4: Integrate heading smoothing**

Add:

```ts
const HEADING_RENDER_SPEED_RADIANS_PER_SECOND = Math.PI * 4;
const [displayHeadingRadians, setDisplayHeadingRadians] = useState(
  movementRuntimeRef.current?.getState().headingRadians ?? 0,
);
const displayHeadingRef = useRef(displayHeadingRadians);
const headingFrameRef = useRef<number | null>(null);
```

On live heading changes, use `requestAnimationFrame` and:

```ts
const maximumDelta =
  (HEADING_RENDER_SPEED_RADIANS_PER_SECOND * elapsedMs) / 1000;
const nextHeading = stepHeadingToward(
  displayHeadingRef.current,
  movementState.headingRadians,
  maximumDelta,
);
```

Stop when `Math.abs(shortestHeadingDelta(nextHeading, target)) < 0.001`. Cancel the heading frame on unmount and reset.

Use:

```ts
const headingConfidence = movementState.headingConfidence ?? 0;
const headingRadians =
  headingConfidence >= 0.35
    ? displayHeadingRadians
    : directionToHeadingRadians(bobMotionState.direction);
```

Continue deriving Bob's sprite direction from visual position delta.

- [ ] **Step 5: Implement debugger fields and run focused tests**

Run:

```powershell
npx tsx --test src/mapEngine/debugger/movementDebugModel.test.ts src/mapEngine/actor_system/actorHeadingSmoothing.test.ts src/mapEngine/actor_system/actorMovementQueue.test.ts src/mapEngine/movementRuntime.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 6: Commit map integration**

```powershell
git add src/mapEngine/ArenaMapEngineView.tsx src/mapEngine/debugger/movementDebugModel.ts src/mapEngine/debugger/movementDebugModel.test.ts
git commit -m "feat: render live heading and queued steps"
```

### Task 8: Full verification and documentation update

**Files:**
- Modify: `docs/2026-06-21-real-sensor-followup-issues.md`

- [ ] **Step 1: Update issue status factually**

Change the document status to indicate implementation is complete but real-device validation remains required. For each issue, list the implemented mechanism and retain a separate “real-device verification pending” note.

- [ ] **Step 2: Run formatting safety check**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 3: Run the complete automated test suite**

Run:

```powershell
npm test
```

Expected: exit code `0`, zero failed tests.

- [ ] **Step 4: Run TypeScript verification**

Run:

```powershell
npm run typecheck
```

Expected: exit code `0`.

- [ ] **Step 5: Review the final diff and preserve unrelated work**

Run:

```powershell
git status --short
git diff --stat
git diff -- src/sensors src/mapEngine/movement_system src/mapEngine/actor_system src/mapEngine/ArenaMapEngineView.tsx src/mapEngine/debugger docs/2026-06-21-real-sensor-followup-issues.md
```

Confirm that existing unrelated UI edits remain intact and were not reverted.

- [ ] **Step 6: Commit verification documentation**

```powershell
git add docs/2026-06-21-real-sensor-followup-issues.md
git commit -m "docs: record real sensor runtime fixes"
```

- [ ] **Step 7: Real-device acceptance run**

On an Android or iOS device:

1. Switch from mock to real mode and record collector start, first sample, and first batch timestamps.
2. Stand still and rotate through at least 90 degrees; verify the heading indicator follows without taking a step.
3. Walk for at least 30 seconds; verify multi-step events animate in order without long catch-up lag.
4. Reset navigation while walking is stopped; verify no old queued movement plays afterward.
5. Deny motion permission once; verify the developer panel reports permission denial instead of an indefinite waiting state.

Record device model, OS, observed startup duration, and any remaining pedometer event burst sizes in the issue document.
