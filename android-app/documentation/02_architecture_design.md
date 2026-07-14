# Architecture Design

The app follows a pragmatic MVVM plus clean-ish layering style. The boundaries are defined less by formal modules and more by package ownership, Hilt interfaces, and reactive `Flow` contracts.

## Main Layers

### Presentation Layer

Files:

- `MainActivity`
- `feature.tracking.TrackingViewModel`
- `feature.tracking.MapView`
- `feature.tracking.NodeDetailsDialogFragment`
- `feature.tracking.KnnDiagnosticsDialogFragment`
- `feature.tracking.LogPanelDialogFragment`
- UI adapters in `feature.tracking`

Responsibilities:

- Request permissions.
- Render tracking status, pause/resume controls, one-off scan controls, debug toggle, map, node details, KNN diagnostics, scan readings, and log stream.
- Render active checked-node and close-threshold overlays on `MapView`.
- Prompt for dynamic or fixed checked-node mode when the user starts tracking.
- Observe state exposed by `TrackingViewModel`.
- Avoid direct Wi-Fi, repository, or positioning work.

### Tracking Orchestration Layer

File:

- `feature.tracking.TrackingController`

Responsibilities:

- Own the tracking session lifecycle.
- Refresh the positioning catalog when tracking starts.
- Start and stop the Wi-Fi scan loop.
- Start and stop phone motion monitoring for active tracking.
- Combine catalog data and scan snapshots.
- Keep the saved manual checked-node selection separate from the automatic active-tracking checked-node selection.
- Update active-tracking checked nodes to nearby nodes using the latest estimate, Settings threshold, heading, and walking-speed estimate.
- In fixed checked-node mode, skip the automatic updater and send the saved manual Settings selection on every continuous scan.
- Call the active `PositioningEngine`.
- Compute local KNN diagnostic replays for observability.
- Save one-off scan snapshots as JSON.
- Publish current state, latest scan snapshot, current position, pause state, node distances, KNN diagnostics, one-off scan status, and last saved scan path.
- Publish the latest active nearby-node selection so the map can draw the dynamic threshold.

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
- `core.motion.MotionSensorMonitor`
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
  -> User chooses dynamic checked nodes or fixed checked nodes
  -> TrackingViewModel.startTracking(mode)
  -> TrackingController.startTracking(mode)
  -> MotionSensorMonitor.startMonitoring() only in dynamic mode
  -> TrackingController seeds checkedNodeIds from the manual Settings selection
  -> FingerprintRepository.refreshCatalog()
      -> GET {KNN_API_BASE_URL}/nodes
      -> GET {KNN_API_BASE_URL}/fingerprints
      -> AccessPointCatalog(fingerprints, nodes)
  -> TrackingController.startScanLoop()
      -> AndroidWifiScanner.requestScan()
      -> Android WifiManager + BroadcastReceiver
      -> WifiScanSnapshot(readings filtered to TARUMT-ARENA)
  -> TrackingController combines catalog + snapshot
  -> Dynamic mode: NearbyNodeSelector updates checkedNodeIds from the latest estimate when available
  -> Fixed mode: TrackingController keeps checkedNodeIds equal to the manual Settings selection
  -> KnnDiagnosticsAnalyzer.analyze(snapshot, catalog filtered to checked nodes)
      -> local replay of checked-node API-style WKNN distances, weights, and estimate
  -> ApiPositioningEngine.calculatePosition(snapshot, catalog, checkedNodeIds)
      -> POST {KNN_API_BASE_URL}/calcPosition
         body includes timestamp, readings, metadata, checkedNodeIds
      -> PositioningResponse(estimate, nodeDistances)
  -> Dynamic mode: NearbyNodeSelector updates checkedNodeIds for the next active tracking scan
  -> TrackingViewModel exposes state
  -> MainActivity and dialogs render updates
  -> MapView draws the dynamic threshold and checked-node highlights
```

## One-Off Scan Flow

```text
User taps Scan once, save JSON, position
  -> MainActivity permission gate
  -> TrackingViewModel.runOneOffScan()
  -> TrackingController.runOneOffScan()
  -> FingerprintRepository.refreshCatalog()
  -> AndroidWifiScanner.requestScan()
  -> TrackingController receives one fresh WifiScanSnapshot
  -> WifiScanSnapshotStore.save(snapshot)
      -> app internal files/wifi-scans/wifi-scan-{timestamp}.json
  -> KnnDiagnosticsAnalyzer.analyze(snapshot, catalog filtered to manually saved checked nodes)
  -> ApiPositioningEngine.calculatePosition(snapshot, catalog, manual checkedNodeIds)
  -> KnnDiagnosticsJsonStore.save(artifact)
      -> public Documents/Arena Navigation/knn-diagnostics/knn-diagnostics-{timestamp}.json on Android 10+
  -> Map, KNN diagnostics, logs, and current position update
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
- Local KNN diagnostic replay through `KnnDiagnosticsAnalyzer`.
- Active-tracking nearby-node selection through `NearbyNodeSelector` and `MotionSensorMonitor`.
- One-off scan JSON persistence through `WifiScanSnapshotStore`.
- One-off KNN diagnostics JSON persistence through `KnnDiagnosticsJsonStore`.

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
| Active nearby-node threshold | `TrackingController.nearbyNodeSelection` | `MapView` threshold overlay |
| Checked nodes | `TrackingController.checkedNodeIds` | `MapView` checked-node highlight, Settings dialog |
| KNN diagnostic replay | `TrackingController.knnDiagnostics` | `KnnDiagnosticsDialogFragment` |
| Last saved scan path | `TrackingController.lastSavedScanPath` | `KnnDiagnosticsDialogFragment`, logs |
| Last saved diagnostics path | `TrackingController.lastSavedDiagnosticsPath` | `KnnDiagnosticsDialogFragment`, logs |
| One-off scan running flag | `TrackingController.isOneOffScanRunning` | `MainActivity` |
| Catalog nodes/fingerprints/AP locations | `PositioningDataRepository.getCatalogFlow()` via `TrackingViewModel` | `MapView`, node details |
| Logs | `InMemoryLogStore.logs` | `LogPanelDialogFragment` |
