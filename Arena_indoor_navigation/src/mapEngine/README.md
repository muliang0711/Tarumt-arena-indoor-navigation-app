# Map Engine Boundaries

`mapEngine` is split by ownership. Keep behavior in the folder that owns it.

## `map-controller.ts`

Page-safe export surface for the map engine. It exposes `ArenaMapEngineView` and its input types. Screens must not use this facade to reach low-level rendering or movement helpers.

## `ArenaMapEngineView.tsx`

Composition layer. It loads the map schema, creates initial actors, owns the persistent `MovementRuntime`, and wires subsystem outputs together. `MovementRuntime` keeps the previous `MovementSystemState` between sensor batches and is reset only when the normalized map or starting route node changes.

## Runtime sensor and movement flow

`MapScreen` owns the platform-facing `useMovementSensors` hook. The hook uses `expo-sensors`, checks availability and permissions, collects accelerometer, gyroscope, magnetometer, device-motion, and pedometer samples, and emits bounded chronological batches. It starts when `MapScreen` mounts and removes every native subscription when the screen unmounts.

```text
Expo phone sensors
  -> useMovementSensors
  -> bounded RawSensorSample batch
  -> ArenaMapEngineView
  -> previous MovementSystemState + map constraints
  -> updateMovementSystem
  -> returned MovementSystemState is saved
  -> actor position is updated
  -> ActorLayer renders the position
  -> camera follow centers on the latest actor position
```

Empty batches, duplicate sample IDs, invalid timestamps, and samples older than the last processed timestamp do not trigger movement updates. A map or starting-node change clears the particle filter and step history, restores the actor to the selected route node, and marks the batch present at the reset boundary as already consumed.

## Shared contracts and coordinates

`shared/` is the neutral dependency root for map-engine contracts. It imports no React, React Native, Expo, or subsystem code. Actor, camera, rendering, movement, sensor adapters, and the orchestrator may depend on it.

The authoritative `MapCoordinateSystem` validates:

- world unit is `meter`;
- origin is `top-left`;
- `pixelsPerMeter`, tile size, `tilesPerMeter`, and `metersPerTile` are finite and positive;
- `pixelsPerMeter = tileSizePixels × tilesPerMeter`;
- `metersPerTile = 1 / tilesPerMeter`.

Backward-compatible defaults are listed in `coordinateSystem.fallbacks`; unsupported units and contradictory metadata throw errors.

Logical values remain in meters:

- route nodes;
- movement positions and particle positions;
- walkable and blocked polygons;
- walls, doors, and corridors;
- actor positions.

Pixel conversion occurs only for actor rendering and camera targeting through `worldMetersToPixels`. Visual-layer tile placement uses `tilesToPixels`. Visual bounds offsets are applied only by rendering and camera code.

## Intentional dual map projections

Rendering and movement intentionally extract different projections from the same raw map. `ArenaMapEngineView` validates coordinate metadata once and passes the same `MapCoordinateSystem` object into both extractors.

```text
map.json
   -> shared coordinate validation
   -> MapCoordinateSystem
      -> render projection
         -> visual layers/assets/bounds converted to pixels for display
      -> movement projection
         -> route graph and constraints retained in meters
```

The extractors must remain separate. Rendering does not own movement constraints, and movement does not depend on rendering models.

## `map_rendering_system/`

Owns static map rendering only.

- `ArenaMapView.tsx`: React Native view that draws normalized visual map layers. It may expose an overlay slot, but it must not create or render actors itself.
- `mapRendererModel.ts`: map schema normalization, visual layer ordering, asset sizing, and visual bounds.
- `mapAssetRegistry.ts`: static image registry for map tiles and room assets only.

Do not put Bob, actor state, movement, route following, or sensor logic in this folder.

## `actor_system/`

Owns actor data and actor rendering.

- `actorModel.ts`: actor shape, route-node spawn helpers, and actor coordinate conversion.
- `ActorLayer.tsx`: renders actors over a map layout.
- `actorAssetRegistry.ts`: static image registry for actor sprites only.
- `actorSystem.ts`: subsystem barrel export.

Movement can later update actor positions, but it should not render actors directly.

## `movement_system/`

Owns movement estimation and persistent movement updates. `movement_system/index.ts` is its official external API. Files outside the subsystem must not import its internal algorithms, constraints, estimates, preprocessing, sensors, or engine file directly.

The public API includes:

- `MovementRuntime`;
- `updateMovementSystem`;
- `createMovementConstraintProvider`;
- movement state/result and constraint-provider types;
- shared movement input, sensor batch, and world-position contracts.

## `cameran_system/`

Owns viewport/camera behavior.

- `cameraModel.ts`: pure camera math for fitting bounds, following a point, zooming, and panning.
- `CameraViewport.tsx`: React Native transform wrapper that applies camera state to child content.
- `cameranSystem.ts`: subsystem barrel export.

Do not put map tile rendering, Bob creation, actor rendering, movement, or sensor logic in this folder.

## Temporary navigation debugger

`debugger/` contains removable testing UI and pure formatting helpers. It shows
the current sensor batch, movement runtime state, Node 4 as a visual-only
destination, and a reset control that returns Bob to Node 1.

Camera mode is an explicit user choice. Gestures never change `following` or
`free-look`; only the camera-mode button does. In free-look, Bob continues to
receive sensor-driven movement while the camera remains independent.

Node 4 is not passed into the movement system. The destination marker does not
snap Bob to a route or alter particle-filter scoring.

## Navigation debugger

The removable debugger now exposes Nodes 2, 3, and 4 as selectable
destinations. Its route origin comes from Bob's actor `nodeId`, so the initial
origin is Node 1 because Bob is actually spawned there. Selecting a destination
does not change Bob's position. `Calculate route` runs Dijkstra over the
normalized route graph, and the resulting graph edges are rendered as a blue
recommended center path. Changing the destination replaces an existing
highlight; `Clear route` removes it.

The Node 1-to-Node 4 route is `node_1 -> node_2 -> node_4`. Node 2 is the
L-shaped turn. This route is guidance only: Bob remains controlled by sensor
movement and may move anywhere allowed by the movement constraints.

`Show blocked` renders a red development overlay from the exact
`MovementConstraintMapInput` used by collision checking. It includes normalized
blocked polygons and walls, plus tile-center samples classified by the same
constraint provider to show areas outside walkable geometry. The route remains
a center path while walkable polygons represent the full legal movement area.

Bob rendering now uses directional idle and run sprites from `src/storage/bob`.
Visible animation is driven by real map-position changes, not by a fake local
debug loop.

Free-look drag keeps the manual camera-mode contract and commits camera state at
gesture end, while active gestures ignore parent camera prop resync to reduce
drag lag.

Bob translation now preserves fractional pixel movement so small sensor-driven
position changes remain visible on screen.

When explicit `movement.walkableAreas` are empty, the map engine temporarily
infers walkable one-tile polygons from floor-like visual layers such as
`walkable_*` and `road_*`. The debugger overlay shows the same inferred area
that the movement constraints enforce.
