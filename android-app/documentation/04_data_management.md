# Data Management

The app has two data-management paths in the codebase. The active path is remote fingerprint/node data. A Room-backed AP-location catalog exists as an alternate path for AP-location based positioning.

## Active Repository: FingerprintRepository

Class:

- `core.apdata.repository.FingerprintRepository`

Binding:

- `DataModule.bindPositioningDataRepository()`

Responsibilities:

- Implement `PositioningDataRepository`.
- Hold the latest `AccessPointCatalog?` in a `MutableStateFlow`.
- Load data on initialization using the application IO coroutine scope.
- Refresh data when `TrackingController.startTracking()` calls `refreshCatalog()`.
- Fetch nodes and fingerprints from the remote KNN API server.

Remote calls:

- `GET {KNN_API_BASE_URL}/{KNN_API_ENDPOINT_GETNODEREGISTRY}` returns `Map<String, Node>`.
- `GET {KNN_API_BASE_URL}/{KNN_API_ENDPOINT_GETALLFINGERPRINTS}` returns `List<FingerprintEntry>`.

Catalog produced:

```kotlin
AccessPointCatalog(
    version = "fingerprint-1.0",
    fingerprints = fingerprints,
    nodes = nodeRegistry,
    lastUpdated = System.currentTimeMillis()
)
```

Current caveats:

- Network and parsing failures are printed with `println`; they are not currently surfaced as `AppResult.Failure`.
- `refreshCatalog()` returns `AppResult.Success(Unit)` after calling `loadDataRemote()`, even if the remote load fails internally.
- A local asset fallback function exists in the repository, but it is not currently called by the active load path.

## PositioningDataRepository Contract

File:

- `core.apdata.repository.PositioningDataRepository`

API:

- `getCatalogFlow(): Flow<AccessPointCatalog?>`
- `refreshCatalog(): AppResult<Unit>`

Consumers:

- `TrackingController` uses it to refresh and combine catalog data with scan snapshots.
- `TrackingViewModel` maps it into AP locations, nodes, and fingerprints for UI/debug screens.

## AccessPointCatalog Model

File:

- `core.model.AccessPointCatalog`

Fields:

- `version`: source/version marker.
- `locations`: BSSID to `AccessPointLocation`, used by AP-location based positioning/debug overlays.
- `fingerprints`: saved RSSI fingerprints, used by local KNN and node-details UI.
- `nodes`: node id to `Node`, used by positioning and map/debug UI.
- `lastUpdated`: epoch milliseconds when the catalog was assembled.

## Fingerprint and Node Models

Files:

- `core.model.Fingerprint`
- `core.model.Node`

`FingerprintEntry` stores:

- `locationId`: normally a node id.
- `timestamp`: when the sample was collected.
- `scanId`: scan identifier.
- `apList`: BSSID/RSSI/channel entries.

`Node` stores:

- `nodeId`
- `floorId`
- `x`, `y`
- `type`: `DESTINATION`, `JUNCTION`, `STAIRS`, or `ELEVATOR`
- optional display `name`
- `enabled`
- metadata

## Alternate Room-Backed AP Catalog

Classes:

- `AccessPointCatalogRepository`
- `ApDatabase`
- `ApDao`
- `ApLocationEntity`
- `ApApiService`
- `MockApApiService`
- mapper extensions in `Mappers.kt`

This path stores known AP locations in the `arena_navigation_db` Room database, table `ap_locations`.

Flow:

1. `AccessPointCatalogRepository.refreshCatalog()` calls `ApApiService.getLatestCatalog()`.
2. The current Hilt provider returns `MockApApiService` for this API.
3. DTOs are mapped to `ApLocationEntity`.
4. Existing AP rows are cleared and replaced.
5. `getCatalogFlow()` maps Room rows to `AccessPointCatalog.locations`.

This repository is not currently bound to `PositioningDataRepository`, so it is inactive unless `DataModule` is changed.

## Retrofit Setup

`DataModule` provides a singleton Retrofit instance with base URL `http://localhost:8080/`. Because `PositioningApiService` methods use Retrofit `@Url`, the effective URLs for active KNN calls come from `GlobalConfig`, not from the Retrofit base URL.

## Data Ownership Rule

Data-source classes belong under `core.apdata`. Positioning algorithms belong under `core.positioning`. If a class fetches, caches, maps, or exposes catalog data, keep it in `core.apdata` even if its data is consumed by a positioning algorithm.
