# Map Navigation Debugger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Bob camera tracking an explicit user-controlled mode and add an isolated temporary debugger with live movement data, a visual Node 4 destination, and repeatable reset-to-Node-1 testing.

**Architecture:** Camera-mode policy stays in the camera subsystem and is independent of movement. Temporary diagnostics live behind `mapEngine/debugger/index.ts`; the map composition layer passes sensor and runtime state into the debugger and owns the reset callback. Node 4 is rendered from route-graph coordinates but never enters the movement pipeline.

**Tech Stack:** React 19, React Native 0.81, Expo 54, TypeScript 5.9, Node test runner through `tsx --test`.

Run `npm`, `npx`, and device commands from
`C:\Code\project\New folder\Arena_indoor_navigation`. Run the listed `git`
commands from `C:\Code\project\New folder`.

---

## File Structure

- Create `src/mapEngine/cameran_system/cameraFollowMode.ts`: pure camera-mode policy.
- Create `src/mapEngine/cameran_system/cameraFollowMode.test.ts`: regression tests for explicit mode switching.
- Modify `src/mapEngine/cameran_system/cameranSystem.ts`: export camera-mode helpers and types.
- Modify `src/mapEngine/ArenaMapEngineView.tsx`: separate camera fitting/following, integrate debugger, and own reset.
- Modify `src/mapEngine/architecture-boundaries.test.ts`: enforce manual camera mode and debugger public entry.
- Modify `src/mapEngine/movement_system/movementRuntime.ts`: establish the reset pedometer baseline.
- Modify `src/mapEngine/movementRuntime.test.ts`: cover reset without replay or accumulated-step jumps.
- Create `src/mapEngine/debugger/movementDebugModel.ts`: pure sensor/runtime summarization and destination lookup.
- Create `src/mapEngine/debugger/movementDebugModel.test.ts`: debug snapshot and destination tests.
- Create `src/mapEngine/debugger/MovementDebugPanel.tsx`: temporary on-screen diagnostics and reset control.
- Create `src/mapEngine/debugger/DestinationDebugLayer.tsx`: visual-only destination marker.
- Create `src/mapEngine/debugger/index.ts`: debugger public entry.
- Modify `src/mapEngine/README.md`: document manual follow behavior and removable diagnostics.

### Task 1: Make camera mode an explicit policy

**Files:**
- Create: `src/mapEngine/cameran_system/cameraFollowMode.test.ts`
- Create: `src/mapEngine/cameran_system/cameraFollowMode.ts`
- Modify: `src/mapEngine/cameran_system/cameranSystem.ts`

- [ ] **Step 1: Write the failing camera-mode test**

Create `src/mapEngine/cameran_system/cameraFollowMode.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isFollowingBob,
  toggleCameraFollowMode,
  type CameraFollowMode,
} from './cameraFollowMode';

test('camera follow mode changes only through an explicit toggle', () => {
  const initial: CameraFollowMode = 'following';
  const freeLook = toggleCameraFollowMode(initial);

  assert.equal(freeLook, 'free-look');
  assert.equal(isFollowingBob(freeLook), false);
  assert.equal(toggleCameraFollowMode(freeLook), 'following');
  assert.equal(isFollowingBob('following'), true);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npx tsx --test src/mapEngine/cameran_system/cameraFollowMode.test.ts
```

Expected: FAIL because `cameraFollowMode.ts` does not exist.

- [ ] **Step 3: Implement the minimal camera-mode policy**

Create `src/mapEngine/cameran_system/cameraFollowMode.ts`:

```ts
export type CameraFollowMode = 'following' | 'free-look';

export function toggleCameraFollowMode(mode: CameraFollowMode): CameraFollowMode {
  return mode === 'following' ? 'free-look' : 'following';
}

export function isFollowingBob(mode: CameraFollowMode): boolean {
  return mode === 'following';
}
```

Add to `src/mapEngine/cameran_system/cameranSystem.ts`:

```ts
export {
  isFollowingBob,
  toggleCameraFollowMode,
} from './cameraFollowMode';
export type { CameraFollowMode } from './cameraFollowMode';
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npx tsx --test src/mapEngine/cameran_system/cameraFollowMode.test.ts
```

Expected: PASS, 1 test and 0 failures.

- [ ] **Step 5: Commit the camera policy**

```powershell
git add Arena_indoor_navigation/src/mapEngine/cameran_system/cameraFollowMode.ts Arena_indoor_navigation/src/mapEngine/cameran_system/cameraFollowMode.test.ts Arena_indoor_navigation/src/mapEngine/cameran_system/cameranSystem.ts
git commit -m "fix: make camera follow mode explicit"
```

### Task 2: Preserve a pedometer baseline across navigation reset

**Files:**
- Modify: `src/mapEngine/movementRuntime.test.ts`
- Modify: `src/mapEngine/movement_system/movementRuntime.ts`

- [ ] **Step 1: Write the failing reset-baseline test**

Append to `src/mapEngine/movementRuntime.test.ts`:

```ts
test('reset uses the current pedometer count as the next movement baseline', () => {
  const receivedStates: MovementSystemState[] = [];
  const update: MovementUpdateFunction = (_samples, _constraints, currentState) => {
    receivedStates.push(currentState);
    return resultFor(currentState, receivedStates.length);
  };
  const runtime = new MovementRuntime({ x: 1, y: 1 }, update);

  runtime.reset({ x: 50, y: 60 }, [sample('reset-step', 100, 8)]);
  assert.equal(runtime.process([sample('next-step', 200, 9)], constraints)?.state.previousStepCount, 9);
  assert.equal(receivedStates[0].previousStepCount, 8);
  assert.deepEqual(receivedStates[0].position, { x: 50, y: 60 });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npx tsx --test src/mapEngine/movementRuntime.test.ts
```

Expected: FAIL because the state received after reset has `previousStepCount` equal to `undefined`, not `8`.

- [ ] **Step 3: Add latest-pedometer extraction and initialize the reset state**

In `src/mapEngine/movement_system/movementRuntime.ts`, add:

```ts
function latestPedometerCount(samples: readonly RawSensorSample[]): number | undefined {
  return samples
    .filter(
      (
        sample,
      ): sample is Extract<RawSensorSample, { kind: 'pedometer' }> =>
        sample.kind === 'pedometer' && Number.isFinite(sample.steps),
    )
    .sort((left, right) => left.timestamp - right.timestamp)
    .at(-1)?.steps;
}
```

Replace `reset` and `createInitialState` with:

```ts
reset(initialPosition: WorldPosition, samplesToIgnore: readonly RawSensorSample[] = []): void {
  this.state = this.createInitialState(
    initialPosition,
    latestPedometerCount(samplesToIgnore),
  );
  this.cursor = {
    latestTimestamp: Number.NEGATIVE_INFINITY,
    keysAtLatestTimestamp: new Set(),
  };
  advanceCursor(this.cursor, selectNewSamples(samplesToIgnore, this.cursor));
}

private createInitialState(
  position: WorldPosition,
  previousStepCount?: number,
): MovementSystemState {
  return {
    position: { ...position },
    headingRadians: 0,
    confidence: 0.8,
    previousStepCount,
  };
}
```

- [ ] **Step 4: Run movement runtime tests and verify GREEN**

Run:

```powershell
npx tsx --test src/mapEngine/movementRuntime.test.ts
```

Expected: PASS with 0 failures.

- [ ] **Step 5: Commit reset baseline behavior**

```powershell
git add Arena_indoor_navigation/src/mapEngine/movementRuntime.test.ts Arena_indoor_navigation/src/mapEngine/movement_system/movementRuntime.ts
git commit -m "fix: preserve pedometer baseline on navigation reset"
```

### Task 3: Build the pure movement-debug model

**Files:**
- Create: `src/mapEngine/debugger/movementDebugModel.test.ts`
- Create: `src/mapEngine/debugger/movementDebugModel.ts`

- [ ] **Step 1: Write failing sensor-summary and destination tests**

Create `src/mapEngine/debugger/movementDebugModel.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMovementDebugSnapshot,
  findDestinationNode,
} from './movementDebugModel';

test('summarizes live sensor kinds and movement state', () => {
  const snapshot = buildMovementDebugSnapshot({
    samples: [
      {
        id: 'accelerometer-1',
        kind: 'accelerometer',
        timestamp: 100,
        acceleration: { x: 1, y: 2, z: 3 },
      },
      {
        id: 'step-1',
        kind: 'pedometer',
        timestamp: 200,
        steps: 7,
      },
      {
        id: 'motion-1',
        kind: 'deviceMotion',
        timestamp: 300,
        attitude: { alpha: Math.PI / 2, beta: 0, gamma: 0 },
      },
    ],
    state: {
      position: { x: 4.8, y: 5.2 },
      headingRadians: Math.PI / 2,
      confidence: 0.75,
      previousStepCount: 7,
      particleFilter: {
        particles: [],
        generation: 3,
        position: { x: 4.8, y: 5.2 },
        headingRadians: Math.PI / 2,
        confidence: 0.75,
        bestParticle: null,
        totalWeight: 1,
      },
    },
    status: 'processed',
    destinationNodeId: 'node_4',
    destinationAvailable: true,
  });

  assert.equal(snapshot.totalSamples, 3);
  assert.equal(snapshot.counts.accelerometer, 1);
  assert.equal(snapshot.counts.pedometer, 1);
  assert.equal(snapshot.counts.deviceMotion, 1);
  assert.equal(snapshot.latestSampleKind, 'deviceMotion');
  assert.equal(snapshot.latestTimestamp, 300);
  assert.equal(snapshot.pedometerSteps, 7);
  assert.equal(snapshot.headingDegrees, 90);
  assert.equal(snapshot.confidence, 0.75);
  assert.equal(snapshot.particleGeneration, 3);
  assert.equal(snapshot.destinationLabel, 'Node 4');
});

test('reports unavailable data without inventing sensor values', () => {
  const snapshot = buildMovementDebugSnapshot({
    samples: [],
    state: {
      position: { x: 0, y: 0 },
      headingRadians: 0,
      confidence: 0.8,
    },
    status: 'waiting',
    destinationNodeId: 'node_4',
    destinationAvailable: false,
  });

  assert.equal(snapshot.latestSampleKind, null);
  assert.equal(snapshot.latestTimestamp, null);
  assert.equal(snapshot.pedometerSteps, null);
  assert.equal(snapshot.particleGeneration, null);
  assert.equal(snapshot.destinationLabel, 'unavailable');
});

test('finds Node 4 without modifying the route graph', () => {
  const routeGraph = {
    nodes: [
      { node_id: 'node_1', position: { x: 4.8, y: 5.2 } },
      { node_id: 'node_4', position: { x: 10.4, y: 4 } },
    ],
    edges: [{ from_node: 'node_1', to_node: 'node_4' }],
  };
  const before = structuredClone(routeGraph);

  assert.deepEqual(findDestinationNode(routeGraph, 'node_4'), routeGraph.nodes[1]);
  assert.deepEqual(routeGraph, before);
  assert.equal(findDestinationNode(routeGraph, 'missing'), null);
});
```

- [ ] **Step 2: Run the model tests and verify RED**

Run:

```powershell
npx tsx --test src/mapEngine/debugger/movementDebugModel.test.ts
```

Expected: FAIL because `movementDebugModel.ts` does not exist.

- [ ] **Step 3: Implement the pure debug model**

Create `src/mapEngine/debugger/movementDebugModel.ts`:

```ts
import type {
  MovementRouteGraph,
  RawSensorSample,
  RouteNode,
  SensorKind,
} from '../shared';
import type { MovementSystemState } from '../movement_system';

export type MovementProcessingStatus =
  | 'processed'
  | 'ignored'
  | 'reset'
  | 'waiting';

export type SensorKindCounts = Record<SensorKind, number>;

export type MovementDebugSnapshot = {
  totalSamples: number;
  counts: SensorKindCounts;
  latestSampleKind: SensorKind | null;
  latestTimestamp: number | null;
  pedometerSteps: number | null;
  status: MovementProcessingStatus;
  position: { x: number; y: number };
  headingDegrees: number;
  confidence: number | null;
  particleGeneration: number | null;
  destinationLabel: string;
};

type BuildMovementDebugSnapshotInput = {
  samples: readonly RawSensorSample[];
  state: MovementSystemState;
  status: MovementProcessingStatus;
  destinationNodeId: string;
  destinationAvailable: boolean;
};

const EMPTY_COUNTS: SensorKindCounts = {
  accelerometer: 0,
  gyroscope: 0,
  magnetometer: 0,
  pedometer: 0,
  deviceMotion: 0,
};

export function buildMovementDebugSnapshot({
  samples,
  state,
  status,
  destinationNodeId,
  destinationAvailable,
}: BuildMovementDebugSnapshotInput): MovementDebugSnapshot {
  const orderedSamples = [...samples].sort(
    (left, right) => left.timestamp - right.timestamp,
  );
  const latestSample = orderedSamples.at(-1) ?? null;
  const latestPedometer = orderedSamples
    .filter((sample) => sample.kind === 'pedometer')
    .at(-1);
  const counts = samples.reduce<SensorKindCounts>(
    (result, sample) => ({
      ...result,
      [sample.kind]: result[sample.kind] + 1,
    }),
    { ...EMPTY_COUNTS },
  );

  return {
    totalSamples: samples.length,
    counts,
    latestSampleKind: latestSample?.kind ?? null,
    latestTimestamp: latestSample?.timestamp ?? null,
    pedometerSteps: latestPedometer?.steps ?? null,
    status,
    position: { ...state.position },
    headingDegrees: Math.round((state.headingRadians * 180) / Math.PI),
    confidence: state.confidence ?? null,
    particleGeneration: state.particleFilter?.generation ?? null,
    destinationLabel: destinationAvailable
      ? destinationNodeId.replace(/^node_/, 'Node ')
      : 'unavailable',
  };
}

export function findDestinationNode(
  routeGraph: MovementRouteGraph,
  nodeId: string,
): RouteNode | null {
  return routeGraph.nodes.find(
    (node) => node.node_id === nodeId || node.id === nodeId,
  ) ?? null;
}
```

- [ ] **Step 4: Run the model tests and verify GREEN**

Run:

```powershell
npx tsx --test src/mapEngine/debugger/movementDebugModel.test.ts
```

Expected: PASS, 3 tests and 0 failures.

- [ ] **Step 5: Commit the debug model**

```powershell
git add Arena_indoor_navigation/src/mapEngine/debugger/movementDebugModel.ts Arena_indoor_navigation/src/mapEngine/debugger/movementDebugModel.test.ts
git commit -m "feat: add movement debug snapshot model"
```

### Task 4: Create the removable debugger UI

**Files:**
- Create: `src/mapEngine/debugger/MovementDebugPanel.tsx`
- Create: `src/mapEngine/debugger/DestinationDebugLayer.tsx`
- Create: `src/mapEngine/debugger/index.ts`
- Modify: `src/mapEngine/architecture-boundaries.test.ts`

- [ ] **Step 1: Add a failing debugger public-entry contract**

Add `existsSync` to the `node:fs` import in
`src/mapEngine/architecture-boundaries.test.ts`:

```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';
```

Append:

```ts
test('debugger exposes removable UI through one public entry', () => {
  const debuggerRoot = join(mapEngineRoot, 'debugger');
  const publicEntry = join(debuggerRoot, 'index.ts');

  assert.equal(existsSync(publicEntry), true);
  const source = readFileSync(publicEntry, 'utf8');
  assert.match(source, /MovementDebugPanel/);
  assert.match(source, /DestinationDebugLayer/);
  assert.match(source, /buildMovementDebugSnapshot/);
  assert.match(source, /findDestinationNode/);
});
```

Also append the boundary check:

```ts
test('map engine consumes debugger modules only through the debugger public entry', () => {
  const violations = sourceFiles(mapEngineRoot).flatMap((filePath) => {
    const normalized = filePath.replaceAll('\\', '/');
    if (normalized.includes('/debugger/')) {
      return [];
    }
    return importsFor(filePath)
      .filter((importedPath) => /debugger\/.+/.test(importedPath))
      .map((importedPath) => `${relative(mapEngineRoot, filePath)} -> ${importedPath}`);
  });

  assert.deepEqual(violations, []);
});
```

- [ ] **Step 2: Run architecture tests and verify RED**

Run:

```powershell
npx tsx --test src/mapEngine/architecture-boundaries.test.ts
```

Expected: FAIL at `existsSync(publicEntry)` because the debugger public entry does not exist.

- [ ] **Step 3: Create the destination marker**

Create `src/mapEngine/debugger/DestinationDebugLayer.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';

import type {
  Bounds,
  MapCoordinateSystem,
  RouteNode,
} from '../shared';
import { worldMetersToPixels } from '../shared';

type DestinationDebugLayerProps = {
  destination: RouteNode | null;
  bounds: Bounds;
  coordinateSystem: MapCoordinateSystem;
};

const MARKER_SIZE = 30;

export function DestinationDebugLayer({
  destination,
  bounds,
  coordinateSystem,
}: DestinationDebugLayerProps) {
  if (!destination) {
    return null;
  }

  const point = worldMetersToPixels(destination.position, coordinateSystem);
  return (
    <View
      pointerEvents="none"
      style={[
        styles.marker,
        {
          left: point.x - bounds.x - MARKER_SIZE / 2,
          top: point.y - bounds.y - MARKER_SIZE,
        },
      ]}
    >
      <Text style={styles.markerText}>4</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    position: 'absolute',
    zIndex: 19,
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: MARKER_SIZE / 2,
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: '#ff7417',
  },
  markerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
});
```

- [ ] **Step 4: Create the live debug panel**

Create `src/mapEngine/debugger/MovementDebugPanel.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from '../../components/theme';
import type { MovementDebugSnapshot } from './movementDebugModel';

type MovementDebugPanelProps = {
  snapshot: MovementDebugSnapshot;
  onReset: () => void;
};

function display(value: number | string | null, digits = 2): string {
  if (value === null) {
    return 'unavailable';
  }
  return typeof value === 'number' ? value.toFixed(digits) : value;
}

export function MovementDebugPanel({
  snapshot,
  onReset,
}: MovementDebugPanelProps) {
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>Movement debugger</Text>
        <Text style={styles.status}>{snapshot.status}</Text>
      </View>
      <Text style={styles.line}>
        Samples {snapshot.totalSamples} · latest {snapshot.latestSampleKind ?? 'none'}
      </Text>
      <Text style={styles.line}>
        A {snapshot.counts.accelerometer} · G {snapshot.counts.gyroscope} ·
        M {snapshot.counts.magnetometer} · DM {snapshot.counts.deviceMotion} ·
        P {snapshot.counts.pedometer}
      </Text>
      <Text style={styles.line}>
        Timestamp {display(snapshot.latestTimestamp, 0)} · steps {display(snapshot.pedometerSteps, 0)}
      </Text>
      <Text style={styles.line}>
        Position {display(snapshot.position.x)}, {display(snapshot.position.y)} m ·
        heading {display(snapshot.headingDegrees, 0)}°
      </Text>
      <Text style={styles.line}>
        Confidence {display(snapshot.confidence)} · generation {display(snapshot.particleGeneration, 0)}
      </Text>
      <View style={styles.footer}>
        <Text style={styles.destination}>Destination {snapshot.destinationLabel}</Text>
        <Pressable style={styles.resetButton} onPress={onReset}>
          <Text style={styles.resetText}>Reset navigation</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 10,
    padding: 12,
    gap: 3,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  status: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  line: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  footer: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  destination: {
    color: colors.orange,
    fontSize: 11,
    fontWeight: '900',
  },
  resetButton: {
    minHeight: 30,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.orange,
  },
  resetText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
});
```

- [ ] **Step 5: Create the debugger public entry**

Create `src/mapEngine/debugger/index.ts`:

```ts
export { DestinationDebugLayer } from './DestinationDebugLayer';
export { MovementDebugPanel } from './MovementDebugPanel';
export {
  buildMovementDebugSnapshot,
  findDestinationNode,
} from './movementDebugModel';
export type {
  MovementDebugSnapshot,
  MovementProcessingStatus,
} from './movementDebugModel';
```

- [ ] **Step 6: Run the debugger model, architecture tests, and type checking**

Run:

```powershell
npx tsx --test src/mapEngine/debugger/movementDebugModel.test.ts src/mapEngine/architecture-boundaries.test.ts
npm run typecheck
```

Expected: both test files PASS and type checking exits 0.

- [ ] **Step 7: Commit the debugger boundary and UI**

```powershell
git add Arena_indoor_navigation/src/mapEngine/debugger Arena_indoor_navigation/src/mapEngine/architecture-boundaries.test.ts
git commit -m "feat: add removable movement debugger UI"
```

### Task 5: Integrate manual camera mode, live diagnostics, destination, and reset

**Files:**
- Modify: `src/mapEngine/ArenaMapEngineView.tsx`
- Modify: `src/mapEngine/architecture-boundaries.test.ts`

- [ ] **Step 1: Replace the old architecture assertion with the failing manual-mode contract**

Replace `gesture ownership and follow-disable wiring remain present` in
`src/mapEngine/architecture-boundaries.test.ts` with:

```ts
test('gestures update the camera without owning follow mode', () => {
  const viewport = readFileSync(
    join(mapEngineRoot, 'cameran_system', 'CameraViewport.tsx'),
    'utf8',
  );
  const engine = readFileSync(
    join(mapEngineRoot, 'ArenaMapEngineView.tsx'),
    'utf8',
  );

  assert.match(viewport, /Gesture\.Pan\(\)/);
  assert.match(viewport, /Gesture\.Pinch\(\)/);
  assert.doesNotMatch(engine, /setIsFollowingBob/);
  assert.doesNotMatch(engine, /onGestureStart=/);
  assert.match(engine, /toggleCameraFollowMode/);
});
```

Run:

```powershell
npx tsx --test src/mapEngine/architecture-boundaries.test.ts
```

Expected: FAIL because `ArenaMapEngineView.tsx` still contains
`setIsFollowingBob`, passes `onGestureStart`, and does not use
`toggleCameraFollowMode`.

- [ ] **Step 2: Replace boolean follow state with explicit mode**

Update the camera imports in `ArenaMapEngineView.tsx`:

```ts
import {
  CameraState,
  CameraViewport,
  centerCameraOnPoint,
  createInitialCameraState,
  isFollowingBob,
  toggleCameraFollowMode,
  zoomCamera,
  type CameraFollowMode,
} from './cameran_system/cameranSystem';
```

Add debugger imports:

```ts
import {
  buildMovementDebugSnapshot,
  DestinationDebugLayer,
  findDestinationNode,
  MovementDebugPanel,
  type MovementProcessingStatus,
} from './debugger';
```

Replace:

```ts
const [isFollowingBob, setIsFollowingBob] = useState(true);
```

with:

```ts
const [cameraMode, setCameraMode] = useState<CameraFollowMode>('following');
const followsBob = isFollowingBob(cameraMode);
```

- [ ] **Step 3: Add destination and debug status state**

After `mapData` and `startingActor` are available, add:

```ts
const destinationNodeId = 'node_4';
const destinationNode = useMemo(
  () => findDestinationNode(mapData.movement.routeGraph, destinationNodeId),
  [mapData.movement.routeGraph],
);
const [processingStatus, setProcessingStatus] =
  useState<MovementProcessingStatus>('waiting');
```

Keep the existing persistent `MovementRuntime`. Derive the snapshot after movement state and destination are available:

```ts
const debugSnapshot = useMemo(
  () => buildMovementDebugSnapshot({
    samples: sensorSamples,
    state: movementRuntimeRef.current?.getState() ?? {
      position: actorPosition,
      headingRadians: 0,
      confidence: 0.8,
    },
    status: processingStatus,
    destinationNodeId,
    destinationAvailable: destinationNode !== null,
  }),
  [
    actorPosition,
    destinationNode,
    processingStatus,
    sensorSamples,
  ],
);
```

- [ ] **Step 4: Make runtime effects update diagnostic status**

Replace the map/start-node reset effect with:

```ts
useEffect(() => {
  movementRuntimeRef.current?.reset(startingActor.position, sensorSamples);
  setActorPosition(startingActor.position);
  setProcessingStatus('waiting');
}, [mapData, startingActor.position, startingNodeId]);
```

Replace the sensor-processing effect with:

```ts
useEffect(() => {
  const movementUpdate = movementRuntimeRef.current?.process(
    sensorSamples,
    constraintMapInput,
  );
  if (movementUpdate) {
    setActorPosition(movementUpdate.position);
    setProcessingStatus('processed');
    return;
  }
  setProcessingStatus(sensorSamples.length > 0 ? 'ignored' : 'waiting');
}, [constraintMapInput, sensorSamples]);
```

- [ ] **Step 5: Separate initial fitting from Bob-follow updates**

Replace the current camera effect with two effects:

```ts
useEffect(() => {
  if (viewportWidth > 0) {
    setCamera(createInitialCameraState(bounds, viewportSize));
  }
}, [bounds, viewportSize, viewportWidth]);

useEffect(() => {
  if (!followsBob || viewportWidth <= 0) {
    return;
  }
  setCamera((currentCamera) =>
    applyFollowTarget(currentCamera ?? initialCamera),
  );
}, [
  applyFollowTarget,
  followsBob,
  initialCamera,
  viewportWidth,
]);
```

Set:

```ts
const renderedCamera = camera ?? (
  followsBob ? applyFollowTarget(initialCamera) : initialCamera
);
```

Delete `handleGestureStart` completely. Gestures continue to call `handleCameraChange`, but they never change `cameraMode`.

- [ ] **Step 6: Update zoom and toggle handlers**

Replace `handleZoomButton` with:

```ts
function handleZoomButton(factor: number) {
  const focalPoint = {
    x: viewportSize.width / 2,
    y: viewportSize.height / 2,
  };
  setCamera((currentCamera) => {
    const zoomedCamera = zoomCamera(
      currentCamera ?? renderedCamera,
      factor,
      undefined,
      undefined,
      focalPoint,
    );
    return followsBob ? applyFollowTarget(zoomedCamera) : zoomedCamera;
  });
}
```

Replace `handleToggleFollowBob` with:

```ts
function handleToggleFollowBob() {
  setCameraMode((currentMode) => {
    const nextMode = toggleCameraFollowMode(currentMode);
    if (isFollowingBob(nextMode)) {
      setCamera((currentCamera) =>
        applyFollowTarget(currentCamera ?? renderedCamera),
      );
    }
    return nextMode;
  });
}
```

- [ ] **Step 7: Add reset behavior**

Add:

```ts
function handleResetNavigation() {
  movementRuntimeRef.current?.reset(startingActor.position, sensorSamples);
  setActorPosition(startingActor.position);
  setProcessingStatus('reset');
}
```

This preserves `cameraMode` and `destinationNodeId`. The follow effect recenters only if `followsBob` is true.

- [ ] **Step 8: Render destination and debugger**

Remove:

```tsx
onGestureStart={handleGestureStart}
```

Replace the map overlay with:

```tsx
renderOverlay={(layout) => (
  <>
    <DestinationDebugLayer
      destination={destinationNode}
      bounds={layout.bounds}
      coordinateSystem={mapData.coordinateSystem}
    />
    <ActorLayer
      actors={actors}
      layout={layout}
      coordinateSystem={mapData.coordinateSystem}
    />
  </>
)}
```

Update follow-button state and text:

```tsx
style={[styles.followButton, followsBob && styles.followButtonActive]}
```

```tsx
<Text style={[
  styles.followButtonText,
  followsBob && styles.followButtonTextActive,
]}>
  {followsBob ? 'Following Bob' : 'Free look'}
</Text>
```

Render the panel immediately after `</View>` for `styles.cameraControls`, still inside `styles.engine`:

```tsx
<MovementDebugPanel
  snapshot={debugSnapshot}
  onReset={handleResetNavigation}
/>
```

- [ ] **Step 9: Run focused tests and type checking**

Run:

```powershell
npx tsx --test src/mapEngine/cameran_system/cameraFollowMode.test.ts src/mapEngine/debugger/movementDebugModel.test.ts src/mapEngine/movementRuntime.test.ts src/mapEngine/architecture-boundaries.test.ts
npm run typecheck
```

Expected: all focused tests PASS and type checking exits 0.

- [ ] **Step 10: Commit integration**

```powershell
git add Arena_indoor_navigation/src/mapEngine/ArenaMapEngineView.tsx Arena_indoor_navigation/src/mapEngine/architecture-boundaries.test.ts Arena_indoor_navigation/src/mapEngine/debugger
git commit -m "feat: integrate navigation test debugger"
```

### Task 6: Document behavior and run full verification

**Files:**
- Modify: `src/mapEngine/README.md`

- [ ] **Step 1: Update map-engine documentation**

Add a `Temporary navigation debugger` section to `src/mapEngine/README.md`:

```md
## Temporary navigation debugger

`debugger/` contains removable testing UI and pure formatting helpers. It shows
the current sensor batch, movement runtime state, Node 4 as a visual-only
destination, and a reset control that returns Bob to Node 1.

Camera mode is an explicit user choice. Gestures never change `following` or
`free-look`; only the camera-mode button does. In free-look, Bob continues to
receive sensor-driven movement while the camera remains independent.

Node 4 is not passed into the movement system. The destination marker does not
snap Bob to a route or alter particle-filter scoring.
```

- [ ] **Step 2: Run the full automated test suite**

Run:

```powershell
npm test
```

Expected: all tests PASS with 0 failures.

- [ ] **Step 3: Run full TypeScript checking**

Run:

```powershell
npm run typecheck
```

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 4: Inspect the final diff**

Run from the repository root:

```powershell
git status --short
git diff --check
git diff --stat 30b9cc7..HEAD
```

Expected:

- only the planned map-engine, debugger, test, and documentation files are changed;
- `git diff --check` prints no whitespace errors;
- unrelated `Understand-Anything/` workspace content remains untouched.

- [ ] **Step 5: Perform device-level verification**

Run:

```powershell
npm run android
```

On a sensor-capable Android device:

1. Open the Map screen and confirm the panel reports changing timestamps and sensor counts.
2. Press `Following Bob` so it displays `Free look`.
3. Pan the map and walk for at least 30 seconds; confirm the button remains `Free look`.
4. Confirm Bob may move while the camera remains where the user placed it.
5. Confirm Node 4 remains marked and Bob is not pulled toward it.
6. Press `Reset navigation`; confirm Bob returns to Node 1 and status becomes `reset`.
7. Continue walking; confirm the next new pedometer count advances from the reset baseline rather than replaying all prior steps.
8. Press `Free look` to return to `Following Bob`; confirm the camera centers on Bob immediately.

- [ ] **Step 6: Commit documentation**

```powershell
git add Arena_indoor_navigation/src/mapEngine/README.md
git commit -m "docs: describe navigation debugger behavior"
```
