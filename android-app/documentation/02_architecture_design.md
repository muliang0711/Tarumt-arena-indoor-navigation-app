# Architecture Design

The app follows a pragmatic MVVM plus clean-ish layering style. The boundaries are defined less by formal modules and more by package ownership, Hilt interfaces, and reactive `Flow` contracts.

## Main Layers

### Presentation Layer

Files:

- `MainActivity`
- `feature.tracking.TrackingViewModel`
- `feature.tracking.MapView`
- `feature.tracking.NodeDetailsDialogFragment`
- `feature.tracking.LogPanelDialogFragment`
- UI adapters in `feature.tracking`

Responsibilities:

- Request permissions.
- Render tracking status, pause/resume controls, debug toggle, map, node details, scan readings, and log stream.
- Observe state exposed by `TrackingViewModel`.
- Avoid direct Wi-Fi, repository, or positioning work.

### Tracking Orchestration Layer

File:

- `feature.tracking.TrackingController`

Responsibilities:

- Own the tracking session lifecycle.
- Refresh the positioning catalog when tracking starts.
- Start and stop the Wi-Fi scan loop.
- Combine catalog data and scan snapshots.
- Call the active `PositioningEngine`.
- Publish current state, latest scan snapshot, current position, pause state, and node distances.

The controller is a singleton and uses its own `CoroutineScope(SupervisorJob() + Dispatchers.Default)` for background tracking work.

### Domain and Core Contracts

Files:

- `core.model.*`
- `core.wifi.WifiScanSource`
- `core.apdata.repository.PositioningDataRepository`
- `core.positioning.PositioningEngine`
- `core.common.*`

Responsibilities:

- Define stable data structures and interfaces.
- Keep UI code independent from scanner, data-source, and algorithm implementations.

### Infrastructure Layer

Files:

- `core.wifi.AndroidWifiScanner`
- `core.apdata.repository.FingerprintRepository`
- `core.positioning.remote.ApiPositioningEngine`
- `core.positioning.remote.PositioningApiService`
- `core.observability.*`
- Room and mock AP catalog classes under `core.apdata`

Responsibilities:

- Integrate Android Wi-Fi APIs.
- Integrate Retrofit API calls.
- Provide data persistence or mocks where available.
- Record logs, events, and health checks.

## Active Data Flow

```text
User taps Start
  -> MainActivity
  -> TrackingViewModel.toggleTracking()
  -> TrackingController.startTracking()
  -> FingerprintRepository.refreshCatalog()
      -> GET {KNN_API_BASE_URL}/nodes
      -> GET {KNN_API_BASE_URL}/fingerprints
      -> AccessPointCatalog(fingerprints, nodes)
  -> TrackingController.startScanLoop()
      -> AndroidWifiScanner.requestScan()
      -> Android WifiManager + BroadcastReceiver
      -> WifiScanSnapshot(readings filtered to TARUMT-ARENA)
  -> TrackingController combines catalog + snapshot
  -> ApiPositioningEngine.calculatePosition(snapshot, catalog)
      -> POST {KNN_API_BASE_URL}/calcPosition
      -> PositioningResponse(estimate, nodeDistances)
  -> TrackingViewModel exposes state
  -> MainActivity and dialogs render updates
```

## Hilt Dependency Injection

The `di` package is the source of truth for active implementations:

- `WifiModule` binds `WifiScanSource` to `AndroidWifiScanner`.
- `DataModule` binds `PositioningDataRepository` to `FingerprintRepository`, provides Room objects, Retrofit, mock AP API service, and `PositioningApiService`.
- `PositioningModule` binds `PositioningEngine` to `ApiPositioningEngine` and `PositionSmoother` to `MovingAverageSmoother`.
- `ObservabilityModule` binds `AppLogger` to `AndroidAppLogger`.
- `CoroutineModule` provides the singleton application IO coroutine scope used by `FingerprintRepository`.

## Active vs Alternate Paths

Active:

- Remote fingerprint/node catalog through `FingerprintRepository`.
- Remote position calculation through `ApiPositioningEngine`.
- Debug node-distance values from the remote positioning response.

Alternate or currently unbound:

- `KnnWifiPositioningEngine`: local weighted KNN implementation using catalog fingerprints.
- `DefaultPositioningEngine`: local weighted-centroid/multilateration style implementation using known AP locations.
- `AccessPointCatalogRepository`: Room-backed AP location catalog repository.
- `MockApApiService`: mock AP-location API for the Room-backed catalog path.
- `FakeWifiScanner`: scanner test double.

When changing which algorithm or data source is active, update the Hilt module first, then update these docs.

## State Ownership

| State | Owner | Consumers |
| --- | --- | --- |
| Tracking lifecycle state | `TrackingController.state` | `TrackingViewModel`, `MainActivity` |
| Pause/resume state | `TrackingController.isPaused`, `TrackingViewModel.transitionState` | `MainActivity` |
| Latest scan snapshot | `TrackingController.latestSnapshot` | `MapView`, log panel, node details |
| Current position | Active `PositioningEngine.currentPosition` exposed by `TrackingController` | `MapView`, status timestamp |
| Catalog nodes/fingerprints/AP locations | `PositioningDataRepository.getCatalogFlow()` via `TrackingViewModel` | `MapView`, node details |
| Logs | `InMemoryLogStore.logs` | `LogPanelDialogFragment` |
