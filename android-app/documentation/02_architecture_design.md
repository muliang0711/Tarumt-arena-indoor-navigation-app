# Architecture Design

## Architectural Pattern: MVVM + Clean Architecture
The application follows a simplified Clean Architecture pattern combined with MVVM (Model-View-ViewModel) for the UI layer.

### 1. Presentation Layer (UI)
- **`MainActivity`**: The entry point. It manages the lifecycle of the UI components and observes the `TrackingViewModel`.
- **`MapView`**: A custom View responsible for rendering the map, user position, and debug information (APs, Nodes).
- **`TrackingViewModel`**: Orchestrates the data flow for the tracking screen. It exposes state via Kotlin `StateFlow` and handles user actions by delegating to the `TrackingController`.

### 2. Controller / Use Case Layer
- **`TrackingController`**: Acts as a central orchestrator for the positioning process. It manages the lifecycle of the tracking session (Start/Stop/Pause/Resume), coordinates between the Wi-Fi scanner and the positioning engine, and updates the system state.

### 3. Core / Domain Layer
- **Interfaces**: Defines the contracts for the system's core capabilities:
    - `PositioningEngine`: Interface for calculating positions.
    - `WifiScanSource`: Interface for hardware Wi-Fi scanning.
    - `PositioningDataRepository`: Interface for accessing fingerprint and AP data.
- **Domain Models**: Data classes in `com.hyandlh.tarumtarenanavigation.core.model` that represent the state of the world (e.g., `PositionEstimate`, `WifiScanSnapshot`).

### 4. Infrastructure / Data Layer
- **`AndroidWifiScanner`**: Implementation of `WifiScanSource` using Android's `WifiManager`.
- **`KnnWifiPositioningEngine`**: Implementation of `PositioningEngine` using the Weighted K-Nearest Neighbors algorithm.
- **`FingerprintRepository`**: Manages the loading of Wi-Fi fingerprint data from local assets.
- **`ApDatabase` & `ApDao`**: Room database for caching Access Point locations fetched from a remote API.

## Data Flow (Reactive Pattern)
The system heavily utilizes Kotlin Coroutines and Flows for a reactive data flow:
1. **Scanning**: `AndroidWifiScanner` emits `WifiScanSnapshot` into a `SharedFlow`.
2. **Processing**: `TrackingController` collects snapshots, combines them with the latest `AccessPointCatalog`, and calls the `PositioningEngine`.
3. **Updating**: `PositioningEngine` updates its internal `currentPosition` `StateFlow`.
4. **UI Update**: `TrackingViewModel` observes the position flow and emits a new state to the UI.

## Dependency Injection
The project uses **Dagger Hilt** for dependency injection. Modules are located in the `di` package:
- `WifiModule`: Binds the `AndroidWifiScanner`.
- `PositioningModule`: Binds the `KnnWifiPositioningEngine` and `PositionSmoother`.
- `DataModule`: Provides database, API services, and binds the repository.
- `ObservabilityModule`: Provides logging and diagnostic tools.
