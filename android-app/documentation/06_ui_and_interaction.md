# UI and Interaction

The user interface is designed to provide a real-time visualization of the positioning process, allowing for both end-user navigation and developer debugging.

## 1. Main Dashboard (`MainActivity`)
The `MainActivity` serves as the primary container for the tracking experience.
- **Status Monitoring**: Displays the current system state (Scanning, Positioning, Paused, etc.) using a status bar and color-coded text.
- **Control Interface**: Provides buttons to Start/Stop tracking and Pause/Resume Wi-Fi scanning.
- **Debug Toggle**: A switch that enables/disables the "Debug Mode" on the map, revealing infrastructure details.

## 2. Custom Map Engine (`MapView`)
The `MapView` is a custom Android `View` that handles the rendering of the floor plan and positioning data using a `Canvas`.

### Rendering Layers
1. **Background**: Renders the floor plan image (`arena_second_floor_plan.jpg`).
2. **Infrastructure (Debug Only)**:
    - **Nodes**: Green circles representing physical points in the fingerprint database.
    - **Access Points**: Red circles representing known AP locations.
    - **Signal Radius**: Dashed circles around APs representing estimated distance based on RSSI (used for Multilateration debugging).
3. **User Position**: A blue circle representing the current `PositionEstimate`.

### Interaction & Transformation
- **Pan & Zoom**: Supports multi-touch gestures (pinch-to-zoom) and scrolling using `ScaleGestureDetector` and `GestureDetector`.
- **Coordinate Conversion**: Uses the `CoordinateConverter` to translate between Android pixel coordinates and the navigation coordinate system (meters).
- **Hit Detection**: Handles single taps to identify and select APs or Nodes.

## 3. Detailed Inspection
The UI provides deep-dive tools for troubleshooting:

### Node Details (`NodeDetailsDialogFragment`)
When a user taps a Node in debug mode, this dialog provides:
- **Node Metadata**: ID, Floor, Type, and Coordinates.
- **Fingerprint Comparison (RSSI Distribution)**: A scrollable list of APs. Each item includes:
    - **BSSID**: The unique identifier of the Access Point.
    - **RSSI Distribution Graph**: A dotted plot showing the frequency of different RSSI values recorded at this node in the fingerprint database.
    - **Real-time Signal Line**: A red vertical line indicating the RSSI of the AP in the *latest* Wi-Fi scan, updated in real-time.
    - **Presence State**: APs found in the database but missing from the latest scan are grayed out to help identify signal drop-outs or changes in the environment.
- **Real-time distance**: Calculates the live Euclidean distance between the current signal profile and the node's saved fingerprint.

### Log Panel (`LogPanelDialogFragment`)
Provides a scrolling view of all system events recorded by the `DiagnosticsRecorder`. This is essential for monitoring the background cycle of "Scan -> Match -> Solve" without needing a computer attached.

## 4. Resource Calibration
The map coordinates are calibrated based on specific anchor points defined in `CoordinateConverter.kt`. These points map physical meters in the Arena to pixel offsets in the high-resolution floor plan image.
