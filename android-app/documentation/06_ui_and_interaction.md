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
  - Start/stop tracking.
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

## One-Off Scan Control

Button:

- `oneOffScanButton`

Behavior:

1. Checks the same Wi-Fi/location permissions as tracking.
2. Calls `TrackingViewModel.runOneOffScan()`.
3. `TrackingController.runOneOffScan()` refreshes the catalog, requests one fresh scan, saves the scan JSON, computes a KNN diagnostic replay, and runs the active remote positioning engine.
4. The button is disabled and renamed while the scan is running.
5. The map position, latest scan, log panel, and KNN diagnostics panel update from the one-off result.

The one-off flow refuses to run while continuous tracking is active; stop tracking first.

## Settings Dialog

Button:

- `settingsButton`

Purpose:

- Edit the SSID used to filter Wi-Fi readings for positioning.
- Choose which nodes are active for one-off scans and continuous tracking.
- Make it fast to toggle nearby node clusters while still allowing individual node edits.

Behavior:

1. Opens an `AlertDialog` with an editable Filter SSID field and a scrollable node checkbox list.
2. Shows group checkboxes first, then individual node checkboxes.
3. Edits temporary SSID and node-selection values while the dialog is open.
4. Applies both the SSID and checked-node selection only when Save is tapped.
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

The saved filter SSID is read by `AndroidWifiScanner` when processing Android scan results. `WifiScanSnapshot.readings` contains APs matching that SSID and is used for positioning; `WifiScanSnapshot.allReadings` contains every AP detected by the phone scan for diagnostics. The saved checked-node set is included in the remote `PositioningRequest.checkedNodeIds` for both one-off scans and continuous tracking. Local KNN diagnostics filter the catalog to the same checked nodes before replaying the KNN process.

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
- Top-k nearest fingerprints with distance, normalized weight, and BSSID overlap counts.

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
- In debug mode, draw nodes and AP overlays.
- Support pan and pinch zoom with `GestureDetector` and `ScaleGestureDetector`.
- Detect taps on nodes/APs in debug mode.

Rendering order:

1. Floor plan image.
2. Debug nodes.
3. Debug APs and estimated AP signal radius when AP readings exist.
4. User position.

Coordinate conversion:

- Uses `CoordinateConverter.toPixels(x, y)` to convert navigation coordinates into floor-plan pixels.
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
