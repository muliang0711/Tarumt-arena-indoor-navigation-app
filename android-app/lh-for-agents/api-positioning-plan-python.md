# Implementation Plan: Remote Positioning API (Python)

This plan outlines the steps to migrate the positioning logic from the Android app to a remote Python API server and integrate it back into the app using a new `PositioningEngine` implementation.

## 1. Goal
- Develop an API server in `api-server/` using Python and FastAPI that replicates `KnnWifiPositioningEngine` logic.
- Implement a `POST /calc-position` endpoint.
- Create `ApiPositioningEngine` in the Android app to delegate calculations to the server.

---

## 2. API Server Implementation (`api-server/`)

### Technology Stack
- **Language**: Python 3.10+
- **Framework**: FastAPI
- **Asynchronous Server**: Uvicorn
- **Serialization/Validation**: Pydantic v2
- **Database**: PostgreSQL (using SQLAlchemy or SQLModel)

### Data Models
Mirror the Android project's models using Pydantic `BaseModel`:
- `WifiScanReading`: `bssid` (str), `rssi` (int), `timestamp` (int), `frequency` (int), `ssid` (str), `metadata` (dict).
- `WifiScanSnapshot`: `timestamp` (int), `readings` (list[WifiScanReading]), `metadata` (dict).
- `PositionEstimate`: `x` (float), `y` (float), `floor_id` (str), `confidence` (float), `timestamp` (int), `diagnostics` (dict).
- `PositioningResponse`: Contains `PositionEstimate` and a dictionary of `node_distances`.

### Core Logic (WKNN)
Replicate `KnnWifiPositioningEngine.kt` logic in Python:
1. **Filtering**: Ignore readings with RSSI < -90.
2. **Euclidean Distance**: 
   - Calculate distance between live scan and all stored fingerprints.
   - Use a penalty of -100 for missing BSSIDs (consistent with `DistanceUtils`).
3. **Node Distances**: For each node, find the minimum distance to its associated fingerprints.
4. **Weighted K-Nearest Neighbors**:
   - Pick top $k=3$ neighbors.
   - Use inverse distance weighting ($w = 1 / (dist + 0.1)$).
5. **Coordinate Averaging**: Compute weighted X, Y and determine the best floor.

---

## 3. Android App Integration

### 3.1 API Service Definition
Create a Retrofit interface:
```kotlin
interface PositioningApiService {
    @POST("calc-position")
    suspend fun calculatePosition(@Body snapshot: WifiScanSnapshot): PositioningResponse
}
```

### 3.2 `ApiPositioningEngine` Implementation
Create a new class `ApiPositioningEngine` implementing `PositioningEngine`:
- **Dependencies**: `PositioningApiService`, `PositionSmoother`, `DiagnosticsRecorder`, `HealthHeartbeat`.
- **Behavior**:
  - `calculatePosition`: Sends the `WifiScanSnapshot` to the API.
  - Updates `_currentPosition` with the smoothed result.
  - Updates `_nodeDistances` with the values returned from the API.

### 3.3 Dependency Injection
Update `PositioningModule.kt` to bind the new engine:
```kotlin
@Binds
@Singleton
abstract fun bindPositioningEngine(
    engine: ApiPositioningEngine
): PositioningEngine
```

---

## 4. Implementation Steps

### Phase 1: API Server
1. Initialize FastAPI project in `api-server/` with `main.py` and `requirements.txt`.
2. Implement Pydantic data models and positioning logic (translating logic from the Android Kotlin source).
3. Export the current fingerprint catalog from `app/src/main/assets/wifiscans-25Jun2026-rssi-neg90-or-above.json` to a JSON file or database for the Python server.
4. Add the `POST /calc-position` route.

### Phase 2: Android Networking
1. Add Retrofit and Kotlinx Serialization (or Gson) dependencies if not already present.
2. Define `PositioningResponse` DTO to include both the estimate and node distances.
3. Implement `PositioningApiService`.

### Phase 3: Android Engine Migration
1. Implement `ApiPositioningEngine`.
2. Update Dagger Hilt bindings to use `ApiPositioningEngine`.
3. Update `DiagnosticsRecorder` to log remote API latency and success/failure.

### Phase 4: Validation
1. Run local integration tests comparing `KnnWifiPositioningEngine` results with `ApiPositioningEngine` results for the same scan data.
2. Verify real-time updates in the `MapView` and `NodeDetailsDialogFragment`.
