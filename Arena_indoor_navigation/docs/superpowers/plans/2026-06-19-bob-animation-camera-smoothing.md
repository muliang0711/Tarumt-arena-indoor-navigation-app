# Bob Animation And Free-Look Camera Smoothing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Bob visibly animate from real sensor-driven movement and remove the laggy free-look drag behavior without changing the manual follow/free-look contract.

**Architecture:** Bob animation stays inside the actor subsystem: asset lookup, movement-direction inference, and sprite selection are isolated there, while `ArenaMapEngineView` only derives Bob's visible movement state from real position changes. Camera smoothing stays inside the camera subsystem by preserving the current commit-on-finalize contract, then preventing gesture-time JS churn and parent prop resync from fighting active free-look interaction.

**Tech Stack:** React 19, React Native 0.81, Expo 54, TypeScript 5.9, `tsx --test`, `react-native-gesture-handler`, React Native `Animated`

---

## File Structure

- Modify: `src/mapEngine/actor_system/actorAssetRegistry.ts` to expose Bob idle/run sprites from `src/storage/bob`.
- Modify: `src/mapEngine/actor_system/actorModel.ts` to add sprite-state helpers for direction and action.
- Create: `src/mapEngine/actor_system/actorModel.test.ts` for delta-to-direction and movement-state regression coverage.
- Modify: `src/mapEngine/actor_system/ActorLayer.tsx` to animate run frames and render directional idle/run sprites.
- Modify: `src/mapEngine/actor_system/actorSystem.ts` if new helpers need public export.
- Modify: `src/mapEngine/ArenaMapEngineView.tsx` to derive Bob visual state from real position changes.
- Modify: `src/mapEngine/architecture-boundaries.test.ts` to lock in the updated actor/camera contracts.
- Modify: `src/mapEngine/cameran_system/CameraViewport.tsx` to stop free-look gesture lag by preventing active-gesture prop resync and reducing JS-thread work.
- Create: `src/mapEngine/cameran_system/CameraViewport.test.ts` for pure contract checks around active gesture synchronization helpers.
- Modify: `src/mapEngine/README.md` to describe Bob animation and free-look camera drag behavior.

### Task 1: Add Bob directional sprite assets

**Files:**
- Modify: `src/mapEngine/actor_system/actorAssetRegistry.ts`
- Modify: `src/mapEngine/architecture-boundaries.test.ts`

- [ ] **Step 1: Write the failing asset-registry contract test**

Append to `src/mapEngine/architecture-boundaries.test.ts`:

```ts
test('bob actor assets expose directional idle and run frames from src/storage/bob', () => {
  const source = readFileSync(
    join(mapEngineRoot, 'actor_system', 'actorAssetRegistry.ts'),
    'utf8',
  );

  assert.match(source, /src\/storage\/bob|storage\/bob/);
  assert.match(source, /idle_down\.png/);
  assert.match(source, /idle_left\.png/);
  assert.match(source, /idle_right\.png/);
  assert.match(source, /idle_up\.png/);
  assert.match(source, /run_down_6\.png/);
  assert.match(source, /run_left_6\.png/);
  assert.match(source, /run_right_6\.png/);
  assert.match(source, /run_up_6\.png/);
});
```

- [ ] **Step 2: Run the architecture test and verify RED**

Run:

```powershell
npx tsx --test src/mapEngine/architecture-boundaries.test.ts
```

Expected: FAIL because `actorAssetRegistry.ts` still imports from `storage/actor-assets/bob` and exposes only `idleDown`.

- [ ] **Step 3: Implement the full Bob asset registry**

Replace `src/mapEngine/actor_system/actorAssetRegistry.ts` with:

```ts
import { ImageSourcePropType } from 'react-native';

export type ActorDirection = 'down' | 'left' | 'right' | 'up';
export type ActorAction = 'idle' | 'run';

type BobIdleAssets = Record<ActorDirection, ImageSourcePropType>;
type BobRunAssets = Record<ActorDirection, readonly ImageSourcePropType[]>;

export const bobIdleAssets: BobIdleAssets = {
  down: require('../../storage/bob/bob_stand/idle_down.png'),
  left: require('../../storage/bob/bob_stand/idle_left.png'),
  right: require('../../storage/bob/bob_stand/idle_right.png'),
  up: require('../../storage/bob/bob_stand/idle_up.png'),
};

export const bobRunAssets: BobRunAssets = {
  down: [
    require('../../storage/bob/bob_run/run_down_1.png'),
    require('../../storage/bob/bob_run/run_down_2.png'),
    require('../../storage/bob/bob_run/run_down_3.png'),
    require('../../storage/bob/bob_run/run_down_4.png'),
    require('../../storage/bob/bob_run/run_down_5.png'),
    require('../../storage/bob/bob_run/run_down_6.png'),
  ],
  left: [
    require('../../storage/bob/bob_run/run_left_1.png'),
    require('../../storage/bob/bob_run/run_left_2.png'),
    require('../../storage/bob/bob_run/run_left_3.png'),
    require('../../storage/bob/bob_run/run_left_4.png'),
    require('../../storage/bob/bob_run/run_left_5.png'),
    require('../../storage/bob/bob_run/run_left_6.png'),
  ],
  right: [
    require('../../storage/bob/bob_run/run_right_1.png'),
    require('../../storage/bob/bob_run/run_right_2.png'),
    require('../../storage/bob/bob_run/run_right_3.png'),
    require('../../storage/bob/bob_run/run_right_4.png'),
    require('../../storage/bob/bob_run/run_right_5.png'),
    require('../../storage/bob/bob_run/run_right_6.png'),
  ],
  up: [
    require('../../storage/bob/bob_run/run_up_1.png'),
    require('../../storage/bob/bob_run/run_up_2.png'),
    require('../../storage/bob/bob_run/run_up_3.png'),
    require('../../storage/bob/bob_run/run_up_4.png'),
    require('../../storage/bob/bob_run/run_up_5.png'),
    require('../../storage/bob/bob_run/run_up_6.png'),
  ],
};

export function bobSpriteFrameCount(direction: ActorDirection): number {
  return bobRunAssets[direction].length;
}
```

- [ ] **Step 4: Run the architecture test and verify GREEN**

Run:

```powershell
npx tsx --test src/mapEngine/architecture-boundaries.test.ts
```

Expected: PASS for the new asset-registry assertion.

- [ ] **Step 5: Commit the asset registry**

```powershell
git add Arena_indoor_navigation/src/mapEngine/actor_system/actorAssetRegistry.ts Arena_indoor_navigation/src/mapEngine/architecture-boundaries.test.ts
git commit -m "feat: add directional bob sprite assets"
```

### Task 2: Add Bob movement-direction and action helpers

**Files:**
- Create: `src/mapEngine/actor_system/actorModel.test.ts`
- Modify: `src/mapEngine/actor_system/actorModel.ts`
- Modify: `src/mapEngine/actor_system/actorSystem.ts`

- [ ] **Step 1: Write the failing actor-state tests**

Create `src/mapEngine/actor_system/actorModel.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBobActorAtNode,
  deriveActorMotionState,
  type Actor,
} from './actorModel';

test('derives Bob run direction from horizontal and vertical movement deltas', () => {
  const actor: Actor = {
    id: 'bob',
    name: 'Bob',
    nodeId: 'node_1',
    position: { x: 0, y: 0 },
    direction: 'down',
    action: 'idle',
  };

  assert.deepEqual(
    deriveActorMotionState(actor, { x: 1, y: 0 }),
    { direction: 'right', action: 'run' },
  );
  assert.deepEqual(
    deriveActorMotionState(actor, { x: -1, y: 0 }),
    { direction: 'left', action: 'run' },
  );
  assert.deepEqual(
    deriveActorMotionState(actor, { x: 0, y: -1 }),
    { direction: 'up', action: 'run' },
  );
  assert.deepEqual(
    deriveActorMotionState(actor, { x: 0, y: 1 }),
    { direction: 'down', action: 'run' },
  );
});

test('keeps Bob idle and facing the last direction when movement is below epsilon', () => {
  const actor: Actor = {
    id: 'bob',
    name: 'Bob',
    nodeId: 'node_1',
    position: { x: 0, y: 0 },
    direction: 'left',
    action: 'run',
  };

  assert.deepEqual(
    deriveActorMotionState(actor, { x: 0.0001, y: 0.0001 }),
    { direction: 'left', action: 'idle' },
  );
});

test('buildBobActorAtNode starts Bob facing down and idle', () => {
  const actor = buildBobActorAtNode(
    {
      movement: {
        routeGraph: {
          nodes: [{ node_id: 'node_1', position: { x: 4.8, y: 5.2 } }],
          edges: [],
        },
      },
    },
    'node_1',
  );

  assert.equal(actor.direction, 'down');
  assert.equal(actor.action, 'idle');
});
```

- [ ] **Step 2: Run the actor-model test and verify RED**

Run:

```powershell
npx tsx --test src/mapEngine/actor_system/actorModel.test.ts
```

Expected: FAIL because `deriveActorMotionState` does not exist.

- [ ] **Step 3: Implement the minimal actor motion helpers**

Update `src/mapEngine/actor_system/actorModel.ts` to include:

```ts
export type ActorDirection = 'down' | 'left' | 'right' | 'up';
export type ActorAction = 'idle' | 'run';

export type Actor = {
  id: string;
  name: string;
  nodeId: string;
  position: WorldPosition;
  direction: ActorDirection;
  action: ActorAction;
};

const MOVEMENT_EPSILON = 0.001;

export function deriveActorMotionState(
  actor: Pick<Actor, 'direction'>,
  delta: WorldPosition,
): Pick<Actor, 'direction' | 'action'> {
  const magnitude = Math.hypot(delta.x, delta.y);
  if (magnitude < MOVEMENT_EPSILON) {
    return {
      direction: actor.direction,
      action: 'idle',
    };
  }

  if (Math.abs(delta.x) > Math.abs(delta.y)) {
    return {
      direction: delta.x >= 0 ? 'right' : 'left',
      action: 'run',
    };
  }

  return {
    direction: delta.y >= 0 ? 'down' : 'up',
    action: 'run',
  };
}
```

Update `src/mapEngine/actor_system/actorSystem.ts`:

```ts
export {
  buildBobActorAtNode,
  deriveActorMotionState,
  routeNodeToPixels,
} from './actorModel';
```

- [ ] **Step 4: Run the actor-model test and verify GREEN**

Run:

```powershell
npx tsx --test src/mapEngine/actor_system/actorModel.test.ts
```

Expected: PASS with 3 tests and 0 failures.

- [ ] **Step 5: Commit actor motion helpers**

```powershell
git add Arena_indoor_navigation/src/mapEngine/actor_system/actorModel.ts Arena_indoor_navigation/src/mapEngine/actor_system/actorModel.test.ts Arena_indoor_navigation/src/mapEngine/actor_system/actorSystem.ts
git commit -m "feat: derive bob motion state from movement"
```

### Task 3: Animate Bob in the actor layer

**Files:**
- Modify: `src/mapEngine/actor_system/ActorLayer.tsx`
- Modify: `src/mapEngine/architecture-boundaries.test.ts`

- [ ] **Step 1: Write the failing actor-layer rendering contract**

Append to `src/mapEngine/architecture-boundaries.test.ts`:

```ts
test('actor layer renders directional sprites instead of a hardcoded idle frame', () => {
  const source = readFileSync(
    join(mapEngineRoot, 'actor_system', 'ActorLayer.tsx'),
    'utf8',
  );

  assert.doesNotMatch(source, /bobActorAssets\.idleDown/);
  assert.match(source, /bobIdleAssets/);
  assert.match(source, /bobRunAssets/);
  assert.match(source, /setInterval|setTimeout/);
});
```

- [ ] **Step 2: Run the architecture test and verify RED**

Run:

```powershell
npx tsx --test src/mapEngine/architecture-boundaries.test.ts
```

Expected: FAIL because `ActorLayer.tsx` still hardcodes `bobActorAssets.idleDown`.

- [ ] **Step 3: Implement sprite animation in the actor layer**

Replace `src/mapEngine/actor_system/ActorLayer.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';

import type { Bounds, MapCoordinateSystem } from '../shared';
import { bobIdleAssets, bobRunAssets } from './actorAssetRegistry';
import { Actor, routeNodeToPixels } from './actorModel';

type ActorLayerLayout = {
  bounds: Bounds;
};

type ActorLayerProps = {
  actors: Actor[];
  layout: ActorLayerLayout;
  coordinateSystem: MapCoordinateSystem;
};

const BOB_SIZE = 32;
const RUN_FRAME_MS = 110;

export function ActorLayer({ actors, layout, coordinateSystem }: ActorLayerProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const runningActor = actors.find((actor) => actor.action === 'run') ?? null;

  useEffect(() => {
    if (!runningActor) {
      setFrameIndex(0);
      return;
    }

    const frameCount = bobRunAssets[runningActor.direction].length;
    const timer = setInterval(() => {
      setFrameIndex((current) => (current + 1) % frameCount);
    }, RUN_FRAME_MS);

    return () => clearInterval(timer);
  }, [runningActor?.direction, runningActor]);

  return (
    <>
      {actors.map((actor) => {
        const point = routeNodeToPixels(actor, coordinateSystem);
        const source =
          actor.action === 'run'
            ? bobRunAssets[actor.direction][frameIndex % bobRunAssets[actor.direction].length]
            : bobIdleAssets[actor.direction];

        return (
          <Image
            key={actor.id}
            source={source}
            resizeMode="contain"
            style={[
              styles.actor,
              {
                left: point.x - layout.bounds.x - BOB_SIZE / 2,
                top: point.y - layout.bounds.y - BOB_SIZE,
                width: BOB_SIZE,
                height: BOB_SIZE,
              },
            ]}
          />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  actor: {
    position: 'absolute',
    zIndex: 20,
  },
});
```

- [ ] **Step 4: Run the architecture test and verify GREEN**

Run:

```powershell
npx tsx --test src/mapEngine/architecture-boundaries.test.ts
```

Expected: PASS for the actor-layer rendering contract.

- [ ] **Step 5: Commit the animated actor layer**

```powershell
git add Arena_indoor_navigation/src/mapEngine/actor_system/ActorLayer.tsx Arena_indoor_navigation/src/mapEngine/architecture-boundaries.test.ts
git commit -m "feat: animate bob run sprites"
```

### Task 4: Drive Bob animation from real movement in the map engine

**Files:**
- Modify: `src/mapEngine/ArenaMapEngineView.tsx`

- [ ] **Step 1: Write the failing integration contract**

Append to `src/mapEngine/architecture-boundaries.test.ts`:

```ts
test('map engine derives Bob motion state from position changes', () => {
  const source = readFileSync(
    join(mapEngineRoot, 'ArenaMapEngineView.tsx'),
    'utf8',
  );

  assert.match(source, /deriveActorMotionState/);
  assert.match(source, /previousActorPosition|lastActorPosition|previousPosition/);
  assert.match(source, /action:\s*bobMotionState\.action|direction:\s*bobMotionState\.direction/);
});
```

- [ ] **Step 2: Run the architecture test and verify RED**

Run:

```powershell
npx tsx --test src/mapEngine/architecture-boundaries.test.ts
```

Expected: FAIL because `ArenaMapEngineView.tsx` does not derive visual actor state from position delta yet.

- [ ] **Step 3: Implement Bob motion-state derivation**

Update the actor imports in `src/mapEngine/ArenaMapEngineView.tsx`:

```ts
import {
  ActorLayer,
  buildBobActorAtNode,
  deriveActorMotionState,
  routeNodeToPixels,
} from './actor_system/actorSystem';
```

Add previous-position tracking and Bob motion-state derivation:

```ts
const previousActorPositionRef = useRef(startingActor.position);

useEffect(() => {
  previousActorPositionRef.current = startingActor.position;
}, [startingActor.position]);

useEffect(() => {
  if (movementUpdate) {
    previousActorPositionRef.current = actorPosition;
    setActorPosition(movementUpdate.position);
    setProcessingStatus('processed');
    return;
  }
```

Then replace the `actors` memo with:

```ts
const bobMotionState = useMemo(
  () =>
    deriveActorMotionState(startingActor, {
      x: actorPosition.x - previousActorPositionRef.current.x,
      y: actorPosition.y - previousActorPositionRef.current.y,
    }),
  [actorPosition, startingActor],
);

const actors = useMemo(
  () => [
    {
      ...startingActor,
      position: actorPosition,
      direction: bobMotionState.direction,
      action: bobMotionState.action,
    },
  ],
  [actorPosition, bobMotionState, startingActor],
);
```

Also update reset paths so `previousActorPositionRef.current = startingActor.position` whenever navigation resets.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```powershell
npx tsx --test src/mapEngine/actor_system/actorModel.test.ts src/mapEngine/architecture-boundaries.test.ts
```

Expected: PASS with 0 failures.

- [ ] **Step 5: Commit Bob movement integration**

```powershell
git add Arena_indoor_navigation/src/mapEngine/ArenaMapEngineView.tsx Arena_indoor_navigation/src/mapEngine/architecture-boundaries.test.ts
git commit -m "feat: drive bob animation from movement updates"
```

### Task 5: Fix free-look camera drag lag at the viewport boundary

**Files:**
- Create: `src/mapEngine/cameran_system/CameraViewport.test.ts`
- Modify: `src/mapEngine/cameran_system/CameraViewport.tsx`
- Modify: `src/mapEngine/architecture-boundaries.test.ts`

- [ ] **Step 1: Write the failing viewport helper test**

Create `src/mapEngine/cameran_system/CameraViewport.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  shouldSyncCameraFromProps,
  type CameraInteractionState,
} from './CameraViewport';

test('does not sync parent camera props while a gesture is active', () => {
  const active: CameraInteractionState = { isGestureActive: true };
  const idle: CameraInteractionState = { isGestureActive: false };

  assert.equal(shouldSyncCameraFromProps(active), false);
  assert.equal(shouldSyncCameraFromProps(idle), true);
});
```

- [ ] **Step 2: Run the viewport test and verify RED**

Run:

```powershell
npx tsx --test src/mapEngine/cameran_system/CameraViewport.test.ts
```

Expected: FAIL because the helper export does not exist.

- [ ] **Step 3: Add the active-gesture sync guard and reduce gesture churn**

Update `src/mapEngine/cameran_system/CameraViewport.tsx`:

```tsx
export type CameraInteractionState = {
  isGestureActive: boolean;
};

export function shouldSyncCameraFromProps(
  interactionState: CameraInteractionState,
): boolean {
  return !interactionState.isGestureActive;
}
```

Add refs:

```tsx
  const interactionState = useRef<CameraInteractionState>({
    isGestureActive: false,
  });
```

Guard the prop-sync effect:

```tsx
  useEffect(() => {
    if (!shouldSyncCameraFromProps(interactionState.current)) {
      return;
    }
    const nextCamera = {
      ...camera,
      scale: clampZoom(camera.scale),
    };
    cameraRef.current = nextCamera;
    translateX.setValue(nextCamera.offsetX);
    translateY.setValue(nextCamera.offsetY);
    scale.setValue(nextCamera.scale);
  }, [camera, scale, translateX, translateY]);
```

In pan and pinch gestures, mark active state and avoid spreading `cameraRef.current` unnecessarily:

```tsx
      .onBegin(() => {
        interactionState.current.isGestureActive = true;
        panStart.current = {
          x: cameraRef.current.offsetX,
          y: cameraRef.current.offsetY,
        };
      })
```

```tsx
        updateCamera({
          scale: cameraRef.current.scale,
          offsetX: panStart.current.x + event.translationX,
          offsetY: panStart.current.y + event.translationY,
        });
```

In `commitCamera`:

```tsx
    function commitCamera() {
      interactionState.current.isGestureActive = false;
      onCameraChange?.(cameraRef.current);
    }
```

Also remove the unused `onGestureStart` prop from the type and component signature because manual follow/free-look no longer needs it.

- [ ] **Step 4: Lock the updated contract in the architecture test**

Replace the existing gesture assertion block in `src/mapEngine/architecture-boundaries.test.ts` with:

```ts
test('camera viewport keeps gesture updates local and commits camera state after interaction', () => {
  const viewport = readFileSync(
    join(mapEngineRoot, 'cameran_system', 'CameraViewport.tsx'),
    'utf8',
  );

  assert.match(viewport, /shouldSyncCameraFromProps/);
  assert.match(viewport, /isGestureActive/);
  assert.doesNotMatch(viewport, /onGestureStart/);
  assert.match(viewport, /onFinalize\(commitCamera\)/);
});
```

- [ ] **Step 5: Run viewport and architecture tests and verify GREEN**

Run:

```powershell
npx tsx --test src/mapEngine/cameran_system/CameraViewport.test.ts src/mapEngine/architecture-boundaries.test.ts
```

Expected: PASS with 0 failures.

- [ ] **Step 6: Commit the free-look camera smoothing fix**

```powershell
git add Arena_indoor_navigation/src/mapEngine/cameran_system/CameraViewport.tsx Arena_indoor_navigation/src/mapEngine/cameran_system/CameraViewport.test.ts Arena_indoor_navigation/src/mapEngine/architecture-boundaries.test.ts
git commit -m "fix: smooth free-look camera dragging"
```

### Task 6: Document and verify the combined behavior

**Files:**
- Modify: `src/mapEngine/README.md`

- [ ] **Step 1: Update map-engine documentation**

Add to `src/mapEngine/README.md` under the temporary debugger section:

```md
Bob rendering now uses directional idle and run sprites from `src/storage/bob`.
Visible animation is driven by real map-position changes, not by a fake local
debug loop.

Free-look drag keeps the manual camera-mode contract and commits camera state at
gesture end, while active gestures ignore parent camera prop resync to reduce
drag lag.
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

Expected: exit code 0.

- [ ] **Step 4: Inspect diff hygiene**

Run from repository root:

```powershell
git status --short
git diff --check
```

Expected:

- only the planned actor, camera, test, and documentation files are changed;
- `git diff --check` prints no whitespace errors;
- untracked Bob assets under `Arena_indoor_navigation/src/storage/bob/` and unrelated `Understand-Anything/` remain untouched.

- [ ] **Step 5: Manual device verification**

Run:

```powershell
npm run android
```

On device:

1. Open the map screen and confirm Bob changes from idle to run frames when sensor-driven movement advances his position.
2. Confirm Bob faces left/right/up/down based on actual movement direction and returns to the matching idle pose when stopped.
3. Switch to `Free look` and drag the map for at least 15 seconds.
4. Confirm the camera feels more direct and no longer trails the finger as badly as before.
5. Confirm the follow/free-look button still remains the only way to change camera mode.

- [ ] **Step 6: Commit the docs update**

```powershell
git add Arena_indoor_navigation/src/mapEngine/README.md
git commit -m "docs: describe bob animation and camera drag behavior"
```
