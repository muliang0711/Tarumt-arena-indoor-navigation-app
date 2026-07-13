# Observability and Diagnostics

The app records diagnostics for developer visibility and user-facing debug tools. Observability is intentionally lightweight: Logcat/stdout, an in-memory log buffer, KNN replay diagnostics, saved one-off scan JSON, and heartbeat checks.

## Core Classes

| Class | Responsibility |
| --- | --- |
| `DiagnosticsRecorder` | Records session events, scan events, catalog refresh messages, positioning results, remote positioning messages, and errors. |
| `DiagnosticLogFormatter` | Produces the canonical `[timestamp] [Class.method] message` log line. |
| `InMemoryLogStore` | Stores recent log entries in a `StateFlow` for the in-app log panel. |
| `LogEntry` | Timestamped log message with level. |
| `AndroidAppLogger` | Bridges `AppLogger` to Android Logcat and stdout/stderr. |
| `HealthHeartbeat` | Tracks component heartbeats and logs warnings for stale components. |
| `KnnDiagnosticsAnalyzer` | Replays the API-style WKNN process locally for explainability. |

## Log Format

The canonical visible log format is:

```text
[yyyy-MM-dd HH:mm:ss.SSS] [Class.method] message | session={uuid} | key=value
```

`DiagnosticsRecorder` writes the same rendered line to:

- `InMemoryLogStore`, displayed by `LogPanelDialogFragment`.
- `AndroidAppLogger`, which writes to Android Logcat.
- stdout/stderr through `AndroidAppLogger`.

Most recorder methods infer the origin from the call stack. Coroutine-heavy call sites can pass `source` explicitly so the origin remains readable.

## DiagnosticsRecorder

Injected dependencies:

- `AppLogger`
- `InMemoryLogStore`

Common calls:

- `startNewSession()`: starts a new UUID session and logs `SessionStarted`.
- `recordCatalogUpdate(status)`: logs repository refresh progress.
- `recordScanRequest(timestamp)`: logs Android scan requests.
- `recordScanResult(timestamp, count)`: logs scan completion and reading count.
- `recordPositionCalculated(x, y, confidence)`: logs successful position estimates.
- `recordRemotePositioning(success, latencyMs, error)`: logs remote positioning latency and status.
- `recordError(error, throwable, metadata)`: logs scanner, catalog, API, and workflow failures.
- `recordEvent(event, metadata)`: generic structured event hook.
- `recordMessage(message)`: direct formatted message hook.

## In-Memory Log Store

Class:

- `InMemoryLogStore`

Behavior:

- Holds `StateFlow<List<LogEntry>>`.
- Uses incrementing IDs for stable RecyclerView item IDs.
- Keeps at most 1000 entries.
- Supports `clear()`, although the current UI does not expose a clear action.

UI consumer:

- `LogPanelDialogFragment` observes `TrackingViewModel.logs`.
- `LogAdapter` displays the stored formatted line directly; it does not prepend a second timestamp.
- `LogAdapter` renders level-specific colors.
- The log panel auto-scrolls only if the user was already at the bottom.

## Health Heartbeats

Class:

- `HealthHeartbeat`

Started by:

- `ArenaNavigationApplication.onCreate()`

Current configuration:

- Check interval: 30000 ms.
- Unhealthy threshold: 60000 ms.

Heartbeat producers:

- `AndroidWifiScanner` beats `WifiScanner` after scan results are processed.
- `ApiPositioningEngine` beats `ApiPositioningEngine` after a successful remote calculation.
- Local alternate engines beat `PositioningEngine` if bound and used.

Important behavior:

- Routine heartbeat debug lines are formatted and written to Logcat/stdout.
- Stale heartbeat warnings are also copied to `InMemoryLogStore`.
- `HealthHeartbeat` logs stale-component warnings only for components that have already produced at least one heartbeat.

## Diagnostic Flow During Tracking

```text
TrackingController.startTracking()
  -> DiagnosticsRecorder.startNewSession()
  -> recordCatalogUpdate("Fetching latest...")
  -> FingerprintRepository.refreshCatalog()
  -> recordCatalogUpdate("Complete")

Scan loop
  -> AndroidWifiScanner.requestScan()
  -> recordScanRequest()
  -> Android scan receiver processes result
  -> HealthHeartbeat.beat("WifiScanner")
  -> TrackingController records scan result count

Positioning
  -> TrackingController filters the catalog to active checked nodes
  -> TrackingController runs KnnDiagnosticsAnalyzer
  -> recordEvent("KNN diagnostic trace updated")
  -> ApiPositioningEngine records API call event
  -> API returns estimate and node distances
  -> recordRemotePositioning(success, latencyMs)
  -> recordPositionCalculated()
  -> HealthHeartbeat.beat("ApiPositioningEngine")
  -> recordEvent("Automatic checked_nodes update") when active tracking changes nodes or threshold

UI
  -> TrackingViewModel exposes logs and KNN diagnostics
  -> LogPanelDialogFragment renders logs
  -> KnnDiagnosticsDialogFragment renders the KNN replay
```

## One-Off Scan Diagnostics

The one-off scan workflow logs:

- Session start.
- Catalog refresh progress and failures.
- Scan request and scan completion.
- Saved JSON path and reading count.
- KNN diagnostic replay update.
- Checked-node count included in positioning events.
- Remote positioning latency and result.

One-off scan diagnostics do not include automatic checked-node updates because one-off scans use the manually saved Settings selection.

## Automatic Checked-Node Diagnostics

Continuous tracking logs every automatic checked-node or dynamic-threshold change with:

- `checkedNodes`
- `checkedNodeIds`
- `thresholdMeters`
- `baseThresholdMeters`
- `directionalLookaheadMeters`
- `headingDegrees`
- `walkingSpeedMetersPerSecond`
- `motionSource`
- `nearestFallback`

The same active threshold is drawn on `MapView` around the current user estimate. Checked nodes are highlighted in the debug node layer so the visual state matches the `checkedNodeIds` sent to the positioning request.

The saved scan JSON gives a stable input artifact for reproducing or comparing API behavior.

## KNN Process Diagnostics

`KnnDiagnosticsAnalyzer` reconstructs the KNN process locally using the active scan and the checked-node-filtered catalog:

- RSSI readings used and ignored.
- Fingerprints and nodes compared.
- Top-k nearest fingerprints.
- Per-neighbor distance and normalized weight.
- Per-node best distance and BSSID overlap counts.
- Per-node contribution percentage.
- Local replay estimate for comparison with the API estimate.

Known limitation:

- The API server still returns only `estimate` and `nodeDistances`; detailed KNN process visibility is reconstructed locally in the Android app.
