# Observability and Diagnostics

The application includes a robust observability layer to monitor positioning performance, track system health, and provide real-time feedback for debugging.

## 1. Diagnostics Recorder (`core.observability`)
The `DiagnosticsRecorder` is the primary entry point for recording high-level system events.
- **Session Tracking**: Generates a unique `UUID` for each tracking session to correlate logs.
- **Event Logging**: Captures key lifecycle events like "SessionStarted", "PositioningFailed", and "CatalogUpdate".
- **Structured Metadata**: Allows attaching key-value pairs to events for deeper analysis (e.g., recording why a scan failed).

## 2. In-Memory Log Store
Used to display real-time logs within the application UI (e.g., the Log Panel).
- **`LogEntry`**: Data class representing a single log line with a timestamp, message, and level (`INFO`, `ERROR`, `WARNING`, `DEBUG`).
- **`InMemoryLogStore`**: A singleton that holds a list of `LogEntry` objects in a `StateFlow`. It maintains a maximum buffer (1000 entries) to prevent memory issues.

## 3. Health Monitoring
The `HealthHeartbeat` class ensures that critical background components are still functioning.
- **Heartbeats**: Components like `AndroidWifiScanner` and `KnnWifiPositioningEngine` call `beat()` whenever they successfully complete a task.
- **Monitoring**: A background job periodically checks the time since the last heartbeat for each component.
- **Alerting**: If a component misses its heartbeat for a defined threshold (e.g., 60 seconds), a warning is logged.

## 4. Real-time Diagnostics Flow
1. **Source**: An event occurs in the `PositioningEngine` or `WifiScanner`.
2. **Recording**: `diagnostics.recordPositionCalculated(...)` is called.
3. **Storage**: The event is passed to the `InMemoryLogStore`.
4. **UI Update**: `TrackingViewModel` observes the `logStore.logs` flow.
5. **Display**: The `LogPanelDialogFragment` displays the logs to the developer in a `RecyclerView`.

## 5. Implementation Details
- **`AppLogger`**: A simple abstraction over `android.util.Log` to allow for potential redirection or filtering.
- **Integration**: Injected via Hilt into almost all core services to ensure consistent monitoring across the codebase.
