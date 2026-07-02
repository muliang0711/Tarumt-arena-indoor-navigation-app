# System Overview: TARUMT Arena Navigation

## Introduction
The TARUMT Arena Navigation app is an indoor positioning and navigation system designed for the TARUMT Arena. It uses Wi-Fi RSSI (Received Signal Strength Indication) fingerprinting to estimate the user's location within the building where GPS is unreliable.

## Core Purpose
- **Indoor Positioning**: Real-time estimation of user coordinates (X, Y) on a floor plan.
- **Wi-Fi Fingerprinting**: Utilizing a pre-collected database of Wi-Fi signal strengths at known locations (Nodes).
- **Navigation Support**: Providing the foundation for pathfinding by tracking the user's proximity to various navigation nodes.

## Key Modules
The project is organized into several functional modules within the `com.hyandlh.tarumtarenanavigation` package:

- **`core.wifi`**: Interfaces with the Android system to perform Wi-Fi scans and stream results.
- **`core.positioning`**: The "brain" of the app. It contains the algorithms (like WKNN) that turn raw Wi-Fi scans into coordinate estimates.
- **`core.apdata`**: Manages the positioning data, including the Access Point catalog and fingerprint database, handling both remote fetching and local Room-based caching.
- **`core.model`**: Defines the domain entities used across the application (PositionEstimate, Node, WifiScanSnapshot, etc.).
- **`core.observability`**: A cross-cutting concern that handles logging, diagnostics, and system health heartbeats.
- **`feature.tracking`**: The UI layer that coordinates the scanning process and renders the user's position on a custom map view.

## High-Level Interaction
1. The **TrackingController** triggers the **WifiScanSource**.
2. **AndroidWifiScanner** performs the hardware scan and emits a **WifiScanSnapshot**.
3. The **TrackingController** passes this snapshot and the cached **AccessPointCatalog** to the **PositioningEngine**.
4. **KnnWifiPositioningEngine** calculates a **PositionEstimate** using the WKNN algorithm.
5. The **TrackingViewModel** observes these estimates and updates the **MapView** in the **MainActivity**.
