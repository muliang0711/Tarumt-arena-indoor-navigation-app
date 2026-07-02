# Data Management

The application manages two primary types of data for positioning: Access Point (AP) locations and Wi-Fi Fingerprints.

## 1. Positioning Data Repository (`core.apdata`)
The system uses the `PositioningDataRepository` interface to decouple the positioning engine from specific data sources.

### Access Point Locations (Centroid/Multilateration)
- **`AccessPointCatalogRepository`**: Manages AP locations used for geometric positioning.
- **Remote Source**: Fetches data from `ApApiService` (currently a `MockApApiService` for prototyping).
- **Local Cache**: Uses **Room Persistence Library** (`ApDatabase`, `ApDao`) to store `ApLocationEntity` objects. This ensures the app can function offline after an initial sync.
- **Sync Logic**: `refreshCatalog()` fetches the latest data from the API, clears the local database, and inserts new records.

### Wi-Fi Fingerprints (WKNN)
- **`FingerprintRepository`**: Specifically designed for the WKNN engine.
- **Data Source**: Loads a static JSON file from the application assets (`wifiscans-25Jun2026.json`).
- **Structure**: Maps a `location_id` (representing a `Node`) to a list of observed BSSIDs and their average RSSI values.

## 2. Domain Models (`core.model`)
- **`AccessPointCatalog`**: The top-level container for all positioning data. It includes:
    - `locations`: A map of BSSID to `AccessPointLocation`.
    - `fingerprints`: A list of `FingerprintEntry`.
    - `nodes`: A map of `nodeId` to `Node` (representing physical points of interest/junctions).
- **`Node`**: Represents a specific physical point in the Arena (e.g., "TA/244 door"). Includes floor ID and (X, Y) coordinates.

## 3. Storage Layer Details
- **Database**: `arena_navigation_db`
- **Tables**: `ap_locations`
- **Mappers**: `com.hyandlh.tarumtarenanavigation.core.apdata.repository.Mappers.kt` contains extension functions to convert between Remote DTOs, Database Entities, and Domain Models.

## 4. Initialization & Lifecycle
- The data is typically loaded or refreshed when the user starts a tracking session via the `TrackingController`.
- The `PositioningDataRepository` exposes data as a `Flow<AccessPointCatalog?>`, allowing the UI and positioning engine to reactively update when new data is available.
