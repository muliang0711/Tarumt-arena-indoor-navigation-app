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
  - Toggle debug mode.
  - Open log panel.
- Observe ViewModel state and update UI.

Observed streams:

- `trackingState`
- `currentPosition`
- `apLocations`
- `nodes`
- `latestSnapshot`
- `isPaused` combined with `transitionState`

## TrackingViewModel

Responsibilities:

- Expose `TrackingController` state to the UI.
- Map repository catalog flow into:
  - `apLocations`
  - `nodes`
  - `fingerprints`
- Expose log entries from `InMemoryLogStore`.
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

`TrackingState` values rendered by the activity:

- `Idle`
- `LoadingCatalog`
- `Scanning`
- `Positioning`
- `Error`
- `Paused`

`StaleData` exists in the model but is not currently rendered with custom UI behavior.

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
