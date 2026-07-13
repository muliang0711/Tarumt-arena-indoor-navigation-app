# Positioning Subsystem

The positioning subsystem turns a `WifiScanSnapshot` into a `PositionEstimate`. The active implementation delegates this calculation to a remote KNN API server, while local algorithm implementations remain in the codebase for development, fallback, or future switching.

## Core Contracts and Models

- `PositioningEngine`: contract for position calculation and current-position observation.
- `PositionEstimate`: x/y coordinate, floor id, confidence, timestamp, and optional diagnostics.
- `WifiScanSnapshot`: timestamp plus a list of `WifiScanReading` values.
- `AccessPointCatalog`: container for AP locations, fingerprints, nodes, and metadata.
- `Node`: named physical point on a floor, used by fingerprint locations and debug UI.
- `FingerprintEntry`: saved signal profile for a `locationId`.

## Active Engine: Remote API Positioning

Class:

- `core.positioning.remote.ApiPositioningEngine`

Binding:

- `PositioningModule.bindPositioningEngine()`

Flow:

1. `TrackingController` receives a non-empty `WifiScanSnapshot` and non-null `AccessPointCatalog`.
2. `ApiPositioningEngine.calculatePosition()` builds the endpoint from `GlobalConfig.KNN_API_BASE_URL` and `GlobalConfig.KNN_API_ENDPOINT_CALCPOSITION`.
3. The engine posts the full `WifiScanSnapshot` to `PositioningApiService.calculatePosition()`.
4. The server returns `PositioningResponse`.
5. The engine updates `currentPosition` with `response.estimate`.
6. The engine updates `nodeDistances` with `response.nodeDistances`.
7. Diagnostics include request URL, reading count, latency, raw estimate, node-distance count, failures, and heartbeat events.

The smoother is injected but currently not applied in `ApiPositioningEngine`; `finalEstimate` is assigned directly from the raw API estimate.

## KNN Diagnostic Replay

Class:

- `core.positioning.KnnDiagnosticsAnalyzer`

Models:

- `core.model.KnnDiagnosticReport`
- `core.model.KnnNeighborDiagnostic`
- `core.model.KnnNodeDiagnostic`

Purpose:

- Explain how the API-style WKNN result was produced without needing the server to return a verbose trace.
- Compare the active API estimate with a local replay using the same `WifiScanSnapshot` and `AccessPointCatalog`.
- Rank nodes by closest fingerprint distance.
- Show the top-k selected fingerprints, each distance, each inverse-distance weight, and each weighted contribution.

Replay algorithm:

1. Use only live readings with RSSI >= -90 dBm.
2. Convert the live scan and each fingerprint to BSSID-to-RSSI maps.
3. Calculate Euclidean distance with `DistanceUtils.PENALTY_RSSI = -100.0` for missing BSSIDs.
4. Sort every fingerprint by distance.
5. Select `k = 3`.
6. Calculate `weight = 1 / (distance + 0.1)` for selected fingerprints whose nodes exist.
7. Normalize weights to contribution percentages.
8. Produce a local replay `PositionEstimate`.
9. Produce node summaries with best distance, matched BSSID count, missing-from-scan count, extra-from-scan count, selected-neighbor count, and contribution percentage.

Consumers:

- `TrackingController` updates `knnDiagnostics` during both continuous tracking and one-off scans.
- `KnnDiagnosticsDialogFragment` visualizes the report.

## Remote API Contract Used by the App

Configured in `GlobalConfig`:

- Base URL: `KNN_API_BASE_URL`
- Calculate position: `KNN_API_ENDPOINT_CALCPOSITION`
- Get fingerprints: `KNN_API_ENDPOINT_GETALLFINGERPRINTS`
- Get node registry: `KNN_API_ENDPOINT_GETNODEREGISTRY`

Retrofit interface:

- `POST @Url calculatePosition(@Body PositioningRequest): PositioningResponse`
- `GET @Url getAllFingerprints(): List<FingerprintEntry>`
- `GET @Url getNodeRegistry(): Map<String, Node>`

The use of dynamic `@Url` means Retrofit's base URL in `DataModule` is only a default placeholder; the actual runtime URLs are assembled from `GlobalConfig`.

`PositioningRequest` is the live `WifiScanSnapshot` fields plus `checkedNodeIds`. `TrackingController` owns both the saved manual checked-node selection and the active checked-node set sent to `ApiPositioningEngine`. The API server uses that list as the active node registry for the KNN calculation.

During continuous tracking, the active checked-node set is updated automatically from the latest `PositionEstimate`. `NearbyNodeSelector` selects enabled nodes on the same floor within the Settings close-node threshold, expands that threshold using walking speed, and includes forward nodes using the phone heading. If no node is inside the dynamic range, it falls back to the nearest node so the API request never becomes empty because of the selector.

One-off scans bypass the automatic nearby-node selector and use the manually saved checked-node selection from Settings.

## Wi-Fi Scan Preparation

Class:

- `core.wifi.AndroidWifiScanner`

Behavior:

- Requests scans through Android `WifiManager.startScan()`.
- Waits for `WifiManager.SCAN_RESULTS_AVAILABLE_ACTION`.
- Emits a `WifiScanSnapshot` through a replaying `SharedFlow`.
- Stores all detected AP readings in `WifiScanSnapshot.allReadings`.
- Filters positioning readings to `SettingsRepository.filterSsid`, defaulting to `GlobalConfig.DEFAULT_FILTER_SSID`.
- Maps each result to `WifiScanReading` with BSSID, RSSI, timestamp, frequency, and SSID.
- Emits `WifiScanFailure` values for missing permissions, Wi-Fi disabled, throttling, and unknown errors.

## Alternate Local Engine: Weighted KNN

Class:

- `core.positioning.KnnWifiPositioningEngine`

This engine is not the active Hilt binding, but it can calculate positions locally from `AccessPointCatalog.fingerprints` and `AccessPointCatalog.nodes`.

Algorithm:

1. Ignore live readings weaker than -90 dBm.
2. Compute Euclidean RSSI distance between the live scan and every fingerprint.
3. Group distances by fingerprint `locationId` to publish node-distance diagnostics.
4. Take the nearest `k = 3` fingerprints.
5. Use inverse-distance weighting, `1 / (distance + 0.1)`, over node coordinates.
6. Pick the floor with the largest cumulative neighbor weight.
7. Estimate confidence from the nearest neighbor distance.
8. Apply `PositionSmoother`.

Distance calculation is centralized in `DistanceUtils`. Missing BSSIDs use `PENALTY_RSSI = -100.0`.

## Alternate Local Engine: Weighted Centroid

Class:

- `core.positioning.DefaultPositioningEngine`

This path is also not the active Hilt binding. It is intended for AP-location based positioning:

1. `SignalPreprocessor` removes readings weaker than -90 dBm.
2. `APMatcher` matches scan BSSIDs to `AccessPointCatalog.locations`.
3. `MultilaterationSolver` calculates a weighted centroid.
4. `PositionSmoother` reduces jitter.
5. Node distances are calculated geometrically from the estimate.

`MultilaterationSolver` converts RSSI to a simple linear weight with `10^(RSSI / 10)`.

## Smoothing

Class:

- `MovingAverageSmoother`

Behavior:

- Maintains the last 3 position estimates.
- Averages x, y, and confidence.
- Resets history when floor id changes to avoid smoothing across floors.

Current caveat:

- The active remote engine injects this smoother but does not currently use it.

## Diagnostics Produced by Positioning

- `DiagnosticsRecorder.recordPositionCalculated()` logs successful position calculations.
- `DiagnosticsRecorder.recordEvent()` records remote API calls, KNN diagnostic replay updates, one-off scan lifecycle events, and failures.
- `DiagnosticsRecorder.recordRemotePositioning()` records remote API latency and success/failure state.
- `HealthHeartbeat.beat("ApiPositioningEngine")` marks the remote engine as healthy after successful calculations.
- `PositioningEngine.nodeDistances` feeds the node details/debug experience when available.
