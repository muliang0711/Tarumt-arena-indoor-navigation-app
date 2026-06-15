# Arena Map Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `generated_map/village_demo_01.json` in the Expo app through a separated, maintainable map engine renderer.

**Architecture:** The app imports a local copy of the generated map JSON, normalizes it into typed engine data, registers static image assets, and renders it through a viewport plus independent visual, route, node, actor, and collision-debug layers. Renderer components receive prepared data and never parse JSON or own collision rules.

**Tech Stack:** Expo 54, React 19, React Native 0.81, TypeScript strict mode, static React Native image assets, `@expo/vector-icons`.

---

## File Map

- Create `Arena_indoor_navigation/src/mapEngine/data/village_demo_01.json`: app-local copy of the generated resource.
- Create `Arena_indoor_navigation/src/mapEngine/assets/serious_shit/*.png`: app-local copy of generated map PNG assets.
- Create `Arena_indoor_navigation/src/mapEngine/models/mapTypes.ts`: shared map engine types.
- Create `Arena_indoor_navigation/src/mapEngine/data/normalizeMapData.ts`: raw JSON to normalized engine data.
- Create `Arena_indoor_navigation/src/mapEngine/data/villageDemoMap.ts`: typed village map export.
- Create `Arena_indoor_navigation/src/mapEngine/assets/assetRegistry.ts`: static image source registry by asset id.
- Create `Arena_indoor_navigation/src/mapEngine/camera/mapProjection.ts`: tile, map, and screen projection helpers.
- Create `Arena_indoor_navigation/src/mapEngine/collision/collisionGrid.ts`: collision lookup builder and query helpers.
- Create `Arena_indoor_navigation/src/mapEngine/renderer/MapViewport.tsx`: scrollable map viewport and debug toggle.
- Create `Arena_indoor_navigation/src/mapEngine/renderer/MapRenderer.tsx`: layer composition only.
- Create `Arena_indoor_navigation/src/mapEngine/renderer/layers/VisualLayer.tsx`: visual placement image layer.
- Create `Arena_indoor_navigation/src/mapEngine/renderer/layers/RouteLayer.tsx`: navigation link layer.
- Create `Arena_indoor_navigation/src/mapEngine/renderer/layers/NavigationNodeLayer.tsx`: navigation node marker layer.
- Create `Arena_indoor_navigation/src/mapEngine/renderer/layers/ActorLayer.tsx`: spawn/user marker layer.
- Create `Arena_indoor_navigation/src/mapEngine/renderer/layers/CollisionDebugLayer.tsx`: collision overlay layer.
- Create `Arena_indoor_navigation/src/screens/MapScreen.tsx`: map screen wrapper.
- Modify `Arena_indoor_navigation/App.tsx`: add the map screen route.
- Modify `Arena_indoor_navigation/src/components/PreviewTabs.tsx`: add the map tab.
- Modify `Arena_indoor_navigation/src/components/RoomCard.tsx`: support an `onPress` prop.
- Modify `Arena_indoor_navigation/src/screens/RoomSelectionScreen.tsx`: open map from selected room.

## Task 1: Register Map Resource And Assets

**Files:**
- Create: `Arena_indoor_navigation/src/mapEngine/data/village_demo_01.json`
- Create: `Arena_indoor_navigation/src/mapEngine/assets/serious_shit/*.png`

- [ ] **Step 1: Copy the generated JSON into the Expo project**

Run:

```powershell
Copy-Item -LiteralPath "generated_map\village_demo_01.json" -Destination "Arena_indoor_navigation\src\mapEngine\data\village_demo_01.json" -Force
```

Expected: `Arena_indoor_navigation/src/mapEngine/data/village_demo_01.json` exists and is valid JSON.

- [ ] **Step 2: Copy the PNG assets into the Expo project**

Run:

```powershell
New-Item -ItemType Directory -Force "Arena_indoor_navigation\src\mapEngine\assets\serious_shit"
Copy-Item -LiteralPath "village_tileset_placeholders\serious_shit\*.png" -Destination "Arena_indoor_navigation\src\mapEngine\assets\serious_shit" -Force
```

Expected: assets such as `classroom_1.png`, `road_2.png`, `white_tile.png`, and `wall_up.png` exist under the app-owned asset folder.

- [ ] **Step 3: Verify copied resource shape**

Run:

```powershell
node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync('Arena_indoor_navigation/src/mapEngine/data/village_demo_01.json','utf8')); console.log(m.map.id, m.layers.visual.length, m.layers.collision.length, m.navigation.nodes.length)"
```

Expected output includes:

```text
village_demo_01 1356 1539 13
```

## Task 2: Add Shared Map Types

**Files:**
- Create: `Arena_indoor_navigation/src/mapEngine/models/mapTypes.ts`

- [ ] **Step 1: Create map type contracts**

Create `Arena_indoor_navigation/src/mapEngine/models/mapTypes.ts` with:

```ts
import type { ImageSourcePropType } from 'react-native';

export type TileDirection = 'up' | 'down' | 'left' | 'right';

export type CollisionState = 'walkable' | 'blocked';

export type NavigationNodeType = 'destination' | 'waypoint' | 'spawn';

export type TilePosition = {
  x: number;
  y: number;
};

export type MapMetadata = {
  id: string;
  name: string;
  tileSize: number;
  width: number;
  height: number;
};

export type MapAssetDefinition = {
  id: string;
  src: string;
  widthTiles: number;
  heightTiles: number;
  blocksMovement: boolean;
  blockedOffsets: TilePosition[];
};

export type VisualPlacement = {
  id: string;
  assetId: string;
  x: number;
  y: number;
};

export type CollisionCell = TilePosition & {
  state: CollisionState;
};

export type NavigationNode = TilePosition & {
  id: string;
  label: string;
  type: NavigationNodeType;
};

export type NavigationLink = {
  id: string;
  from: string;
  to: string;
  bidirectional: boolean;
};

export type SpawnPoint = TilePosition & {
  direction: TileDirection;
};

export type RawGeneratedMap = {
  schemaVersion: number;
  map: MapMetadata;
  assets: {
    resourceRoot: string;
    items: MapAssetDefinition[];
  };
  layers: {
    visual: VisualPlacement[];
    collision: CollisionCell[];
  };
  navigation: {
    nodes: NavigationNode[];
    links: NavigationLink[];
  };
  spawn: SpawnPoint;
};

export type NormalizedMapData = {
  schemaVersion: number;
  map: MapMetadata;
  resourceRoot: string;
  assets: MapAssetDefinition[];
  assetsById: Record<string, MapAssetDefinition>;
  visualPlacements: VisualPlacement[];
  collisionCells: CollisionCell[];
  navigationNodes: NavigationNode[];
  navigationNodesById: Record<string, NavigationNode>;
  navigationLinks: NavigationLink[];
  spawn: SpawnPoint;
};

export type RegisteredMapAsset = {
  id: string;
  source: ImageSourcePropType;
};
```

- [ ] **Step 2: Run TypeScript check**

Run:

```powershell
cd Arena_indoor_navigation
npm run typecheck
```

Expected: TypeScript exits with code 0.

## Task 3: Normalize Generated Map Data

**Files:**
- Create: `Arena_indoor_navigation/src/mapEngine/data/normalizeMapData.ts`
- Create: `Arena_indoor_navigation/src/mapEngine/data/villageDemoMap.ts`

- [ ] **Step 1: Add the normalization module**

Create `Arena_indoor_navigation/src/mapEngine/data/normalizeMapData.ts` with:

```ts
import type { MapAssetDefinition, NavigationNode, NormalizedMapData, RawGeneratedMap } from '../models/mapTypes';

type RequiredMapSection = keyof Pick<RawGeneratedMap, 'map' | 'assets' | 'layers' | 'navigation' | 'spawn'>;

const requiredSections: RequiredMapSection[] = ['map', 'assets', 'layers', 'navigation', 'spawn'];

function indexAssets(assets: MapAssetDefinition[]) {
  return assets.reduce<Record<string, MapAssetDefinition>>((index, asset) => {
    index[asset.id] = asset;
    return index;
  }, {});
}

function indexNodes(nodes: NavigationNode[]) {
  return nodes.reduce<Record<string, NavigationNode>>((index, node) => {
    index[node.id] = node;
    return index;
  }, {});
}

export function getMapValidationErrors(rawMap: RawGeneratedMap): string[] {
  const errors: string[] = [];

  requiredSections.forEach((section) => {
    if (!rawMap[section]) {
      errors.push(`Missing map section: ${section}.`);
    }
  });

  if (rawMap.map && (rawMap.map.width <= 0 || rawMap.map.height <= 0 || rawMap.map.tileSize <= 0)) {
    errors.push('Map dimensions and tile size must be positive numbers.');
  }

  if (rawMap.layers && !Array.isArray(rawMap.layers.visual)) {
    errors.push('Map visual layer must be an array.');
  }

  if (rawMap.layers && !Array.isArray(rawMap.layers.collision)) {
    errors.push('Map collision layer must be an array.');
  }

  return errors;
}

export function normalizeMapData(rawMap: RawGeneratedMap): NormalizedMapData {
  const errors = getMapValidationErrors(rawMap);

  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }

  return {
    schemaVersion: rawMap.schemaVersion,
    map: rawMap.map,
    resourceRoot: rawMap.assets.resourceRoot,
    assets: rawMap.assets.items,
    assetsById: indexAssets(rawMap.assets.items),
    visualPlacements: rawMap.layers.visual,
    collisionCells: rawMap.layers.collision,
    navigationNodes: rawMap.navigation.nodes,
    navigationNodesById: indexNodes(rawMap.navigation.nodes),
    navigationLinks: rawMap.navigation.links,
    spawn: rawMap.spawn,
  };
}
```

- [ ] **Step 2: Add the village map export**

Create `Arena_indoor_navigation/src/mapEngine/data/villageDemoMap.ts` with:

```ts
import rawVillageDemoMap from './village_demo_01.json';
import { normalizeMapData } from './normalizeMapData';
import type { RawGeneratedMap } from '../models/mapTypes';

export const villageDemoMap = normalizeMapData(rawVillageDemoMap as RawGeneratedMap);
```

- [ ] **Step 3: Verify normalization through TypeScript**

Run:

```powershell
cd Arena_indoor_navigation
npm run typecheck
```

Expected: TypeScript exits with code 0.

## Task 4: Add Asset Registry

**Files:**
- Create: `Arena_indoor_navigation/src/mapEngine/assets/assetRegistry.ts`

- [ ] **Step 1: Create the static image registry**

Create `Arena_indoor_navigation/src/mapEngine/assets/assetRegistry.ts` with:

```ts
import type { ImageSourcePropType } from 'react-native';

export const mapAssetRegistry: Record<string, ImageSourcePropType> = {
  classroom_1: require('./serious_shit/classroom_1.png'),
  elevator: require('./serious_shit/elevator.png'),
  examroom_1: require('./serious_shit/examroom_1.png'),
  meetingroom_1: require('./serious_shit/meetingroom_1.png'),
  road_1: require('./serious_shit/road_1.png'),
  road_2: require('./serious_shit/road_2.png'),
  small_tree: require('./serious_shit/small_tree.png'),
  staris: require('./serious_shit/staris.png'),
  toilet: require('./serious_shit/toilet.png'),
  tree: require('./serious_shit/tree.png'),
  unwalkable_tile_clean: require('./serious_shit/unwalkable_tile_clean.png'),
  unwalkable_tile_dirt: require('./serious_shit/unwalkable_tile_dirt.png'),
  walkable_road_clean: require('./serious_shit/walkable_road_clean.png'),
  walkable_road_dirt: require('./serious_shit/walkable_road_dirt.png'),
  wall_down: require('./serious_shit/wall_down.png'),
  wall_left: require('./serious_shit/wall_left.png'),
  wall_right: require('./serious_shit/wall_right.png'),
  wall_up: require('./serious_shit/wall_up.png'),
  white_greg_tile: require('./serious_shit/white_greg_tile.png'),
  white_tile: require('./serious_shit/white_tile.png'),
};

export function getMapAssetSource(assetId: string): ImageSourcePropType | undefined {
  return mapAssetRegistry[assetId];
}
```

- [ ] **Step 2: Verify registry imports**

Run:

```powershell
cd Arena_indoor_navigation
npm run typecheck
```

Expected: TypeScript exits with code 0.

## Task 5: Add Projection And Collision Helpers

**Files:**
- Create: `Arena_indoor_navigation/src/mapEngine/camera/mapProjection.ts`
- Create: `Arena_indoor_navigation/src/mapEngine/collision/collisionGrid.ts`

- [ ] **Step 1: Create projection helpers**

Create `Arena_indoor_navigation/src/mapEngine/camera/mapProjection.ts` with:

```ts
import type { MapMetadata, TilePosition } from '../models/mapTypes';

export type MapProjection = {
  scale: number;
  tileSize: number;
  scaledTileSize: number;
  mapWidthPixels: number;
  mapHeightPixels: number;
};

export function createMapProjection(map: MapMetadata, scale = 1): MapProjection {
  const scaledTileSize = map.tileSize * scale;

  return {
    scale,
    tileSize: map.tileSize,
    scaledTileSize,
    mapWidthPixels: map.width * scaledTileSize,
    mapHeightPixels: map.height * scaledTileSize,
  };
}

export function tileToScreen(position: TilePosition, projection: MapProjection) {
  return {
    x: position.x * projection.scaledTileSize,
    y: position.y * projection.scaledTileSize,
  };
}

export function tileCenterToScreen(position: TilePosition, projection: MapProjection) {
  return {
    x: (position.x + 0.5) * projection.scaledTileSize,
    y: (position.y + 0.5) * projection.scaledTileSize,
  };
}
```

- [ ] **Step 2: Create collision lookup helpers**

Create `Arena_indoor_navigation/src/mapEngine/collision/collisionGrid.ts` with:

```ts
import type { CollisionCell, CollisionState } from '../models/mapTypes';

export type CollisionGrid = {
  cellsByKey: Record<string, CollisionState>;
};

export function getCollisionKey(x: number, y: number) {
  return `${x},${y}`;
}

export function createCollisionGrid(cells: CollisionCell[]): CollisionGrid {
  return {
    cellsByKey: cells.reduce<Record<string, CollisionState>>((index, cell) => {
      index[getCollisionKey(cell.x, cell.y)] = cell.state;
      return index;
    }, {}),
  };
}

export function isBlockedTile(grid: CollisionGrid, x: number, y: number) {
  return grid.cellsByKey[getCollisionKey(x, y)] === 'blocked';
}
```

- [ ] **Step 3: Verify helpers**

Run:

```powershell
cd Arena_indoor_navigation
npm run typecheck
```

Expected: TypeScript exits with code 0.

## Task 6: Render Visual, Route, Node, Actor, And Collision Layers

**Files:**
- Create: `Arena_indoor_navigation/src/mapEngine/renderer/layers/VisualLayer.tsx`
- Create: `Arena_indoor_navigation/src/mapEngine/renderer/layers/RouteLayer.tsx`
- Create: `Arena_indoor_navigation/src/mapEngine/renderer/layers/NavigationNodeLayer.tsx`
- Create: `Arena_indoor_navigation/src/mapEngine/renderer/layers/ActorLayer.tsx`
- Create: `Arena_indoor_navigation/src/mapEngine/renderer/layers/CollisionDebugLayer.tsx`

- [ ] **Step 1: Create `VisualLayer`**

Create `Arena_indoor_navigation/src/mapEngine/renderer/layers/VisualLayer.tsx` with:

```tsx
import { Image, StyleSheet, View } from 'react-native';

import { getMapAssetSource } from '../../assets/assetRegistry';
import type { MapProjection } from '../../camera/mapProjection';
import { tileToScreen } from '../../camera/mapProjection';
import type { MapAssetDefinition, VisualPlacement } from '../../models/mapTypes';

type VisualLayerProps = {
  assetsById: Record<string, MapAssetDefinition>;
  placements: VisualPlacement[];
  projection: MapProjection;
};

export function VisualLayer({ assetsById, placements, projection }: VisualLayerProps) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {placements.map((placement) => {
        const asset = assetsById[placement.assetId];
        const source = getMapAssetSource(placement.assetId);
        const screen = tileToScreen(placement, projection);

        if (!asset || !source) {
          return (
            <View
              key={placement.id}
              style={[
                styles.missingAsset,
                {
                  left: screen.x,
                  top: screen.y,
                  width: projection.scaledTileSize,
                  height: projection.scaledTileSize,
                },
              ]}
            />
          );
        }

        return (
          <Image
            key={placement.id}
            source={source}
            resizeMode="stretch"
            style={{
              position: 'absolute',
              left: screen.x,
              top: screen.y,
              width: asset.widthTiles * projection.scaledTileSize,
              height: asset.heightTiles * projection.scaledTileSize,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  missingAsset: {
    position: 'absolute',
    backgroundColor: '#d93025',
    opacity: 0.75,
  },
});
```

- [ ] **Step 2: Create `RouteLayer`**

Create `Arena_indoor_navigation/src/mapEngine/renderer/layers/RouteLayer.tsx` with:

```tsx
import { StyleSheet, View } from 'react-native';

import type { MapProjection } from '../../camera/mapProjection';
import { tileCenterToScreen } from '../../camera/mapProjection';
import type { NavigationLink, NavigationNode } from '../../models/mapTypes';

type RouteLayerProps = {
  links: NavigationLink[];
  nodesById: Record<string, NavigationNode>;
  projection: MapProjection;
};

export function RouteLayer({ links, nodesById, projection }: RouteLayerProps) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {links.map((link) => {
        const from = nodesById[link.from];
        const to = nodesById[link.to];

        if (!from || !to) {
          return null;
        }

        const start = tileCenterToScreen(from, projection);
        const end = tileCenterToScreen(to, projection);
        const deltaX = end.x - start.x;
        const deltaY = end.y - start.y;
        const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = `${Math.atan2(deltaY, deltaX)}rad`;

        return (
          <View
            key={link.id}
            style={[
              styles.segment,
              {
                left: start.x,
                top: start.y,
                width: length,
                transform: [{ rotateZ: angle }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    position: 'absolute',
    height: 3,
    backgroundColor: 'rgba(35, 122, 96, 0.62)',
    transformOrigin: 'left center',
  },
});
```

- [ ] **Step 3: Create `NavigationNodeLayer`**

Create `Arena_indoor_navigation/src/mapEngine/renderer/layers/NavigationNodeLayer.tsx` with:

```tsx
import { StyleSheet, Text, View } from 'react-native';

import type { MapProjection } from '../../camera/mapProjection';
import { tileCenterToScreen } from '../../camera/mapProjection';
import type { NavigationNode } from '../../models/mapTypes';

type NavigationNodeLayerProps = {
  nodes: NavigationNode[];
  projection: MapProjection;
};

export function NavigationNodeLayer({ nodes, projection }: NavigationNodeLayerProps) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {nodes.map((node) => {
        const center = tileCenterToScreen(node, projection);

        return (
          <View key={node.id} style={[styles.marker, { left: center.x - 7, top: center.y - 7 }]}>
            <Text style={styles.markerLabel}>{node.label.replace('Node ', '')}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    position: 'absolute',
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    backgroundColor: '#1b6f55',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  markerLabel: {
    color: '#ffffff',
    fontSize: 7,
    fontWeight: '900',
  },
});
```

- [ ] **Step 4: Create `ActorLayer`**

Create `Arena_indoor_navigation/src/mapEngine/renderer/layers/ActorLayer.tsx` with:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import type { MapProjection } from '../../camera/mapProjection';
import { tileCenterToScreen } from '../../camera/mapProjection';
import type { SpawnPoint } from '../../models/mapTypes';

type ActorLayerProps = {
  projection: MapProjection;
  spawn: SpawnPoint;
};

export function ActorLayer({ projection, spawn }: ActorLayerProps) {
  const center = tileCenterToScreen(spawn, projection);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.actor, { left: center.x - 12, top: center.y - 12 }]}>
        <Ionicons name="navigate" size={15} color="#ffffff" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actor: {
    position: 'absolute',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#ff7417',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
```

- [ ] **Step 5: Create `CollisionDebugLayer`**

Create `Arena_indoor_navigation/src/mapEngine/renderer/layers/CollisionDebugLayer.tsx` with:

```tsx
import { StyleSheet, View } from 'react-native';

import type { MapProjection } from '../../camera/mapProjection';
import { tileToScreen } from '../../camera/mapProjection';
import type { CollisionCell } from '../../models/mapTypes';

type CollisionDebugLayerProps = {
  cells: CollisionCell[];
  projection: MapProjection;
};

export function CollisionDebugLayer({ cells, projection }: CollisionDebugLayerProps) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {cells.map((cell) => {
        if (cell.state !== 'blocked') {
          return null;
        }

        const screen = tileToScreen(cell, projection);

        return (
          <View
            key={`${cell.x},${cell.y}`}
            style={[
              styles.cell,
              {
                left: screen.x,
                top: screen.y,
                width: projection.scaledTileSize,
                height: projection.scaledTileSize,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    position: 'absolute',
    backgroundColor: 'rgba(214, 48, 49, 0.25)',
  },
});
```

- [ ] **Step 6: Verify layer imports**

Run:

```powershell
cd Arena_indoor_navigation
npm run typecheck
```

Expected: TypeScript exits with code 0.

## Task 7: Compose Renderer And Viewport

**Files:**
- Create: `Arena_indoor_navigation/src/mapEngine/renderer/MapRenderer.tsx`
- Create: `Arena_indoor_navigation/src/mapEngine/renderer/MapViewport.tsx`

- [ ] **Step 1: Create `MapRenderer`**

Create `Arena_indoor_navigation/src/mapEngine/renderer/MapRenderer.tsx` with:

```tsx
import { StyleSheet, View } from 'react-native';

import { createMapProjection } from '../camera/mapProjection';
import type { NormalizedMapData } from '../models/mapTypes';
import { ActorLayer } from './layers/ActorLayer';
import { CollisionDebugLayer } from './layers/CollisionDebugLayer';
import { NavigationNodeLayer } from './layers/NavigationNodeLayer';
import { RouteLayer } from './layers/RouteLayer';
import { VisualLayer } from './layers/VisualLayer';

type MapRendererProps = {
  mapData: NormalizedMapData;
  scale?: number;
  showCollisionDebug?: boolean;
};

export function MapRenderer({ mapData, scale = 1, showCollisionDebug = false }: MapRendererProps) {
  const projection = createMapProjection(mapData.map, scale);

  return (
    <View
      style={[
        styles.surface,
        {
          width: projection.mapWidthPixels,
          height: projection.mapHeightPixels,
        },
      ]}
    >
      <VisualLayer assetsById={mapData.assetsById} placements={mapData.visualPlacements} projection={projection} />
      <RouteLayer links={mapData.navigationLinks} nodesById={mapData.navigationNodesById} projection={projection} />
      <NavigationNodeLayer nodes={mapData.navigationNodes} projection={projection} />
      <ActorLayer projection={projection} spawn={mapData.spawn} />
      {showCollisionDebug ? <CollisionDebugLayer cells={mapData.collisionCells} projection={projection} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#edf1e7',
  },
});
```

- [ ] **Step 2: Create `MapViewport`**

Create `Arena_indoor_navigation/src/mapEngine/renderer/MapViewport.tsx` with:

```tsx
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../../components/theme';
import type { NormalizedMapData } from '../models/mapTypes';
import { MapRenderer } from './MapRenderer';

type MapViewportProps = {
  mapData: NormalizedMapData;
};

export function MapViewport({ mapData }: MapViewportProps) {
  const [showCollisionDebug, setShowCollisionDebug] = useState(false);
  const scale = 1.2;

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <View>
          <Text style={styles.title}>{mapData.map.name}</Text>
          <Text style={styles.subtitle}>
            {mapData.map.width} x {mapData.map.height} tiles
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowCollisionDebug((current) => !current)}
          style={[styles.debugButton, showCollisionDebug && styles.debugButtonActive]}
        >
          <Text style={[styles.debugText, showCollisionDebug && styles.debugTextActive]}>Collision</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.verticalScroll} contentContainerStyle={styles.scrollContent}>
        <ScrollView horizontal showsHorizontalScrollIndicator style={styles.horizontalScroll}>
          <MapRenderer mapData={mapData} scale={scale} showCollisionDebug={showCollisionDebug} />
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  toolbar: {
    minHeight: 66,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  debugButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  debugButtonActive: {
    backgroundColor: colors.orange,
  },
  debugText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  debugTextActive: {
    color: '#ffffff',
  },
  verticalScroll: {
    flex: 1,
  },
  horizontalScroll: {
    flexGrow: 0,
  },
  scrollContent: {
    minHeight: '100%',
  },
});
```

- [ ] **Step 3: Verify renderer composition**

Run:

```powershell
cd Arena_indoor_navigation
npm run typecheck
```

Expected: TypeScript exits with code 0.

## Task 8: Wire Map Screen Into App Flow

**Files:**
- Create: `Arena_indoor_navigation/src/screens/MapScreen.tsx`
- Modify: `Arena_indoor_navigation/src/components/RoomCard.tsx`
- Modify: `Arena_indoor_navigation/src/screens/RoomSelectionScreen.tsx`
- Modify: `Arena_indoor_navigation/src/components/PreviewTabs.tsx`
- Modify: `Arena_indoor_navigation/App.tsx`

- [ ] **Step 1: Create `MapScreen`**

Create `Arena_indoor_navigation/src/screens/MapScreen.tsx` with:

```tsx
import { Header } from '../components/Header';
import { ScreenScaffold } from '../components/ScreenScaffold';
import { villageDemoMap } from '../mapEngine/data/villageDemoMap';
import { MapViewport } from '../mapEngine/renderer/MapViewport';

type MapScreenProps = {
  onBack: () => void;
};

export function MapScreen({ onBack }: MapScreenProps) {
  return (
    <ScreenScaffold scroll={false}>
      <Header title="Village Demo" subtitle="Indoor map preview" onBack={onBack} />
      <MapViewport mapData={villageDemoMap} />
    </ScreenScaffold>
  );
}
```

- [ ] **Step 2: Add press support to `RoomCard`**

Modify `Arena_indoor_navigation/src/components/RoomCard.tsx` so the prop type and function signature include `onPress`:

```tsx
type RoomCardProps = {
  title: string;
  type: string;
  distance: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  selected?: boolean;
  onPress?: () => void;
};

export function RoomCard({ title, type, distance, icon, selected = false, onPress }: RoomCardProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.card, selected && styles.selectedCard]}>
```

- [ ] **Step 3: Open the map from room selection**

Modify `Arena_indoor_navigation/src/screens/RoomSelectionScreen.tsx`:

```tsx
type RoomSelectionScreenProps = {
  onBack: () => void;
  onOpenMap: () => void;
};

export function RoomSelectionScreen({ onBack, onOpenMap }: RoomSelectionScreenProps) {
```

Then change the room list rendering:

```tsx
{rooms.map((room) => (
  <RoomCard key={room.title} {...room} onPress={room.selected ? onOpenMap : undefined} />
))}
```

- [ ] **Step 4: Add the map tab key**

Modify `Arena_indoor_navigation/src/components/PreviewTabs.tsx`:

```tsx
export type ScreenKey = 'home' | 'floors' | 'rooms' | 'map';
```

Update the tabs array:

```tsx
const tabs: Array<{ key: ScreenKey; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'floors', label: 'Floors', icon: 'layers' },
  { key: 'rooms', label: 'Rooms', icon: 'business' },
  { key: 'map', label: 'Map', icon: 'map' },
];
```

- [ ] **Step 5: Add the map route to `App.tsx`**

Modify `Arena_indoor_navigation/App.tsx` imports:

```tsx
import { MapScreen } from './src/screens/MapScreen';
```

Modify the render block:

```tsx
{activeScreen === 'rooms' && <RoomSelectionScreen onBack={() => setActiveScreen('floors')} onOpenMap={() => setActiveScreen('map')} />}
{activeScreen === 'map' && <MapScreen onBack={() => setActiveScreen('rooms')} />}
```

- [ ] **Step 6: Verify app flow types**

Run:

```powershell
cd Arena_indoor_navigation
npm run typecheck
```

Expected: TypeScript exits with code 0.

## Task 9: Runtime Verification

**Files:**
- No planned source files.

- [ ] **Step 1: Start Expo web**

Run:

```powershell
cd Arena_indoor_navigation
npm run web
```

Expected: Expo starts a web server and prints a local URL.

- [ ] **Step 2: Open the app in the in-app browser**

Open the Expo web URL. Navigate Home -> Floors -> Rooms -> Map.

Expected:

- The map screen renders a non-empty scrollable map.
- PNG assets appear at generated placement coordinates.
- The orange actor marker appears around tile `21,21`.
- Green node markers and route lines appear over the map.
- The `Collision` button toggles red blocked-cell overlays.

- [ ] **Step 3: Final verification**

Run:

```powershell
cd Arena_indoor_navigation
npm run typecheck
```

Expected: TypeScript exits with code 0.

Run:

```powershell
git status --short
```

Expected: source changes are visible. Existing unrelated generated-map changes remain separate from renderer implementation changes.
