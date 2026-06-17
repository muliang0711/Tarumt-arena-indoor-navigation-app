# Implementation Plan — Indoor Positioning Android App

## 0. Goal

Build an Android app that:
1. reads Wi-Fi RSSI scans from the device,
2. fetches and caches AP location data from an external source,
3. estimates the user position locally,
4. sends the result to a map renderer module,
5. logs enough detail to diagnose scan failures, throttling, stale data, and background-task issues.

The map renderer is out of scope for now. Use a stub/port so integration can happen later without restructuring the app.

---

## 1. Design principles

- Keep Android platform APIs at the edges.
- Keep math/positioning logic pure and testable.
- Keep storage/network behind repositories and data sources.
- Keep UI dumb: it should observe state, not own the logic.
- Keep all major components replaceable.
- Prefer immutable data models.
- Make multi-floor support possible later, even though the first version is 2D-only on one floor.

---

## 2. Recommended project structure

Use a modular structure so responsibilities stay clean and future changes do not turn the codebase into a haunted corridor of dependencies.

```text
app/
  - app bootstrap, DI wiring, navigation, permissions entry points

core/
  common/
    - Result types, errors, logging abstractions, clocks, helpers
  model/
    - AP, Node, Edge, scan, position, route, state models
  wifi/
    - Wi-Fi scan adapter, Android API wrapper, scan normalization
  apdata/
    - AP catalog repository, remote source, local cache source
  positioning/
    - multilateration engine, filtering, confidence, smoothing
  graph/
    - Node/Edge storage, graph validation, future pathfinding support
  observability/
    - structured logs, diagnostics events, watchdog hooks

feature/
  tracking/
    - ViewModel/controller, tracking session orchestration, UI state
  mapstub/
    - temporary MapRendererPort implementation until the real module exists
```

### Why this shape
- `core/*` contains reusable logic and abstractions.
- `feature/*` contains app-facing orchestration and screen logic.
- `app` only wires everything together.
- The map renderer is isolated behind a port so the future integration does not leak into positioning code.

---

## 3. Core data model

Treat the following as the canonical source of truth.

### 3.1 Wi-Fi scan models
- `WifiScanReading`
  - BSSID / AP identifier
  - RSSI
  - timestamp
  - optional frequency / channel / metadata
- `WifiScanSnapshot`
  - a batch of readings captured at one time
  - scan timestamp
  - scan source metadata

### 3.2 AP location models
- `AccessPointLocation`
  - AP identifier
  - x, y
  - floor identifier
  - optional calibration / confidence metadata
- `AccessPointCatalog`
  - version
  - list/map of AP locations
  - last updated timestamp

### 3.3 Position models
- `PositionEstimate`
  - x, y
  - floor identifier placeholder for future support
  - confidence
  - error metrics / diagnostics summary
- `TrackingState`
  - idle
  - requesting permission
  - scanning
  - positioning
  - stale data
  - error
  - paused

### 3.4 Graph models: Node and Edge
Use these as first-class entities for the coordinate/path graph.

#### Node
A `Node` represents a point in the coordinate system and should follow this schema conceptually:

- `node_id`
- `floor_id`
- `x`
- `y`
- `type` (`destination`, `junction`, `stairs`, `elevator`)
- `name` optional
- `enabled`
- `metadata` optional

#### Edge
An `Edge` represents a traversable path between two `Node`s and should follow this schema conceptually:

- `edge_id`
- `from_node`
- `to_node`
- `bidirectional`
- `weight`
- `distance_m`
- `time_s` optional
- `accessibility`
- `enabled`
- `properties` optional

### Important note about coordinates
The first implementation is **single-floor, 2D-only**.  
The schemas already include `floor_id`, and that field must stay in the model so multi-floor navigation can be added later without redesigning everything.

For now:
- the positioning engine should operate in 2D,
- floor-aware logic should be present in the models and storage,
- but the UI and solver can ignore floor transitions unless they are explicitly needed for the mockup.

### Why this matters
This gives the app a future-proof data model without forcing the first prototype to solve multi-floor navigation on day one. A noble ambition, but not a productive way to finish a mockup.

---

## 4. Architectural layers

## 4.1 UI layer
Responsibilities:
- show tracking state
- ask for permissions
- show loading, error, and stale-data states
- receive position updates
- forward user actions to the tracking controller

Do not put scan logic, positioning logic, or storage logic here.

## 4.2 Tracking/orchestration layer
Responsibilities:
- start/stop tracking sessions
- coordinate AP catalog loading
- trigger scan requests
- feed scan data into the positioning engine
- publish updates to UI and map renderer port
- react to permission/device state changes

This layer should be the place where application flow lives.

## 4.3 Data layer
Responsibilities:
- fetch AP metadata from remote source
- cache AP metadata locally
- expose a stable repository API to the rest of the app
- hide whether the data source is server, database, object storage, or static export

## 4.4 Platform layer
Responsibilities:
- Android Wi-Fi API access
- permissions handling
- background task scheduling
- logging / diagnostics sinks
- any device-specific quirks

---

## 5. Wi-Fi scanning module

Create a dedicated Wi-Fi scanning adapter around Android’s Wi-Fi APIs.

### Responsibilities
- request scans
- receive scan-complete callbacks/broadcasts
- read scan results
- normalize raw Android `ScanResult` objects into internal models
- filter out unusable/irrelevant readings
- emit structured scan snapshots

### Notes
- Do not call the Android API directly from UI code.
- Do not make the positioning engine know anything about Android classes.
- Treat scan cadence as controlled, not infinite.
- The scanner should expose clear failure states:
  - permission denied
  - Wi-Fi disabled
  - location services unavailable
  - scan throttled
  - stale scan results
  - no results

### Design choice
Use a thin `WifiScanSource` interface plus one Android implementation. That way the rest of the app can be tested with fake scan snapshots.

---

## 6. AP catalog module

Build this as a repository with a remote source and a local cache.

### Interfaces
- `AccessPointCatalogRepository`
- `RemoteApCatalogDataSource`
- `LocalApCatalogDataSource`
- `CatalogVersionPolicy`

### Behavior
- load cached AP data immediately on startup
- refresh catalog in the background when needed
- compare versions or timestamps before replacing local data
- keep the last valid catalog available if the network fails
- never block positioning entirely just because the remote source is temporarily unavailable

### Notes
- Store the catalog in a format that is easy to evolve.
- Prefer a versioned payload.
- Keep BSSID / AP identifiers stable.
- Keep the repository interface stable even if the backend changes later.

### Design choice
The app should care about “give me the latest AP catalog,” not whether the data came from a database, JSON export, or some server team’s current mood.

---

## 7. Positioning engine

Implement the positioning logic as a pure engine with no Android dependencies.

### Suggested pipeline
1. `ScanNormalizer`
2. `SignalPreprocessor`
3. `APMatcher`
4. `DistanceEstimator` or equivalent signal-to-space transformation
5. `MultilaterationSolver`
6. `PositionSmoother`
7. `ConfidenceCalculator`
8. `PositionEstimate` output

### Responsibilities
- match RSSI readings to known APs
- ignore unknown / disabled APs
- compute an estimated position
- return confidence and diagnostics
- support swapping out the solver later

### Important note about single-floor now, multi-floor later
Current version:
- solve only x/y in 2D
- use the `floor_id` as metadata in the model, not as an active solver dimension

Later version:
- allow floor-aware inference
- allow edge-based navigation
- allow vertical transitions via stairs/elevator nodes

### Design choice
Do not hard-code multilateration into the entire app. Keep it behind a `PositioningEngine` interface so you can replace the algorithm later without rewriting the pipeline.

---

## 8. Navigation graph module

Even if pathfinding is not implemented immediately, define the graph layer now.

### Responsibilities
- store and validate `Node` and `Edge`
- provide graph queries
- support future route planning
- support future floor transitions
- provide the map renderer with route/path data later

### Notes
- `Node` is the atomic point entity.
- `Edge` is a directed or bidirectional traversable relation.
- keep validation strict:
  - edges must reference existing nodes
  - disabled nodes/edges should be ignored by planners
  - accessibility constraints should be preserved
- pathfinding is future work, but the schema should be future-safe now

### Design choice
This keeps the system ready for route planning later without forcing the first version to implement full navigation logic.

---

## 9. Logging and diagnostics system

Create a robust observability layer from the start.

### Goals
- know when Wi-Fi scan requests are sent
- know when results come back
- know when scans are throttled or missing
- know when background processes are lagging or unresponsive
- know when AP catalog refreshes fail
- know solver latency and confidence trends

### Components
- `AppLogger` interface
- `StructuredLogEvent`
- `DiagnosticsRecorder`
- `HealthHeartbeat`
- `WatchdogMonitor`
- optional debug overlay / diagnostics screen

### Suggested event categories
- permission events
- Wi-Fi scan lifecycle
- AP catalog lifecycle
- positioning lifecycle
- background worker lifecycle
- UI state transitions
- solver performance
- cache state

### What to log
- request sent
- callback received
- result count
- elapsed time
- throttle detection
- stale data detection
- worker heartbeat status
- repository refresh status
- error code / exception class
- correlation id for each tracking session

### Practical notes
- Use structured logs, not only plain strings.
- Include timestamps and session IDs.
- Redact or limit sensitive identifiers if needed.
- Add a diagnostics screen or export path for debugging on real devices.
- Make logs readable for humans and grep-able for machines.

### Design choice
A good logging system saves hours later. A bad one saves nothing except regret.

---

## 10. React Native Map Module Integration

The map renderer is implemented as a React Native (RN) module (the `Arena_indoor_navigation` component). To maintain a clean architecture, the core Android app remains native (Kotlin), and the RN module is treated as a **renderer-only feature** behind a strict contract.

### Integration Strategy: RN as a Component
- **Native-First Ownership**: The native Android side owns the application lifecycle, Wi-Fi scanning, AP catalog, positioning engine, and tracking orchestration.
- **Typed Bridge (Native Module)**: Use React Native's Native Module system to expose a positioning API to the JS side. The native side pushes updates to RN rather than RN pulling data from native.
- **Data Contract**: Pass plain data models through the bridge:
    - `PositionEstimate` (x, y, floor, confidence)
    - `MapMetadata` (bounds, floor info)
    - `NavigationGraph` (Nodes, Edges)
    - `RouteInstructions` (if pathfinding is active)
- **Lifecycle Management**: The native app hosts the `RNRootView` inside a specific Fragment or Activity designated for map display.

### Native Module Interface (MapRendererBridge)
- `onPositionUpdate(positionJson)`
- `onMapDataLoaded(mapJson)`
- `onRouteUpdate(routeJson)`
- `onStateChange(state)`

---

## 11. State management

Use a unidirectional flow.

### Recommended approach
- ViewModel or controller exposes immutable UI state
- UI sends intents/events upward
- orchestration layer handles side effects
- repositories and adapters feed data back as streams or callbacks

### UI state should include
- current tracking status
- current position estimate
- confidence
- scan freshness
- AP catalog freshness
- permission state
- error details
- last update time

### Design choice
This keeps the UI predictable and makes debugging much easier than chasing mutable state through four different classes and a prayer.

---

## 12. Error handling

Do not hide failures.

### Typical failure cases
- permission denied
- Wi-Fi unavailable
- scan throttled
- scan data empty
- AP catalog missing
- AP catalog stale
- insufficient APs for a stable estimate
- solver instability
- background worker failure
- renderer unavailable

### Required behavior
- return typed failures from repositories and engines
- show meaningful UI state
- log the failure with enough context
- keep the app usable if possible
- fail gracefully instead of crashing or silently producing nonsense

---

## 13. Testing strategy

### Unit tests
- positioning engine
- scan normalization
- catalog versioning
- graph validation
- confidence scoring
- error mapping

### Integration tests
- Wi-Fi adapter against mocked Android wrapper
- repository refresh flow
- tracking orchestration
- renderer stub interaction

### UI tests
- permission flow
- tracking flow
- no AP data state
- throttled-scan state
- error state
- live position update state

### Notes
Use fake data fixtures for RSSI scans and AP catalogs so positioning logic can be tested repeatedly and deterministically.

---

## 14. Code style and maintainability rules

- Use clear, descriptive names.
- Prefer small classes with one responsibility.
- Keep methods short.
- Keep models immutable where possible.
- Put comments only where the reasoning is non-obvious.
- Document interfaces and assumptions.
- Add examples to README/docs for module boundaries.
- Keep public APIs narrow.
- Avoid leaking Android classes into domain logic.
- Avoid “utility” dumping grounds.

### Documentation expectations
Each module should have:
- what it does
- what it depends on
- what it must not depend on
- how to test it
- what future changes it is designed to absorb

---

## 15. Build order

1. Define models and interfaces.
2. Build the AP catalog repository with local cache.
3. Build the Wi-Fi scanning adapter.
4. Build the positioning engine with fake data.
5. Add logging and diagnostics hooks.
6. Add the tracking controller / ViewModel.
7. Add the map renderer stub.
8. Wire permission and device-state flows.
9. Add tests.
10. Add polish, performance tuning, and UI refinement.

---

## 16. Final architecture summary

```text
Device Wi-Fi Scan
→ Wi-Fi Adapter
→ Scan Normalizer
→ Positioning Engine
→ Tracking Controller
→ UI State
→ Map Renderer Port (stub for now)

Remote AP Source
→ AP Catalog Repository
→ Local Cache
→ Positioning Engine

Node / Edge Graph
→ future pathfinding / multi-floor navigation
```

---

## 17. Developer Scope & Responsibilities

To ensure smooth collaboration and clear ownership, developers should adhere to the following scope:

- **Primary Focus**: Work exclusively on the native Android modules (Kotlin) including `app/`, `core/`, and native `feature/` modules as defined in the project structure.
- **Map Module Boundaries**: The React Native map module (`Arena_indoor_navigation`) is owned by a different team/teammate. Do **not** modify the internal logic, components, or styles of the RN module directly.
- **Inter-module Collaboration**:
    - If a change is required in the map module to support native features (e.g., a new bridge method or a specific data field), you must **suggest** the changes to the teammate rather than implementing them yourself.
    - Focus on defining and maintaining the **Native Bridge Contract** (Section 10).
- **Testing**: Test the native positioning and tracking logic using mocks or the `MapRendererBridge` interface to simulate the map module's behavior.
