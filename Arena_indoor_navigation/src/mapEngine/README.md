# Map Engine Boundaries

`mapEngine` is split by ownership. Keep behavior in the folder that owns it.

## `map-controller.ts`

Public export surface for the map engine. Screens should import map engine UI from here instead of reaching into subsystem folders.

## `ArenaMapEngineView.tsx`

Composition layer. It loads the map schema, creates initial actors, and wires subsystem outputs together. This file may import both map rendering and actor modules.

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

Owns movement estimation and future path updates. It should output positions or actor state updates; actor rendering remains in `actor_system`.

## `cameran_system/`

Owns viewport/camera behavior.

- `cameraModel.ts`: pure camera math for fitting bounds, following a point, zooming, and panning.
- `CameraViewport.tsx`: React Native transform wrapper that applies camera state to child content.
- `cameranSystem.ts`: subsystem barrel export.

Do not put map tile rendering, Bob creation, actor rendering, movement, or sensor logic in this folder.
