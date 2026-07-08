# TARUMT Arena Navigation: System Overview

This Android app estimates a user's indoor position inside the TARUMT Arena, where GPS is not reliable. The current runtime path uses Wi-Fi RSSI scans from the Android device, sends those scans to a remote KNN positioning service, and renders the returned coordinate on a calibrated floor plan.

The app is also a diagnostics tool. Debug mode can show known nodes, AP overlays when available, current scan readings, fingerprint comparisons, and an in-app log stream.

## Runtime Summary

1. `MainActivity` owns the tracking screen and asks for Wi-Fi/location permissions.
2. `TrackingViewModel` exposes `StateFlow` values to the activity and dialogs.
3. `TrackingController` starts a tracking session, refreshes the positioning catalog, and runs the scan loop.
4. `AndroidWifiScanner` requests Android Wi-Fi scans and emits `WifiScanSnapshot` values containing all detected APs plus readings filtered to the saved Settings SSID.
5. `FingerprintRepository` refreshes node and fingerprint data from the KNN API server.
6. `ApiPositioningEngine` posts each scan snapshot to the KNN API server and receives a `PositionEstimate` plus node-distance diagnostics.
7. `KnnDiagnosticsAnalyzer` locally replays the API-style KNN math against the same scan/catalog so developers can inspect nearest fingerprints, node distances, and weighted contributions.
8. `MapView`, `NodeDetailsDialogFragment`, `KnnDiagnosticsDialogFragment`, and `LogPanelDialogFragment` render the current estimate, debug data, and logs.

## Active Production Bindings

These are the bindings that determine the app's current behavior:

| Interface | Active implementation | Hilt module |
| --- | --- | --- |
| `WifiScanSource` | `AndroidWifiScanner` | `WifiModule` |
| `PositioningDataRepository` | `FingerprintRepository` | `DataModule` |
| `PositioningEngine` | `ApiPositioningEngine` | `PositioningModule` |
| `PositionSmoother` | `MovingAverageSmoother` | `PositioningModule` |
| `AppLogger` | `AndroidAppLogger` | `ObservabilityModule` |
| `CoroutineScope` | Application IO scope | `CoroutineModule` |

## Package Map

| Package | Responsibility |
| --- | --- |
| `config` | Global defaults and remote KNN endpoint constants. |
| `core.settings` | Saved runtime settings such as the editable Wi-Fi SSID filter. |
| `di` | Hilt bindings and providers. This is the first place to check for active implementations. |
| `core.model` | Shared domain models: scans, fingerprints, nodes, positions, catalog, tracking state. |
| `core.common` | Shared utility contracts such as `AppResult`, `AppError`, `AppLogger`, and `CoordinateConverter`. |
| `core.wifi` | Wi-Fi scan abstraction, Android scanner implementation, and fake scanner for tests/prototyping. |
| `core.apdata` | Positioning catalog data sources. The active source is the remote fingerprint repository. A Room-backed AP catalog path exists as an alternate/legacy path. |
| `core.positioning` | Positioning contracts and local algorithm implementations. The active engine is in `core.positioning.remote`. |
| `core.observability` | Diagnostics, in-memory logs, Logcat adapter, and heartbeat monitoring. |
| `feature.tracking` | UI-facing tracking feature: controller, ViewModel, custom map, dialogs, and adapters. |

## Important Current Facts

- The app currently calculates positions through `ApiPositioningEngine`, not the local `KnnWifiPositioningEngine`.
- `KnnWifiPositioningEngine` and `DefaultPositioningEngine` are still present as local alternatives, but Hilt does not bind them by default.
- `FingerprintRepository` fetches `/nodes` and `/fingerprints` from `GlobalConfig.KNN_API_BASE_URL`.
- `ApiPositioningEngine` sends scans to `/calcPosition` on the same KNN API base URL.
- `KnnDiagnosticsAnalyzer` mirrors the API server's WKNN logic locally for observability; it does not replace the active remote engine.
- The one-off scan workflow captures a single Wi-Fi scan, saves it under the app's internal `wifi-scans/` directory as JSON, runs positioning on that exact snapshot, and updates the KNN diagnostics panel.
- `DiagnosticsRecorder` is the primary visible logging path. It writes the same formatted log line to the in-app log store and to `AndroidAppLogger`, whose Android implementation also writes to stdout/stderr.
- Diagnostic log lines use `[timestamp] [Class.method] message | session=...` format.
- Android Wi-Fi scan results are filtered to SSID `TARUMT-ARENA` before they become domain scan readings.
- The map coordinate system is calibrated in `CoordinateConverter`, which maps navigation coordinates to pixels in `arena_second_floor_plan`.

## Documentation Maintenance Rule

These documents are part of the development workflow. When code changes package ownership, Hilt bindings, data flow, API contracts, UI behavior, or diagnostics behavior, update the relevant documentation in the same change. Start with `02_architecture_design.md` when trying to understand how pieces interact.
