# Map Engine Architecture

This folder contains the planned architecture for the indoor navigation tile-map engine. The current setup only defines folder responsibilities and placeholder files. No rendering logic, movement logic, collision logic, pathfinding, map loading, or UI screens have been implemented yet.

The map engine is intended for an Expo Go, React Native, and TypeScript mobile app. It will later render indoor maps from JSON data that describes tile size, map dimensions, visual placements, and asset references.

## Folder Structure

```text
src/mapEngine/
  camera/
  data/
  renderer/
    layers/
  collision/
  actors/
  movement/
  routing/
  models/
  config/
```

## Folder Responsibilities

### `camera/`

Responsible for camera and viewport logic.

This includes world-to-screen conversion, screen-to-world conversion, camera position, zoom, viewport size, camera follow actor behavior, and camera boundary clamping.

### `data/`

Responsible for loading and preparing map data.

This includes loading map JSON, validating map schema, normalizing map data, and managing the asset registry.

Map JSON tells the engine where assets are placed. The asset registry tells the engine what each asset is, including image path, tile size, collision shape, and render metadata.

### `renderer/`

Responsible for rendering the map engine visually.

This folder should contain the main `MapRenderer` later.

The renderer should not handle movement, collision, or route calculation. It should only draw the current map state.

### `renderer/layers/`

Responsible for separated rendering layers.

Future layers may include:

- `TileLayer`
- `ObjectLayer`
- `ActorLayer`
- `RouteLayer`
- `CollisionDebugLayer`

Each layer should render one category of map content only.

### `collision/`

Responsible for collision data and collision checking.

This includes generating a collision grid from map data and asset metadata, checking whether an actor can move into a position, and supporting debug collision visualization later.

### `actors/`

Responsible for actor models and actor management.

Actors are dynamic objects on the map, such as the user marker, NPC, guide marker, or moving object.

Actors should use world coordinates, not only tile coordinates.

### `movement/`

Responsible for actor movement logic.

This includes movement direction, velocity, delta time movement, route-following movement, and movement-with-collision later.

### `routing/`

Responsible for route and pathfinding logic.

This includes route graph, A* pathfinding later, converting tile paths to world paths, and returning route points for `RouteLayer` to render.

### `models/`

Responsible for TypeScript types used by the map engine.

Examples include:

- `MapData`
- `TilePosition`
- `WorldPosition`
- `Camera`
- `Actor`
- `CollisionGrid`
- `AssetDefinition`
- `RoutePoint`
- `RouteNode`

### `config/`

Responsible for map engine configuration.

Examples include default tile size, minimum zoom, maximum zoom, actor speed, route style, debug flags, and camera settings.

## Current Setup Notes

- Each empty folder contains a `.gitkeep` file so it can be tracked by Git.
- No real map engine logic has been added yet.
- No UI screens have been added.
- Existing app screens, components, and navigation files were not moved or modified.
