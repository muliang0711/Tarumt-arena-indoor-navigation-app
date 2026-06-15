# Arena Map Renderer Design

## Goal

Render `generated_map/village_demo_01.json` inside `Arena_indoor_navigation` using the existing map engine architecture. The renderer must be split into maintainable layers and helpers instead of becoming one large component.

The current resource is JSON, not JavaScript. The implementation will treat `generated_map/village_demo_01.json` as the source map file.

## Current Context

`Arena_indoor_navigation` is an Expo React Native app. Its `src/mapEngine` folder currently contains architecture documentation and one empty movement-system file, but no rendering, loading, camera, collision, or routing implementation.

The generated map contains:

- `map`: id, name, tile size, width, and height.
- `assets.items`: asset metadata, source filenames, tile dimensions, movement blocking, and blocked offsets.
- `layers.visual`: drawable placements with `assetId`, `x`, and `y`.
- `layers.collision`: tile collision states.
- `navigation.nodes`: graph nodes with id, label, type, and tile position.
- `navigation.links`: graph links between nodes.
- `spawn`: initial user tile and direction.

The required PNG assets currently live under `village_tileset_placeholders/serious_shit`.

## Recommended Approach

Use a layered React Native renderer.

`MapRenderer` will only compose rendering layers. It will not parse JSON, decide collision, calculate routes, or own screen navigation. Each layer will receive typed, already-normalized data and draw one category of map content.

This keeps the first implementation compatible with Expo and avoids adding canvas or native rendering dependencies before the map data pipeline is proven.

## Architecture

```text
generated_map/village_demo_01.json
  -> src/mapEngine/data/villageDemoMap.ts
  -> src/mapEngine/data/normalizeMapData.ts
  -> src/mapEngine/models/mapTypes.ts
  -> src/mapEngine/assets/assetRegistry.ts
  -> src/screens/MapScreen.tsx
  -> src/mapEngine/renderer/MapViewport.tsx
  -> src/mapEngine/renderer/MapRenderer.tsx
  -> src/mapEngine/renderer/layers/*
```

Planned files:

```text
src/mapEngine/
  assets/
    assetRegistry.ts
  camera/
    cameraTypes.ts
    mapProjection.ts
  collision/
    collisionGrid.ts
  data/
    normalizeMapData.ts
    villageDemoMap.ts
  models/
    mapTypes.ts
  renderer/
    MapRenderer.tsx
    MapViewport.tsx
    layers/
      ActorLayer.tsx
      CollisionDebugLayer.tsx
      NavigationNodeLayer.tsx
      RouteLayer.tsx
      VisualLayer.tsx
```

## Module Responsibilities

### `models/`

Defines the shared TypeScript contracts for map metadata, asset definitions, visual placements, collision cells, navigation nodes, navigation links, spawn state, and normalized map data.

These types are the boundary between data loading, collision, camera, and rendering.

### `data/`

Imports the generated JSON and normalizes it into engine-friendly structures.

Responsibilities:

- Keep generated-map shape isolated from the renderer.
- Validate required top-level sections before rendering.
- Build lookup maps such as `assetsById` and `nodesById`.
- Preserve tile coordinates as the canonical map coordinate system.

### `assets/`

Maps generated asset ids to static React Native image sources.

React Native cannot dynamically `require()` arbitrary file paths at runtime, so each asset id from the generated JSON must be registered in `assetRegistry.ts`.

### `camera/`

Handles coordinate projection and viewport sizing.

Initial implementation will support tile-to-screen conversion:

```text
screenX = tileX * tileSize * scale
screenY = tileY * tileSize * scale
```

This module will also expose map pixel dimensions. It will not own gestures or routing.

### `collision/`

Builds a collision lookup from `layers.collision`.

Responsibilities:

- Answer whether a tile is blocked.
- Provide data to `CollisionDebugLayer`.
- Stay independent from renderer code.

### `renderer/MapViewport`

Owns the scrollable map surface and viewport-level UI state, such as debug overlay visibility.

It passes normalized map data and renderer options into `MapRenderer`.

### `renderer/MapRenderer`

Composes layers in visual order:

1. `VisualLayer`
2. `RouteLayer`
3. `NavigationNodeLayer`
4. `ActorLayer`
5. `CollisionDebugLayer` when enabled

It should not contain layer-specific drawing logic.

### `renderer/layers/VisualLayer`

Draws `layers.visual` using `Image` components and the asset registry.

Placements will be positioned absolutely on the map surface. Placement dimensions come from the asset definition tile width and height.

### `renderer/layers/RouteLayer`

Draws navigation links between nodes.

The first version can draw straight segments between linked nodes. Future pathfinding can replace this layer's input with computed route points without changing other layers.

### `renderer/layers/NavigationNodeLayer`

Draws navigation nodes as labeled markers. This layer is useful for verifying generated graph data and for future destination selection.

### `renderer/layers/ActorLayer`

Draws the spawn/user marker. It receives actor-like state, starting from the generated `spawn`.

The movement system can later update this state without changing the visual map layers.

### `renderer/layers/CollisionDebugLayer`

Draws blocked and walkable collision cells as a translucent overlay when debug mode is enabled.

This layer is optional at runtime and exists to verify collision data against the visuals.

## App Flow

Add a `MapScreen` and a `map` preview tab/screen key.

Room selection will open `MapScreen`. The existing home, floor, and room screens remain unchanged except for navigation props needed to enter the map.

## Asset Handling

Copy or register the `serious_shit` PNG assets into the Expo project under a stable app-owned folder, such as:

```text
Arena_indoor_navigation/src/mapEngine/assets/serious_shit/
```

The generated JSON can keep `assets.resourceRoot` as metadata, but rendering will use the static registry:

```text
asset id -> require('./serious_shit/<file>.png')
```

## Error Handling

The renderer should fail visibly but locally:

- Missing asset id: render a small placeholder block and log the missing id.
- Invalid link node: skip that link and log the bad link id.
- Missing map dimensions or tile size: show a map error message in `MapScreen`.

Errors should not crash the whole app during early map authoring.

## Testing And Verification

Verification will include:

- `npm run typecheck` in `Arena_indoor_navigation`.
- Expo web render check.
- Visual check that the map surface is non-empty.
- Confirm that visual placements render at expected tile sizes.
- Confirm spawn marker appears at `spawn.x`, `spawn.y`.
- Confirm navigation nodes and links align with tile coordinates.
- Toggle collision debug overlay and confirm blocked cells align with the map.

## Deferred Work

The first renderer will not implement:

- Sensor-based indoor positioning.
- A* pathfinding.
- Gesture pinch zoom.
- Native canvas optimization.
- Route instructions.
- Multi-floor loading.

These can be added after the renderer/data boundaries are in place.
