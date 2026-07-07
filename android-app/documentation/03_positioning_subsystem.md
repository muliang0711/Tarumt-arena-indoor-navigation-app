# Positioning Subsystem

The positioning subsystem is the core of the application, responsible for transforming raw Wi-Fi signals into spatial coordinates.

## Core Components

### 1. Wi-Fi Scanning (`core.wifi`)
- **`WifiScanSource`**: Interface defining the stream of Wi-Fi results.
- **`AndroidWifiScanner`**: Uses `WifiManager` to request scans and listens for results via a `BroadcastReceiver`. It converts system `ScanResult` objects into the domain `WifiScanSnapshot` model.

### 2. Positioning Engine (`core.positioning`)
The system supports multiple positioning strategies via the `PositioningEngine` interface.

#### Weighted K-Nearest Neighbors (WKNN)
Implemented in `KnnWifiPositioningEngine`, this is the primary algorithm used:
1. **Preprocessing**: Filters out weak signals (RSSI < -90dBm).
2. **Euclidean Distance Calculation**: Compares the current scan against the fingerprint database.
3. **Neighbor Selection**: Finds the `K` (default 3) closest fingerprints.
4. **Weighted Averaging**: Computes the final position by weighting neighbors based on inverse distance ($w = 1 / (d + \epsilon)$).
5. **Confidence Estimation**: Heuristic based on the distance to the nearest neighbor.

#### Multilateration (Legacy/Alternative)
Implemented in `DefaultPositioningEngine` using `MultilaterationSolver`:
- Uses a Weighted Centroid approach based on the known locations of Access Points.
- Weights are derived from RSSI using an exponential model ($10^{RSSI/10}$).

### 3. Signal Processing & Smoothing
- **`SignalPreprocessor`**: Cleans raw data by removing noise and weak signals.
- **`PositionSmoother`**: Implemented as `MovingAverageSmoother`, it maintains a sliding window of recent estimates to reduce "jitter." It automatically resets if a floor change is detected to prevent interpolation between floors.

## Mathematical Models

### Euclidean Distance
The distance between a live scan ($L$) and a fingerprint ($F$) is calculated as:
$$d = \sqrt{\sum_{i=1}^{n} (RSSI_{L,i} - RSSI_{F,i})^2}$$
Where $RSSI_{i}$ is the signal strength of BSSID $i$. If a BSSID is missing from one of the sets, a penalty value (-100dBm) is used.

### Inverse Distance Weighting
$$X_{est} = \frac{\sum w_i x_i}{\sum w_i}, \quad Y_{est} = \frac{\sum w_i y_i}{\sum w_i}$$
Where $w_i = 1 / (dist_i + 0.1)$.
