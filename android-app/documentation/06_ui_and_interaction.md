# UI and Interaction

The tracking UI is built around `MainActivity`, `TrackingViewModel`, and custom Android Views/fragments in `feature.tracking`.

## MainActivity

Responsibilities:

- Inflate `ActivityMainBinding`.
- Load the `arena_second_floor_plan` drawable into `MapView`.
- Inject and pass `CoordinateConverter` to `MapView`.
- Request required permissions:
  - `ACCESS_FINE_LOCATION`
  - `ACCESS_WIFI_STATE`
  - `CHANGE_WIFI_STATE`
- Wire buttons:
  - Start/stop tracking, including checked-node mode selection on start.
  - Pause/resume scanning.
  - Run a one-off scan, save JSON, and position that scan.
  - Open node-selection dialog for checked/unchecked KNN nodes.
  - Open KNN diagnostics.
  - Toggle debug mode.
  - Open log panel.
- Observe ViewModel state and update UI.

Observed streams:

- `trackingState`
- `currentPosition`
- `apLocations`
- `nodes`
- `latestSnapshot`
- `knnDiagnostics`
- `lastSavedScanPath`
- `isOneOffScanRunning`
- `checkedNodeIds`
- `nearbyNodeSelection`
- `isPaused` combined with `transitionState`

## TrackingViewModel

Responsibilities:

- Expose `TrackingController` state to the UI.
- Map repository catalog flow into:
  - `apLocations`
  - `nodes`
  - `fingerprints`
- Expose log entries from `InMemoryLogStore`.
- Expose KNN diagnostic replay reports and one-off scan status.
- Expose and update checked-node selection.
- Initialize the checked-node selection to all loaded nodes until the user saves a custom selection.
- Own debug-mode toggle state.
- Own pause/resume transition state for button feedback.

The ViewModel does not calculate positions itself; it delegates to `TrackingController`.

## TrackingController UI Contract

The controller exposes:

- `state: StateFlow<TrackingState>`
- `isPaused: StateFlow<Boolean>`
- `latestSnapshot: StateFlow<WifiScanSnapshot?>`
- `currentPosition: StateFlow<PositionEstimate?>`
- `nodeDistances: StateFlow<Map<String, Double>>?`
- `knnDiagnostics: StateFlow<KnnDiagnosticReport?>`
- `lastSavedScanPath: StateFlow<String?>`
- `isOneOffScanRunning: StateFlow<Boolean>`
- `checkedNodeIds: StateFlow<Set<String>>`

`TrackingState` values rendered by the activity:

- `Idle`
- `LoadingCatalog`
- `Scanning`
- `Positioning`
- `Error`
- `Paused`

`StaleData` exists in the model but is not currently rendered with custom UI behavior.

## Tracking Mode Selection

When the user taps Start Tracking from `Idle` or `Error`, `MainActivity` opens a mode picker:

- Dynamic checked nodes list: starts tracking with the nearby-node selector, dynamic threshold, and phone sensor inputs.
- Fixed checked nodes list: starts tracking with the manually saved Settings checked-node list and does not run the dynamic threshold updater.

When tracking is already active, the same button stops tracking immediately.

## One-Off Scan Control

Button:

- `oneOffScanButton`

Behavior:

1. Checks the same Wi-Fi/location permissions as tracking.
2. Calls `TrackingViewModel.runOneOffScan()`.
3. `TrackingController.runOneOffScan()` refreshes the catalog, requests one fresh scan, saves the scan JSON, computes a KNN diagnostic replay, and runs the active remote positioning engine.
4. Saves a KNN diagnostics JSON artifact under public Documents in `Arena Navigation/knn-diagnostics/` on Android 10+.
5. The button is disabled and renamed while the scan is running.
6. The map position, latest scan, log panel, and KNN diagnostics panel update from the one-off result.

The one-off flow refuses to run while continuous tracking is active; stop tracking first.

## Settings Dialog

Button:

- `settingsButton`

Purpose:

- Edit the SSID used to filter Wi-Fi readings for positioning.
- Set the base threshold for nodes considered close during active tracking.
- Choose the manual checked-node selection used by one-off scans and as the active-tracking seed/fallback.
- Make it fast to toggle nearby node clusters while still allowing individual node edits.

Behavior:

1. Opens an `AlertDialog` with editable Filter SSID and close-node threshold fields plus a scrollable node checkbox list.
2. Shows group checkboxes first, then individual node checkboxes.
3. Edits temporary SSID, threshold, and node-selection values while the dialog is open.
4. Applies the SSID, threshold, and checked-node selection only when Save is tapped.
5. Cancel closes the dialog without applying changes.

Groups:

- `node-16` through `node-20` plus `node-1`.
- `kongdi-1` through `kongdi-20` plus `node-1` and `node-2`.
- `node-12` through `node-15` plus `node-2` and `west-of-TA246door-opp-TA254`.

Group semantics:

- Checking a group checks all currently loaded nodes in that group.
- Unchecking a group unchecks all currently loaded nodes in that group.
- A group checkbox is checked only when all of its currently loaded member nodes are checked.
- Overlapping nodes, such as `node-1` and `node-2`, update every affected group after each toggle.

The saved filter SSID is read by `AndroidWifiScanner` when processing Android scan results. `WifiScanSnapshot.readings` contains APs matching that SSID and is used for positioning; `WifiScanSnapshot.allReadings` contains every AP detected by the phone scan for diagnostics.

For continuous tracking in dynamic mode, the saved checked-node set seeds the session, then `TrackingController` automatically updates `checkedNodeIds` to nearby nodes using the latest estimate, the saved close-node threshold, and phone heading/walking-speed data. Automatic node and threshold changes are logged. When tracking stops, the visible checked-node state returns to the manual Settings selection.

For continuous tracking in fixed mode, `TrackingController` sends the saved checked-node set from Settings on every scan. This matches the old continuous-tracking behavior and the one-off scan behavior.

For one-off scans, the automatic updater is not used. The saved checked-node set is sent directly in `PositioningRequest.checkedNodeIds`, and local KNN diagnostics filter the catalog to the same manually selected nodes.

## Log Panel AP Toggle

The Detected APs section in `LogPanelDialogFragment` has two modes:

- All detected APs: displays `WifiScanSnapshot.allReadings`.
- Filtered APs: displays only readings from `allReadings` whose SSID matches the saved filter SSID.

## KNN Diagnostics Dialog

Class:

- `KnnDiagnosticsDialogFragment`

Purpose:

- Explain the current scan's KNN positioning process and make poor positioning accuracy easier to debug.

Displayed summary:

- Scan timestamp.
- K value and missing-signal penalty.
- Total/used/ignored live readings.
- Catalog fingerprint/node counts.
- Active API estimate.
- Local replay estimate.
- Floor weights.
- Saved one-off JSON path when available.
- Saved one-off diagnostics JSON path when available.
- Top-k nearest fingerprints with distance, normalized weight, and BSSID overlap counts.
- Count of all fingerprint distances included in the saved diagnostics report.

Ranked node list:

- Best fingerprint distance per node.
- Best scan id.
- Fingerprint count at the node.
- Matched BSSID count.
- Fingerprint APs missing from the current scan.
- Current-scan APs absent from the fingerprint.
- Whether the node contributed to the selected top-k neighbor set.
- Contribution bar based on normalized KNN weight.

Supporting classes:

- `KnnDiagnosticsAdapter`
- `KnnDiagnosticReport`
- `KnnNodeDiagnostic`
- `KnnNeighborDiagnostic`

## MapView

Class:

- `feature.tracking.MapView`

Responsibilities:

- Draw the floor plan bitmap.
- Draw the current user position.
- Draw the active nearby-node threshold around the current user estimate.
- In debug mode, draw nodes and AP overlays.
- In debug mode, highlight checked nodes differently from unchecked nodes.
- Support pan and pinch zoom with `GestureDetector` and `ScaleGestureDetector`.
- Detect taps on nodes/APs in debug mode.

Rendering order:

1. Floor plan image.
2. Active nearby-node threshold.
3. Debug nodes, with checked nodes highlighted.
4. Debug APs and estimated AP signal radius when AP readings exist.
5. User position.

Coordinate conversion:

- Uses `CoordinateConverter.toPixels(node.x, node.y)` to convert node `coordinates.lh` into
  floor-plan pixels. Estimated positions retain their normal top-level `x`/`y` values.
- Converts tap screen coordinates back through the current image matrix before hit testing.

Debug interactions:

- Tapping a node opens `NodeDetailsDialogFragment`.
- Tapping an AP opens an `AlertDialog` with BSSID, current RSSI, frequency, coordinates, floor, and metadata.

## NodeDetailsDialogFragment

Purpose:

- Inspect one node's fingerprint profile against the latest live Wi-Fi scan.

Inputs:

- Node id argument.
- `TrackingViewModel.nodes`
- `TrackingViewModel.fingerprints`
- `TrackingViewModel.latestSnapshot`

Displayed data:

- Node title and metadata.
- RSSI distribution per BSSID from saved fingerprints.
- Latest live RSSI marker for each BSSID when available.
- Grayed-out state when an AP exists in fingerprints but is missing from the latest scan.
- Euclidean distance between the averaged node fingerprint and the latest live scan.
- Latest scan update time.

Supporting classes:

- `FingerprintAdapter`
- `FingerprintComparisonItem`
- `RssiDistributionView`

## LogPanelDialogFragment

Purpose:

- Show the tracking diagnostics stream and the latest scan's AP readings.

Displayed data:

- Log entries from `InMemoryLogStore`.
- Current AP readings from `latestSnapshot.readings`.

Supporting classes:

- `LogAdapter`
- `ApStatusAdapter`

Interaction details:

- The log list preserves manual scroll position.
- It auto-scrolls only when already at the bottom.
- AP status rows can expand to show frequency, SSID, and metadata.

## Coordinate Calibration

Class:

- `core.common.CoordinateConverter`

The converter maps the navigation coordinate system to pixels on the second-floor plan. Current calibration is hardcoded:

- Origin pixel maps to navigation `(0, 0)`.
- One x calibration point defines `scaleX`.
- One y calibration point defines `scaleY`.
- Pixel y increases downward, while navigation y increases upward, so y conversion is inverted.

If the floor plan image changes, update `CoordinateConverter` and then verify:

- Node dots align with known physical locations.
- User position appears on the correct floor-plan area.
- Tap hit detection still matches visible nodes/APs.

## UI Debug Data Availability

- Nodes and fingerprints are available when `FingerprintRepository` successfully loads remote data.
- AP locations are usually empty in the active runtime path because the active catalog is fingerprint/node based.
- AP overlays become useful if the Room-backed AP catalog path is made active or if the remote fingerprint catalog begins populating `AccessPointCatalog.locations`.
