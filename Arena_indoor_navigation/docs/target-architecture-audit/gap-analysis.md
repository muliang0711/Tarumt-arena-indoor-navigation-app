# Gap Analysis

## Ranked gaps

The original High-severity movement API and shared-contract gaps, plus the broad page facade and coordinate-contract inconsistency, have been resolved. Remaining gaps are listed below.

### Medium — Component-level orchestration behavior lacks renderer tests

- **Expected:** Executable component tests verify actor propagation, camera follow, and gesture follow-disable behavior.
- **Current:** Pure model tests and static wiring checks cover these paths, but no React Native renderer test executes the component lifecycle.
- **Problem:** Hook/effect regressions may not be caught.

### Low — Duplicate map ownership

- **Expected:** `MapScreen` explicitly supplies the selected map.
- **Current:** `MapScreen` passes `mapData`, but `ArenaMapEngineView` also requires a default map internally.
- **Affected files:** `MapScreen.tsx`, `ArenaMapEngineView.tsx`.
- **Problem:** Missing page input can silently select a hard-coded map and makes reset ownership less explicit.

### Low — Public-entry naming is inconsistent

- **Expected:** Predictable `index.ts` or consistently named public files.
- **Current:** `actorSystem.ts`, `cameranSystem.ts`, `mapRenderingSystem.ts`, and no movement equivalent.
- **Affected directories:** all four systems.
- **Problem:** Discoverability and automated policy configuration are harder. `cameran_system` also appears misspelled.

### Low — Camera subsystem imports application theme directly

- **Expected:** Reusable subsystem UI depends on neutral visual tokens or receives style configuration.
- **Current:** `CameraViewport.tsx` imports `../../components/theme`.
- **Problem:** This is not a subsystem cycle, but it couples engine infrastructure to app-level component styling.

## Alignment by required question

1. **Does the project follow the target?** Partially aligned.
2. **Do matching parts exist?** Yes: page ownership, sensor adapter, bounded lifecycle, orchestrator, actor/camera/rendering barrels, state continuity.
3. **Do mismatches exist?** Yes: movement public API, shared contracts, broad facade, enforcement, split schema parsing.
4. **Does every subsystem expose a proper public API?** No. Movement does not.
5. **Is `ArenaMapEngineView` the only master orchestrator?** Yes for runtime cross-system composition. `map-engine-contract.test.ts` bypasses it only in test/compile-time code. `MovementRuntime` is a movement helper, not a cross-system orchestrator.
6. **Is the data-source layer real?** Sensor and map sources are real. Finger input is a camera event stream. Movement state is internal.
7. **Is movement state continuous?** Yes, with tested state/filter continuity, deduplication, and reset behavior.
8. **Is information passed correctly?** Runtime direction is mostly correct; type ownership and deep imports remain reversed or overly coupled.
9. **Is the target diagram complete?** No. Add rendering, sensor adapter/hook, neutral contracts, and internal movement state.

## Risk of doing nothing

- New movement features will add more deep imports and make later extraction expensive.
- Rendering and movement may interpret future map-schema changes differently.
- A page can bypass orchestration using currently exported low-level APIs.
- Architecture documentation may claim boundaries that are not mechanically protected.

## Recommended priority

Start with public API cleanup because it can be performed as a behavior-preserving change and creates a stable base for every later phase.
