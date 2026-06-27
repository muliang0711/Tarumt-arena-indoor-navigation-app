This implementation plan outlines the creation of a Weighted K-Nearest Neighbors (WKNN) positioning engine. It maps Wi-Fi scan results against a fingerprint database to estimate the user's coordinates by interpolating between the most similar signal patterns.
1. Architectural Components
   We will create a new implementation called KnnPositioningEngine. This requires three main data structures:
1.
Fingerprint Reference Map: A processed version of the JSON database for fast lookup.
2.
Node Registry: A mapping of location_id to Node objects (providing coordinates).
3.
Distance Metric: A mathematical function (Euclidean distance) to compare signal strengths.
2. Implementation Plan
   Phase 1: Data Models & Pre-processing
   We need a structure to represent the fingerprint in a searchable format.
   •
   Fingerprint Class: Store a location_id and a Map<BSSID, RSSI>.
   •
   Normalization: Since Wi-Fi scans are sporadic, missing APs in a scan should be assigned a default "penalty" value (e.g., -100 dBm) to ensure vector lengths match during comparison.
   Phase 2: Loading the Database
   The engine must ingest the JSON database and the Node list.
   •
   Input: wifi-rssi-fingerprint-database-mock.json.
   •
   Coord Mapping: Initialize a Map<String, Node> where keys are location_id. This allows the engine to immediately turn a "match" into (x, y, floor) coordinates.
   Phase 3: The KNN Algorithm
   For every incoming WifiScanSnapshot:
1.
Vector Construction: Convert the snapshot into a map of BSSID -> RSSI.
2.
Distance Calculation: For every fingerprint in the database:
◦
Calculate the Euclidean distance: $d = \sqrt{\sum (RSSI_{scan} - RSSI_{fingerprint})^2}$
3.
Sort and Select: Pick the $K$ fingerprints with the smallest distances (usually $K=3$ or $4$).
4.
Weighted Averaging (WKNN):
◦
Assign weights based on inverse distance ($w_i = 1 / d_i$).
◦
The final position is the weighted average of the $K$ nodes' coordinates:
▪
$X_{final} = \frac{\sum (w_i \cdot x_i)}{\sum w_i}$
▪
$Y_{final} = \frac{\sum (w_i \cdot y_i)}{\sum w_i}$
3. Proposed Implementation
   Kotlin
   package com.hyandlh.tarumtarenanavigation.core.positioning

import com.hyandlh.tarumtarenanavigation.core.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlin.math.pow
import kotlin.math.sqrt

class KnnWifiPositioningEngine(
private val fingerprintDb: List<FingerprintEntry>, // Parsed from JSON
private val nodeRegistry: Map<String, Node>,     // location_id -> Node
private val k: Int = 3,
private val penaltyRssi: Double = -100.0
) : PositioningEngine {

    private val _currentPosition = MutableStateFlow<PositionEstimate?>(null)
    override val currentPosition = _currentPosition.asStateFlow()

    override fun calculatePosition(
        snapshot: WifiScanSnapshot,
        catalog: AccessPointCatalog
    ): PositionEstimate {
        
        // 1. Calculate distances to all fingerprints
        val distances = fingerprintDb.map { fingerprint ->
            val dist = calculateEuclideanDistance(snapshot.apList, fingerprint.apList)
            fingerprint.locationId to dist
        }.sortedBy { it.second }.take(k)

        // 2. Weight and Average Coordinates
        val estimate = calculateWeightedAverage(distances)
        
        _currentPosition.value = estimate
        return estimate
    }

    private fun calculateEuclideanDistance(
        liveScan: List<AccessPoint>, 
        databaseScan: List<FingerprintAP>
    ): Double {
        val allBssids = (liveScan.map { it.bssid } + databaseScan.map { it.bssid }).distinct()
        var sumSquaredDiff = 0.0

        for (bssid in allBssids) {
            val rssi1 = liveScan.find { it.bssid == bssid }?.rssi?.toDouble() ?: penaltyRssi
            val rssi2 = databaseScan.find { it.bssid == bssid }?.rssi?.toDouble() ?: penaltyRssi
            sumSquaredDiff += (rssi1 - rssi2).pow(2)
        }
        return sqrt(sumSquaredDiff)
    }

    private fun calculateWeightedAverage(neighbors: List<Pair<String, Double>>): PositionEstimate {
        var totalWeight = 0.0
        var sumX = 0.0
        var sumY = 0.0
        val floorCounts = mutableMapOf<String, Int>()

        neighbors.forEach { (locId, dist) ->
            val node = nodeRegistry[locId] ?: return@forEach
            // Use inverse distance weighting; add small epsilon to avoid div by zero
            val weight = 1.0 / (dist + 0.1) 
            
            sumX += node.x * weight
            sumY += node.y * weight
            totalWeight += weight
            floorCounts[node.floorId] = floorCounts.getOrDefault(node.floorId, 0) + 1
        }

        // Determine floor by majority vote of top K neighbors
        val bestFloor = floorCounts.maxByOrNull { it.value }?.key ?: "unknown"

        return PositionEstimate(
            x = sumX / totalWeight,
            y = sumY / totalWeight,
            floorId = bestFloor,
            accuracy = neighbors.firstOrNull()?.second?.toFloat() ?: 0f
        )
    }
}

// Supporting data classes for the internal DB structure
data class FingerprintEntry(
val locationId: String,
val apList: List<FingerprintAP>
)

data class FingerprintAP(
val bssid: String,
val rssi: Int
)
4. Integration with the Mock JSON
   To use the wifi-rssi-fingerprint-database-mock.json provided:
1.
Parse JSON: Use Gson/Kotlinx.Serialization to map the JSON array to a List<FingerprintEntry>.
2.
Node Setup: You must provide the Map<String, Node> where "elev-west" in the JSON maps to a Node(nodeId="elev-west", floorId="G", x=..., y=...).
3.
Execution: When the Android WifiManager returns results, wrap them in a WifiScanSnapshot and pass it to calculatePosition.
5. Challenges and Optimizations
   •
   Thresholding: Ignore APs with RSSI weaker than -90dBm to reduce noise.
   •
   Clustering: If $K$ neighbors are on different floors, prioritize the floor with the highest cumulative weight.
   •
   Moving Average: Smooth the currentPosition output over time to prevent the user's dot from "jumping" due to signal fluctuation.