# Observability and Diagnostics

The app records diagnostics for both developer visibility and user-facing debug tools. Observability is intentionally lightweight: Logcat, an in-memory log buffer, and heartbeat checks.

## Core Classes

| Class | Responsibility |
| --- | --- |
| `DiagnosticsRecorder` | Records session events, scan events, catalog refresh messages, positioning results, remote positioning messages, and errors. |
| `InMemoryLogStore` | Stores recent log entries in a `StateFlow` for the in-app log panel. |
| `LogEntry` | Timestamped log message with level. |
| `AndroidAppLogger` | Bridges `AppLogger` to Android Logcat. |
| `HealthHeartbeat` | Tracks component heartbeats and logs warnings for stale components. |

## DiagnosticsRecorder

Injected dependencies:

- `AppLogger`
- `InMemoryLogStore`

Behavior:

- Generates a new UUID session id when `startNewSession()` is called.
- Writes structured messages to Logcat through `AppLogger`.
- Adds short user/developer-visible messages to `InMemoryLogStore`.

Common calls:

- `startNewSession()`: called when tracking starts.
- `recordCatalogUpdate(status)`: called around repository refresh.
- `recordScanRequest(timestamp)`: called when Android scan is requested.
- `recordScanResult(timestamp, count)`: called when scan readings are available.
- `recordPositionCalculated(x, y, confidence)`: called after positioning succeeds.
- `recordError(error, throwable, metadata)`: called for scanner, catalog, or API failures.
- `recordEvent(event, metadata)`: generic event hook, used by the remote positioning engine.
- `recordMessage(message)`: direct message to the in-memory log store.

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

Important caveat:

- `HealthHeartbeat` logs stale-component warnings only for components that have already produced at least one heartbeat.

## Diagnostic Flow During Tracking

```text
TrackingController.startTracking()
  -> DiagnosticsRecorder.startNewSession()
  -> recordCatalogUpdate("Fetching latest...")
  -> repository.refreshCatalog()
  -> recordCatalogUpdate("Complete")

Scan loop
  -> AndroidWifiScanner.requestScan()
  -> recordScanRequest()
  -> Android scan receiver processes result
  -> HealthHeartbeat.beat("WifiScanner")
  -> TrackingController records scan result count

Positioning
  -> ApiPositioningEngine records API call event
  -> API returns estimate and node distances
  -> recordPositionCalculated()
  -> HealthHeartbeat.beat("ApiPositioningEngine")

UI
  -> TrackingViewModel exposes logs
  -> LogPanelDialogFragment renders them
```

## Known Gaps

- `FingerprintRepository` currently prints load failures instead of using `DiagnosticsRecorder`.
- The remote engine has a `recordRemotePositioning()` helper available through `DiagnosticsRecorder`, but it currently uses generic events and errors.
- Some internal diagnostic messages use `println`; replacing these with `AppLogger` or `DiagnosticsRecorder` would make diagnostics consistent.
