package com.hyandlh.tarumtarenanavigation.core.positioning

import com.hyandlh.tarumtarenanavigation.core.model.*
import com.hyandlh.tarumtarenanavigation.core.observability.DiagnosticsRecorder
import com.hyandlh.tarumtarenanavigation.core.observability.HealthHeartbeat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/**
 * A positioning engine that uses the Weighted K-Nearest Neighbors (WKNN) algorithm
 * based on Wi-Fi RSSI fingerprints.
 */
@Singleton
class KnnWifiPositioningEngine @Inject constructor(
    private val smoother: PositionSmoother,
    private val diagnostics: DiagnosticsRecorder,
    private val healthHeartbeat: HealthHeartbeat
) : PositioningEngine {

    private val k: Int = 3

    private val _currentPosition = MutableStateFlow<PositionEstimate?>(null)
    override val currentPosition: StateFlow<PositionEstimate?> = _currentPosition.asStateFlow()

    /**
     * A flow of calculated distances to each node in the catalog based on the latest scan.
     * The key is the nodeId, and the value is the calculated distance (e.g., Euclidean).
     */
    private val _nodeDistances = MutableStateFlow<Map<String, Double>>(emptyMap())
    override val nodeDistances: StateFlow<Map<String, Double>>? = _nodeDistances.asStateFlow()

    override suspend fun calculatePosition(
        snapshot: WifiScanSnapshot,
        catalog: AccessPointCatalog
    ): PositionEstimate {
        
        val fingerprintDb = catalog.fingerprints
        val nodeRegistry = catalog.nodes

        // 1. Thresholding: Ignore APs with RSSI weaker than -90dBm to reduce noise
        val liveReadings = snapshot.readings.filter { it.rssi >= -90 }

        // 2. Calculate Euclidean distances to all fingerprints in the database
        val allFingerprintDistances = fingerprintDb.map { fingerprint ->
            val dist = DistanceUtils.calculateEuclideanDistance(liveReadings, fingerprint.apList)
            fingerprint.locationId to dist
        }

        // Update node distances: For each node, take the distance to its closest fingerprint
        _nodeDistances.value = allFingerprintDistances
            .groupBy { it.first }
            .mapValues { entry -> entry.value.minOf { it.second } }

        val nearestNeighbors = allFingerprintDistances
            .sortedBy { it.second }
            .take(k)

        if (nearestNeighbors.isEmpty()) {
            diagnostics.recordEvent("PositioningFailed", mapOf("reason" to "no_fingerprint_matches"))
        }

        // 3. Compute the weighted average of coordinates
        val rawEstimate = calculateWeightedAverage(nearestNeighbors, nodeRegistry, snapshot.timestamp)
        
        // 4. Apply smoothing
        val finalEstimate = smoother.smooth(rawEstimate)
        
        // 5. Diagnostics & Health
        diagnostics.recordPositionCalculated(
            finalEstimate.x,
            finalEstimate.y,
            finalEstimate.confidence
        )
        healthHeartbeat.beat("PositioningEngine")

        _currentPosition.value = finalEstimate
        return finalEstimate
    }

    private fun calculateWeightedAverage(
        neighbors: List<Pair<String, Double>>, 
        nodeRegistry: Map<String, Node>,
        timestamp: Long
    ): PositionEstimate {
        if (neighbors.isEmpty()) {
            return PositionEstimate(0.0, 0.0, "unknown", 0.0, timestamp)
        }

        var totalWeight = 0.0
        var sumX = 0.0
        var sumY = 0.0
        val floorWeights = mutableMapOf<String, Double>()

        neighbors.forEach { (locId, dist) ->
            val node = nodeRegistry[locId] ?: return@forEach
            
            // Inverse distance weighting (w = 1/d). Add epsilon to prevent div by zero.
            val weight = 1.0 / (dist + 0.1) 
            
            sumX += node.x * weight
            sumY += node.y * weight
            totalWeight += weight
            
            // Clustering: Prioritize the floor with the highest cumulative weight
            floorWeights[node.floorId] = floorWeights.getOrDefault(node.floorId, 0.0) + weight
        }

        if (totalWeight == 0.0) {
            return PositionEstimate(0.0, 0.0, "unknown", 0.0, timestamp)
        }

        val bestFloor = floorWeights.maxByOrNull { it.value }?.key ?: "unknown"
        val bestDist = neighbors.first().second
        
        // Confidence heuristic: closer proximity to fingerprints means higher confidence
        val confidence = (1.0 / (bestDist / 10.0 + 1.0)).coerceIn(0.0, 1.0)

        return PositionEstimate(
            x = sumX / totalWeight,
            y = sumY / totalWeight,
            floorId = bestFloor,
            confidence = confidence,
            timestamp = timestamp,
            diagnostics = mapOf(
                "algorithm" to "WKNN",
                "k" to neighbors.size.toString(),
                "nearest_dist" to String.format(Locale.US, "%.2f", bestDist)
            )
        )
    }
}
