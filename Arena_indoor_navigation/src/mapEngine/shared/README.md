# Shared Map-Engine Contracts

This folder is the neutral dependency root for the map engine.

Allowed consumers:

- movement system;
- actor system;
- camera system;
- map rendering system;
- sensor platform layer;
- `ArenaMapEngineView`.

The shared layer must not import React, React Native, Expo, or any subsystem.

`coordinateSystem.ts` validates map coordinate metadata and owns all meter, pixel, and tile conversion helpers. Rendering and movement remain separate projections, but the orchestrator passes the same validated `MapCoordinateSystem` to both.

```text
map.json
   -> extractMapCoordinateSystem
   -> MapCoordinateSystem
      -> normalizeMapSchema (render projection)
      -> extractMovementConstraintMapInput (movement projection)
```

Movement and actor logical positions remain meters. Rendering and camera targeting convert meters to pixels at their boundary.
