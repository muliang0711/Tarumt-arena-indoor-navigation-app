# Visible Bob Translation And Walkable Area Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Bob visibly translate for small sensor-driven position updates and add a temporary walkable-area overlay that also becomes the real movement constraint surface.

**Architecture:** Bob visibility is fixed at the actor render boundary by preserving fractional pixel positions instead of rounding them away. Temporary walkable areas are derived in one pure shared helper from floor-like visual layers, then reused by both `extractMovementConstraintMapInput` and a removable debugger overlay so the visible area and the enforced area always match.

**Tech Stack:** React 19, React Native 0.81, Expo 54, TypeScript 5.9, `tsx --test`

---

## File Structure

- Modify: `src/mapEngine/actor_system/actorModel.ts` to preserve fractional Bob pixel coordinates.
- Modify: `src/mapEngine/map-engine-contract.test.ts` to lock in visible Bob translation and inferred walkable constraints.
- Create: `src/mapEngine/shared/walkableAreaModel.ts` for temporary floor-tile walkable polygon extraction.
- Create: `src/mapEngine/shared/walkableAreaModel.test.ts` for pure extraction tests.
- Modify: `src/mapEngine/shared/index.ts` to export the walkable-area helper.
- Modify: `src/mapEngine/mapEngineController.ts` to use inferred walkable polygons when explicit `movement.walkableAreas` are empty.
- Create: `src/mapEngine/debugger/WalkableAreaDebugLayer.tsx` for the removable overlay.
- Modify: `src/mapEngine/debugger/index.ts` to export the overlay and shared walkable helper.
- Modify: `src/mapEngine/ArenaMapEngineView.tsx` to render the walkable overlay through the debugger public entry.
- Modify: `src/mapEngine/architecture-boundaries.test.ts` to enforce the new debugger public entry and overlay usage.
- Modify: `src/mapEngine/README.md` to document visible Bob translation and temporary walkable overlay behavior.

### Task 1: Preserve fractional Bob pixel movement

**Files:**
- Modify: `src/mapEngine/map-engine-contract.test.ts`
- Modify: `src/mapEngine/actor_system/actorModel.ts`

- [ ] **Step 1: Write the failing visible-translation regression**

Update the Bob pixel assertion in `src/mapEngine/map-engine-contract.test.ts`:

```ts
test('map, actor, movement and camera contracts compose in their intended units', () => {
  const parsed = normalizeMapSchema(rawMap);
  const orderedIds = orderVisualLayers(parsed.visualLayers).map((layer) => layer.id);
  const bounds = getVisualBounds(parsed);
  const bob = buildBobActorAtNode(parsed, 'node_1');
  const bobPixels = routeNodeToPixels(bob, parsed.coordinateSystem);
  const microMovePixels = routeNodeToPixels(
    {
      ...bob,
      position: { x: 4.81, y: 5.21 },
    },
    parsed.coordinateSystem,
  );
  const initialCamera = createInitialCameraState(bounds, { width: 360, height: 390 });
  const followedCamera = centerCameraOnPoint(initialCamera, bobPixels, { width: 360, height: 390 });
  const zoomedCamera = zoomCamera(followedCamera, 1.2);

  assert.deepEqual(orderedIds, ['floor', 'wall']);
  assert.deepEqual(bob.position, { x: 4.8, y: 5.2 });
  assert.deepEqual(bobPixels, { x: 192, y: 208 });
  assert.deepEqual(microMovePixels, { x: 192.4, y: 208.4 });
  assert.equal(setCameraZoom(zoomedCamera, 2).scale, 2);
  assert.equal(panCamera(zoomedCamera, { x: 12, y: -8 }).offsetX, zoomedCamera.offsetX + 12);
});
```

- [ ] **Step 2: Run the focused contract test and verify RED**

Run:

```powershell
npx tsx --test src/mapEngine/map-engine-contract.test.ts
```

Expected: FAIL because `routeNodeToPixels` currently rounds to `{ x: 192, y: 208 }` for both positions.

- [ ] **Step 3: Remove whole-pixel rounding from actor pixel conversion**

Update `src/mapEngine/actor_system/actorModel.ts`:

```ts
export function routeNodeToPixels(
  actor: Pick<Actor, 'position'>,
  coordinateSystem: MapCoordinateSystem,
) {
  const point = worldMetersToPixels(actor.position, coordinateSystem);
  return {
    x: point.x,
    y: point.y,
  };
}
```

- [ ] **Step 4: Run the focused contract test and verify GREEN**

Run:

```powershell
npx tsx --test src/mapEngine/map-engine-contract.test.ts
```

Expected: PASS with 0 failures.

- [ ] **Step 5: Commit the visible-translation fix**

```powershell
git add Arena_indoor_navigation/src/mapEngine/actor_system/actorModel.ts Arena_indoor_navigation/src/mapEngine/map-engine-contract.test.ts
git commit -m "fix: preserve visible bob movement"
```

### Task 2: Create a shared temporary walkable-area helper

**Files:**
- Create: `src/mapEngine/shared/walkableAreaModel.ts`
- Create: `src/mapEngine/shared/walkableAreaModel.test.ts`
- Modify: `src/mapEngine/shared/index.ts`

- [ ] **Step 1: Write the failing walkable-area extraction tests**

Create `src/mapEngine/shared/walkableAreaModel.test.ts`:

```ts
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
      { id: 'floor-a', assetId: 'walkable_road_clean', x: 1, y: 1, z: 0 },
      { id: 'floor-b', assetId: 'road_2', x: 2, y: 1, z: 1 },
      { id: 'wall', assetId: 'wall_up', x: 4, y: 4, z: 2 },
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
```

- [ ] **Step 2: Run the shared helper test and verify RED**

Run:

```powershell
npx tsx --test src/mapEngine/shared/walkableAreaModel.test.ts
```

Expected: FAIL because `walkableAreaModel.ts` does not exist.

- [ ] **Step 3: Implement the shared walkable-area helper**

Create `src/mapEngine/shared/walkableAreaModel.ts`:

```ts
import type { MapCoordinateSystem, Polygon, VisualLayer } from './index';
import { tilesToWorldMeters } from './coordinateSystem';

type WalkableLayer = Pick<VisualLayer, 'assetId' | 'x' | 'y'>;

export function isTemporaryWalkableAssetId(assetId: string): boolean {
  return /^(walkable_|road_)/.test(assetId);
}

export function extractTemporaryWalkableAreas(
  visualLayers: readonly WalkableLayer[],
  coordinateSystem: MapCoordinateSystem,
): Polygon[] {
  return visualLayers
    .filter((layer) => isTemporaryWalkableAssetId(layer.assetId))
    .map((layer) => tileRectToWorldPolygon(layer.x, layer.y, coordinateSystem));
}

function tileRectToWorldPolygon(
  x: number,
  y: number,
  coordinateSystem: MapCoordinateSystem,
): Polygon {
  const topLeft = tilesToWorldMeters({ x, y }, coordinateSystem);
  const bottomRight = tilesToWorldMeters({ x: x + 1, y: y + 1 }, coordinateSystem);

  return [
    topLeft,
    { x: bottomRight.x, y: topLeft.y },
    bottomRight,
    { x: topLeft.x, y: bottomRight.y },
  ];
}
```

Update `src/mapEngine/shared/index.ts`:

```ts
export {
  extractTemporaryWalkableAreas,
  isTemporaryWalkableAssetId,
} from './walkableAreaModel';
```

- [ ] **Step 4: Run the shared helper test and verify GREEN**

Run:

```powershell
npx tsx --test src/mapEngine/shared/walkableAreaModel.test.ts
```

Expected: PASS with 0 failures.

- [ ] **Step 5: Commit the shared helper**

```powershell
git add Arena_indoor_navigation/src/mapEngine/shared/walkableAreaModel.ts Arena_indoor_navigation/src/mapEngine/shared/walkableAreaModel.test.ts Arena_indoor_navigation/src/mapEngine/shared/index.ts
git commit -m "feat: infer temporary walkable areas from floor tiles"
```

### Task 3: Use inferred walkable areas in movement constraints

**Files:**
- Modify: `src/mapEngine/map-engine-contract.test.ts`
- Modify: `src/mapEngine/mapEngineController.ts`

- [ ] **Step 1: Write the failing inferred-walkable constraint test**

Append to `src/mapEngine/map-engine-contract.test.ts`:

```ts
test('movement extraction infers walkable areas from floor layers when explicit walkable areas are empty', () => {
  const constraintInput = extractMovementConstraintMapInput(rawMap);

  assert.equal(constraintInput.walkableAreas.length, 1);
  assert.deepEqual(constraintInput.walkableAreas[0], [
    { x: 0.4, y: 0.4 },
    { x: 0.8, y: 0.4 },
    { x: 0.8, y: 0.8 },
    { x: 0.4, y: 0.8 },
  ]);
});
```

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```powershell
npx tsx --test src/mapEngine/map-engine-contract.test.ts
```

Expected: FAIL because `extractMovementConstraintMapInput` still falls back to the full bounds polygon.

- [ ] **Step 3: Integrate inferred walkable areas into movement extraction**

Update `src/mapEngine/mapEngineController.ts` imports:

```ts
import {
  extractMapCoordinateSystem,
  extractTemporaryWalkableAreas,
  tilesToWorldMeters,
  type LineSegment,
  type MapCoordinateSystem,
  type MovementConstraintMapInput,
  type MovementRouteGraph,
  type Point,
  type Polygon,
  type RouteNode,
} from './shared';
```

Add a helper near `extractBlockedAreasFromAssets`:

```ts
function visualLayersFromRawMap(rawMapData: unknown) {
  const source = objectValue(rawMapData);
  const layers = objectValue(source.layers);
  const display = objectValue(source.display);

  return arrayValue(objectValue(layers).visual).length > 0
    ? arrayValue(objectValue(layers).visual)
    : arrayValue(display.visualLayers);
}
```

Then update `extractMovementConstraintMapInput`:

```ts
  const walkableAreas = normalizePolygons(movement.walkableAreas, 'movement.walkableAreas');
  const inferredWalkableAreas = extractTemporaryWalkableAreas(
    visualLayersFromRawMap(rawMapData)
      .map((item, index) => {
        const layer = objectValue(item);
        return {
          id: optionalString(layer.id) ?? `visual_${index}`,
          assetId: optionalString(layer.assetId) ?? '',
          x: finiteNumber(layer.x) ?? 0,
          y: finiteNumber(layer.y) ?? 0,
          z: finiteNumber(layer.z) ?? index,
        };
      })
      .filter((layer) => layer.assetId.length > 0),
    coordinateSystem,
  );

  return {
    coordinateSystem,
    routeGraph,
    walkableAreas:
      walkableAreas.length > 0
        ? walkableAreas
        : inferredWalkableAreas.length > 0
          ? inferredWalkableAreas
          : boundsPolygon
            ? [boundsPolygon]
            : [],
```

- [ ] **Step 4: Run the contract test and verify GREEN**

Run:

```powershell
npx tsx --test src/mapEngine/map-engine-contract.test.ts
```

Expected: PASS with 0 failures.

- [ ] **Step 5: Commit inferred walkable constraints**

```powershell
git add Arena_indoor_navigation/src/mapEngine/mapEngineController.ts Arena_indoor_navigation/src/mapEngine/map-engine-contract.test.ts
git commit -m "feat: constrain movement to inferred walkable areas"
```

### Task 4: Add the removable walkable-area debugger overlay

**Files:**
- Create: `src/mapEngine/debugger/WalkableAreaDebugLayer.tsx`
- Modify: `src/mapEngine/debugger/index.ts`
- Modify: `src/mapEngine/architecture-boundaries.test.ts`
- Modify: `src/mapEngine/ArenaMapEngineView.tsx`

- [ ] **Step 1: Write the failing debugger public-entry contract**

Append to `src/mapEngine/architecture-boundaries.test.ts`:

```ts
test('debugger public entry exposes the walkable area overlay and shared walkable helper', () => {
  const source = readFileSync(
    join(mapEngineRoot, 'debugger', 'index.ts'),
    'utf8',
  );

  assert.match(source, /WalkableAreaDebugLayer/);
  assert.match(source, /extractTemporaryWalkableAreas/);
});
```

- [ ] **Step 2: Run the architecture test and verify RED**

Run:

```powershell
npx tsx --test src/mapEngine/architecture-boundaries.test.ts
```

Expected: FAIL because the debugger public entry does not expose the walkable overlay/helper yet.

- [ ] **Step 3: Implement the overlay layer**

Create `src/mapEngine/debugger/WalkableAreaDebugLayer.tsx`:

```tsx
import { StyleSheet, View } from 'react-native';

import type { Bounds, MapCoordinateSystem, Polygon } from '../shared';
import { worldMetersToPixels } from '../shared';

type WalkableAreaDebugLayerProps = {
  areas: readonly Polygon[];
  bounds: Bounds;
  coordinateSystem: MapCoordinateSystem;
};

function polygonFrame(polygon: Polygon, coordinateSystem: MapCoordinateSystem) {
  const pixels = polygon.map((point) => worldMetersToPixels(point, coordinateSystem));
  const xs = pixels.map((point) => point.x);
  const ys = pixels.map((point) => point.y);

  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

export function WalkableAreaDebugLayer({
  areas,
  bounds,
  coordinateSystem,
}: WalkableAreaDebugLayerProps) {
  return (
    <>
      {areas.map((area, index) => {
        const frame = polygonFrame(area, coordinateSystem);
        return (
          <View
            key={`walkable-${index}`}
            pointerEvents="none"
            style={[
              styles.area,
              {
                left: frame.left - bounds.x,
                top: frame.top - bounds.y,
                width: frame.width,
                height: frame.height,
              },
            ]}
          />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  area: {
    position: 'absolute',
    zIndex: 18,
    backgroundColor: 'rgba(80, 120, 71, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(80, 120, 71, 0.45)',
  },
});
```

Update `src/mapEngine/debugger/index.ts`:

```ts
export { WalkableAreaDebugLayer } from './WalkableAreaDebugLayer';
export { extractTemporaryWalkableAreas } from '../shared';
```

- [ ] **Step 4: Render the overlay from the map engine**

Update `src/mapEngine/ArenaMapEngineView.tsx` imports:

```ts
import {
  buildMovementDebugSnapshot,
  DestinationDebugLayer,
  extractTemporaryWalkableAreas,
  findDestinationNode,
  MovementDebugPanel,
  WalkableAreaDebugLayer,
  type MovementProcessingStatus,
} from './debugger';
```

Add:

```ts
  const walkableAreas = useMemo(
    () => extractTemporaryWalkableAreas(mapData.visualLayers, mapData.coordinateSystem),
    [mapData.coordinateSystem, mapData.visualLayers],
  );
```

Then render it before the destination marker:

```tsx
              <WalkableAreaDebugLayer
                areas={walkableAreas}
                bounds={layout.bounds}
                coordinateSystem={mapData.coordinateSystem}
              />
```

- [ ] **Step 5: Run the architecture test and verify GREEN**

Run:

```powershell
npx tsx --test src/mapEngine/architecture-boundaries.test.ts
```

Expected: PASS with 0 failures.

- [ ] **Step 6: Commit the overlay**

```powershell
git add Arena_indoor_navigation/src/mapEngine/debugger/WalkableAreaDebugLayer.tsx Arena_indoor_navigation/src/mapEngine/debugger/index.ts Arena_indoor_navigation/src/mapEngine/ArenaMapEngineView.tsx Arena_indoor_navigation/src/mapEngine/architecture-boundaries.test.ts
git commit -m "feat: add walkable area debug overlay"
```

### Task 5: Document and verify the combined behavior

**Files:**
- Modify: `src/mapEngine/README.md`

- [ ] **Step 1: Update the map-engine README**

Add to `src/mapEngine/README.md`:

```md
Bob translation now preserves fractional pixel movement so small sensor-driven
position changes remain visible on screen.

When explicit `movement.walkableAreas` are empty, the map engine temporarily
infers walkable one-tile polygons from floor-like visual layers such as
`walkable_*` and `road_*`. The debugger overlay shows the same inferred area
that the movement constraints enforce.
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

- only the planned map-engine, shared-helper, debugger, and documentation files are changed;
- `git diff --check` prints no whitespace errors;
- untracked `Arena_indoor_navigation/src/storage/bob/` and unrelated `Understand-Anything/` remain untouched.

- [ ] **Step 5: Manual device verification**

Run:

```powershell
npm run android
```

On device:

1. Open the map screen and confirm Bob visibly translates when the debugger position values change.
2. Confirm Bob still changes direction and animation state correctly while moving.
3. Confirm the walkable area overlay is visible and aligned with the floor/road tiles.
4. Try walking Bob outside the visible walkable area; confirm movement is blocked there.
5. Confirm Node 4 remains visual-only and Bob is not pulled toward it.

- [ ] **Step 6: Commit the docs update**

```powershell
git add Arena_indoor_navigation/src/mapEngine/README.md
git commit -m "docs: describe visible bob walkable overlay behavior"
```
