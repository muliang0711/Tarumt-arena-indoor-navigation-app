# Implementation Plan

This is a behavior-preserving, incremental plan. It does not require a rewrite.

Implementation status: the original public movement API, shared-contract, coordinate-system, dual-projection, page-facade, and import-enforcement work is complete. The phase descriptions remain as historical rationale and guidance for remaining follow-up work.

## Phase 1 — Public API and subsystem boundary cleanup

### Objective

Give every subsystem one explicit public entry and remove external deep imports.

### Likely files to change

- `src/mapEngine/ArenaMapEngineView.tsx`
- `src/mapEngine/movementRuntime.ts`
- `src/mapEngine/mapEngineController.ts`
- `src/mapEngine/map-controller.ts`
- `src/mapEngine/map-engine-contract.test.ts`
- `src/mapEngine/movementRuntime.test.ts`
- Existing actor, camera, and rendering barrel files

### Likely files to create

- `src/mapEngine/movement_system/index.ts`
- Optionally consistent `index.ts` entries for all systems

### Dependency changes

- Replace deep movement imports with the movement public API.
- Limit `map-controller.ts` to page-safe exports.
- Decide whether white-box subsystem tests may deep-import internals; keep those tests colocated and clearly named if allowed.

### Steps

1. Define the minimum movement public API: update function, state/result types, sensor batch type, constraint input type.
2. Re-export those symbols from one movement entry.
3. Migrate runtime consumers to the entry.
4. Remove `ArenaMapView` and internal constraint helpers from the page-facing facade unless an external use case is documented.
5. Standardize public-entry naming without moving internals yet.

### Risks

- Accidental API expansion.
- Type-only import changes can reveal hidden cycles.
- Removing facade exports may affect unsearched consumers outside `src`.

### Tests required

- Typecheck.
- Existing movement runtime tests.
- Existing sensor collector tests.
- Import scan proving no runtime external deep movement imports.

### Completion criteria

- Every system has one documented public entry.
- Runtime files outside a system do not import that system’s internal files.
- `MapScreen` can access only page-safe map-engine exports.

## Phase 2 — Data-source and sensor collection ownership

### Objective

Formalize the sensor platform boundary and make its page-facing API explicit.

### Likely files to change

- `src/screens/MapScreen.tsx`
- `src/sensors/useMovementSensors.ts`
- `src/sensors/expoMovementSensorAdapter.ts`
- `src/sensors/movementSensorCollector.ts`

### Likely files to create

- `src/sensors/index.ts`
- Neutral sensor contract file if not completed in Phase 5

### Dependency changes

- `MapScreen` imports only the sensor public entry.
- Sensor code imports neutral `RawSensorSample`, not the whole map-engine facade.

### Steps

1. Add a sensor public entry.
2. Move the sample contract dependency to a neutral location or temporary public movement contract.
3. Document foreground-only behavior and permission policy.
4. Decide whether app-state transitions should pause and resume collection.
5. Keep bounded batching behavior unchanged.

### Risks

- Platform permission differences.
- Resubscription races during app-state transitions.

### Tests required

- Subscription created once.
- All subscriptions removed.
- Late-resolving subscriptions removed after cleanup.
- Buffer remains bounded.
- Permission/unavailable paths return no samples without crashing.

### Completion criteria

- Expo imports exist only in the platform adapter.
- Page uses one sensor API.
- No sensor module imports the map-engine facade.

## Phase 3 — Persistent movement-state lifecycle

### Objective

Place persistent movement orchestration behind a stable movement public API.

### Likely files to change

- `src/mapEngine/movementRuntime.ts`
- `src/mapEngine/ArenaMapEngineView.tsx`
- `src/mapEngine/movement_system/indoorposition_engine.tsx`
- `src/mapEngine/movementRuntime.test.ts`

### Likely files to create

- Optionally `src/mapEngine/movement_system/movementRuntime.ts` if runtime ownership moves inside the subsystem

### Dependency changes

- `ArenaMapEngineView` consumes a movement session/runtime abstraction rather than the raw update function plus private state types.

### Steps

1. Decide ownership: orchestrator-held ref with public runtime, or a movement-owned session object.
2. Preserve previous state, particle filter, and step count.
3. Preserve chronological filtering and deduplication.
4. Define reset identity explicitly from map ID/floor and starting node, rather than object identity alone.
5. Expose a narrow result containing position, heading, confidence, and next state/session.

### Risks

- Changing reset keys can retain state across the wrong map or reset too often.
- React Strict Mode can expose lifecycle assumptions.

### Tests required

- Two batches share the returned state and filter.
- Empty/duplicate/older batches do not invoke updates.
- Map identity change resets once.
- Starting-node change resets once.
- Rerender with equivalent inputs does not reset.

### Completion criteria

- Particle generation advances across batches.
- Reset behavior is based on explicit identity.
- No movement calculation runs in render.

## Phase 4 — Actor and camera data-flow integration

### Objective

Make actor position the explicit bridge from movement output to rendering and camera follow.

### Likely files to change

- `src/mapEngine/ArenaMapEngineView.tsx`
- `src/mapEngine/actor_system/actorModel.ts`
- `src/mapEngine/actor_system/ActorLayer.tsx`
- `src/mapEngine/cameran_system/CameraViewport.tsx`
- Camera model tests

### Likely files to create

- Component-level orchestration test or hook-level test

### Dependency changes

- No subsystem-to-subsystem imports.
- Orchestrator translates movement output into actor input and actor position into camera target.

### Steps

1. Define actor update input through actor public API.
2. Keep camera follow target as a neutral point.
3. Verify pan/pinch disables follow but does not stop actor movement.
4. Verify re-enabling follow centers on the latest actor position.
5. Keep overlay composition in the orchestrator.

### Risks

- Camera effects may recenter unexpectedly.
- Actor and camera units can diverge.

### Tests required

- New movement position reaches actor render props.
- Follow mode uses latest position.
- Gesture start disables follow.
- Free-look camera remains stable while actor changes.

### Completion criteria

- Movement never imports actor or camera.
- Actor and camera never import movement.
- Follow behavior is covered by executable tests.

## Phase 5 — Neutral map schema and shared contract cleanup

### Objective

Create one normalized map contract shared by rendering, movement constraint extraction, actors, and camera geometry.

### Likely files to change

- `src/mapEngine/mapGeometry.ts`
- `src/mapEngine/mapEngineController.ts`
- `src/mapEngine/map_rendering_system/mapRendererModel.ts`
- `src/mapEngine/actor_system/actorModel.ts`
- `src/mapEngine/ArenaMapEngineView.tsx`
- Movement constraint types

### Likely files to create

- `src/mapEngine/shared/geometry.ts`
- `src/mapEngine/shared/mapSchema.ts`
- `src/mapEngine/shared/sensorContracts.ts`
- `src/mapEngine/shared/index.ts`

### Dependency changes

- All systems depend inward on neutral contracts.
- Rendering no longer owns the map schema used by actor initialization.
- Constraint extraction consumes normalized movement data rather than reparsing raw unknown data.

### Steps

1. Define raw-map and normalized-map contracts.
2. Normalize raw map once.
3. Derive visual, route, and movement-constraint views from the normalized model.
4. Move `Point`, `Bounds`, `WorldPosition`, and shared sensor types to neutral contracts as appropriate.
5. Remove duplicate raw parsing.

### Risks

- Existing permissive normalization may hide malformed map data.
- Coordinate unit conversion is high-risk.
- A large map fixture can make tests slow.

### Tests required

- Schema normalization fixture tests.
- Visual and constraint outputs derived from the same normalized fixture.
- Coordinate conversion tests.
- Invalid schema diagnostics.

### Completion criteria

- Raw map is normalized once.
- Every system consumes typed neutral data.
- Rendering and movement cannot diverge on map dimensions or coordinates.

## Phase 6 — Tests and architecture enforcement

### Objective

Make dependency rules executable and prevent regression.

### Likely files to change

- `package.json`
- `src/mapEngine/map-engine-contract.test.ts`
- Test configuration

### Likely files to create

- Architecture import-boundary test
- ESLint/dependency-cruiser configuration, if selected
- Component-level orchestrator tests

### Dependency changes

- Illegal deep imports and cross-system imports fail CI.

### Steps

1. Replace the current compile-only contract file with real executable assertions or a static import graph check.
2. Ensure all test files are included in `npm test`.
3. Add rules:
   - pages may import only map-engine and sensor public APIs;
   - systems may import shared contracts and their own internals;
   - systems may not import other systems;
   - only the orchestrator may import multiple subsystem APIs.
4. Add component-level tests for reset, actor propagation, and camera follow.
5. Run typecheck, tests, and architecture checks in CI.

### Risks

- Overly strict rules can block legitimate test imports.
- Path matching must distinguish type-only public contracts from internals.

### Tests required

- Positive fixtures for legal imports.
- Negative fixtures for subsystem cross-imports and page deep imports.
- Full existing test suite.

### Completion criteria

- `npm test` executes all intended tests.
- An illegal dependency demonstrably fails the architecture check.
- Documentation and automated rules describe the same boundaries.
