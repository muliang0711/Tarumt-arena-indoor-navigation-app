# Source Tree

## Purpose

`src/` contains all runtime code for the prototype. The folder is intentionally split into explicit frontend layers so the navigation demo can grow without pushing flow logic, rendering, and data parsing into one screen file.

The dependency direction is deliberate: presentation reads from application models, application coordinates feature flow, map-engine is the emerging home for reusable map capability, integration adapts raw data sources, and shared contracts sit underneath the layers that truly need them.

## Contains

- `application/`: flow state, route construction, and sensor-driven navigation behavior
- `map-engine/`: dedicated home for camera, renderer, routing, localization, realtime, and indoor map capability
- `integration/`: map package loading, asset registry wiring, and parsing adapters
- `presentation/`: screens, reusable visual components, and viewport gesture logic
- `shared/`: shared types and theme tokens used across layers

## Entry Points

- `../App.tsx`: mounts the top-level screen
- `presentation/screens/IndoorMapPrototypeScreen.tsx`: assembles the page flow and map viewport
- `application/flows/indoor-map/useIndoorMapFlow.ts`: main runtime model exposed to presentation
- `map-engine/README.md`: explains the intended ownership boundaries for the future engine module

## Dependencies And Coupling

- `presentation/` should not import raw map assets directly
- `application/` is the only layer that combines parsed map data, route logic, and sensor updates
- `map-engine/` is being introduced as the future home for reusable map capability, but no runtime code has been moved there yet
- `integration/` is the boundary to bundled map files under `assets/`

## When To Read Deeper

Read deeper when a task crosses layer boundaries, such as adding a new navigation step, changing the parsed floor model, or tracing a UI issue back to flow state.
