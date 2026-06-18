# Implementation Steps Checklist

NOTE: Treat `android-app/` as the root of the Android project.

This document provides a sequential, step-by-step guide to implementing the Indoor Positioning Android app. Verify the **Expected Output** of each section before proceeding to the next.

## Section 1: Project Initialization & Core Models
- [ ] Initialize Android Studio project with Kotlin support.
- [ ] Set up a modular folder structure: `app/`, `core/`, `feature/`.
- [ ] Implement `core/common` with `Result` types and basic logging interfaces.
- [ ] Implement `core/model` with immutable data classes for:
    - `WifiScanReading` & `WifiScanSnapshot`
    - `AccessPointLocation` & `AccessPointCatalog`
    - `PositionEstimate` & `TrackingState`
    - `Node` & `Edge` (as defined in the plan)
- [ ] Set up Dependency Injection (e.g., Hilt or Koin) in the `app/` module.

**Expected Output**: Project compiles. All core data models are defined and tested for serialization/deserialization.

## Section 2: AP Catalog Module (Data Layer)
- [ ] Implement `LocalApCatalogDataSource` using Room or Proto DataStore.
- [ ] Implement `RemoteApCatalogDataSource` interface and a mock/real implementation (Retrofit).
- [ ] Build `AccessPointCatalogRepository` to handle the "local-first" logic and background refreshing.
- [ ] Implement version/timestamp comparison logic to avoid unnecessary updates.

**Expected Output**: Repository unit tests pass. Catalog can be loaded from cache and updated from a remote source without blocking the main thread.

## Section 3: Wi-Fi Scanning Module (Platform Layer)
- [ ] Implement `WifiScanSource` interface.
- [ ] Create `AndroidWifiScanner` using `WifiManager` and `BroadcastReceiver`.
- [ ] Implement normalization logic to convert `ScanResult` to `WifiScanSnapshot`.
- [ ] Add failure state handling (throttling, permissions, Wi-Fi disabled).
- [ ] Create a `FakeWifiScanner` for deterministic testing.

**Expected Output**: Scanning module can emit snapshots. Mock tests confirm that normalization and error handling work as expected.

## Section 4: Positioning Engine (Domain Layer)
- [ ] Implement the positioning pipeline components:
    - `SignalPreprocessor` (filtering weak signals)
    - `APMatcher` (matching scan results to catalog entries)
    - `MultilaterationSolver` (pure math implementation)
- [ ] Implement `PositionSmoother` (e.g., Moving Average or Kalman Filter).
- [ ] Build the `PositioningEngine` interface and implementation.
- [ ] Ensure the engine operates in 2D but preserves `floor_id`.

**Expected Output**: Engine unit tests pass using fake scan snapshots and a known AP catalog. Math results are accurate within expected error margins.

## Section 5: Logging & Diagnostics (Observability)
- [ ] Implement `AppLogger` using a structured logging approach.
- [ ] Create `DiagnosticsRecorder` to capture lifecycle events (scan sent, results received, etc.).
- [ ] Implement a `HealthHeartbeat` system for background workers.
- [ ] (Optional) Create a simple Debug Overlay or Log Screen in the UI.

**Expected Output**: Application logs are grep-able and contain session IDs, timestamps, and structured data for all major events.

## Section 6: Tracking Orchestration & UI State
- [ ] Implement `TrackingController` to coordinate scanner, engine, and repository.
- [ ] Create `TrackingViewModel` with a unidirectional state flow.
- [ ] Implement UI state representing tracking status, position, and diagnostics.
- [ ] Handle permission requests (Location, Wi-Fi) and device state changes.

**Expected Output**: UI displays "Scanning", "Positioning", or "Error" correctly. Position updates flow from the engine to the ViewModel.

## Section 7: React Native Bridge & Integration
- [ ] Set up React Native integration in the Android project.
- [ ] Create `MapRendererBridge` (Native Module) to expose positioning data to JS.
- [ ] Implement JSON serialization for passing models (`PositionEstimate`, `Node`, `Edge`) across the bridge.
- [ ] Embed `RNRootView` into a Fragment or Activity.

**Expected Output**: Native positioning data is successfully received and printed in the React Native console/UI.

## Section 8: Final Integration & Polish
- [ ] Implement the `NavigationGraph` storage and basic query logic.
- [ ] Wire background worker for periodic AP catalog updates.
- [ ] Conduct end-to-end integration tests (Mock scan -> Engine -> Bridge -> UI).
- [ ] Perform UI polish and performance tuning.

**Expected Output**: A fully functional APK that scans Wi-Fi, estimates position, and renders it on the map module.
