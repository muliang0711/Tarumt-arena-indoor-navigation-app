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
- Refresh data when `TrackingController.runOneOffScan()` runs a one-off positioning attempt.
- Fetch nodes and fingerprints from the remote KNN API server.

Remote calls:

- `GET {KNN_API_BASE_URL}/{KNN_API_ENDPOINT_GETNODEREGISTRY}` returns `Map<String, Node>`.
- `GET {KNN_API_BASE_URL}/{KNN_API_ENDPOINT_GETALLFINGERPRINTS}` returns `List<FingerprintEntry>`.

The app always loads the full node/fingerprint catalog. Checked-node selection is stored in `TrackingController` and applied later when local KNN diagnostics run and when `ApiPositioningEngine` sends `PositioningRequest.checkedNodeIds` to `/calcPosition`.

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

- A local asset fallback function exists in the repository, but it is not currently called by the active load path.

Failure behavior:

- Remote HTTP, network, serialization, and unexpected failures are logged through `DiagnosticsRecorder`.
- `refreshCatalog()` returns `AppResult.Failure` when remote loading fails, allowing `TrackingController` to surface an error state.

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
- optional `sessionId`: collection-session identifier.
- optional `orientation`: phone orientation during collection; legacy fingerprints use `unknown`.

`Node` stores:

- `nodeId`
- `floorId`
- `coordinates.lh.x/y`: the Android navigation and map coordinate frame.
- `coordinates.xy.x/y`: the future Flutter coordinate frame retained for explicit diagnostics/contracts.
- `type`: `DESTINATION`, `JUNCTION`, `STAIRS`, or `ELEVATOR`
- optional display `name`
- `enabled`
- metadata

For compatibility with existing Android call sites, `Node.x` and `Node.y` are computed accessors
that always return `coordinates.lh.x` and `coordinates.lh.y`. Gson reads and writes only the nested
`coordinates` object; it does not serialize legacy top-level node `x` or `y` fields.

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

## One-Off Scan JSON Storage

Class:

- `core.wifi.WifiScanSnapshotStore`
- `core.positioning.KnnDiagnosticsJsonStore`

Behavior:

- `WifiScanSnapshotStore` saves a `WifiScanSnapshot` as JSON using Gson.
- `KnnDiagnosticsJsonStore` saves one-off KNN diagnostics artifacts to public Documents under `Arena Navigation/knn-diagnostics/knn-diagnostics-{timestamp}.json` on Android 10+ through MediaStore. Older devices fall back to app-specific external Documents. The artifact includes the scan JSON path, checked-node ids, API estimate, local replay report, and `allFingerprintDistances`.
- Writes files to the app's internal files directory under `wifi-scans/`.
- Uses filename `wifi-scan-{snapshot.timestamp}.json`.
- Returns the absolute file path, which is stored in `TrackingController.lastSavedScanPath` and logged through diagnostics.

This storage path is app-internal. On a development device or emulator, retrieve files through Android Studio Device Explorer or `adb` using the app package's internal files directory.

## Data Ownership Rule

Data-source classes belong under `core.apdata`. Positioning algorithms belong under `core.positioning`. If a class fetches, caches, maps, or exposes catalog data, keep it in `core.apdata` even if its data is consumed by a positioning algorithm.
