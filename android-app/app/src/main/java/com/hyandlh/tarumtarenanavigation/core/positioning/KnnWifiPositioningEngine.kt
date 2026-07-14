package com.hyandlh.tarumtarenanavigation.core.positioning

import com.hyandlh.tarumtarenanavigation.core.model.*
import com.hyandlh.tarumtarenanavigation.core.observability.DiagnosticsRecorder
import com.hyandlh.tarumtarenanavigation.core.observability.HealthHeartbeat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
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

    private val _currentPosition = MutableStateFlow<PositionEstimate?>(null)
    override val currentPosition: StateFlow<PositionEstimate?> = _currentPosition.asStateFlow()

    /**
     * A flow of calculated distances to each node in the catalog based on the latest scan.
     * The key is the nodeId, and the value is its aggregated, overlap-adjusted distance.
     */
    private val _nodeDistances = MutableStateFlow<Map<String, Double>>(emptyMap())
    override val nodeDistances: StateFlow<Map<String, Double>>? = _nodeDistances.asStateFlow()

    override suspend fun calculatePosition(
        snapshot: WifiScanSnapshot,
        catalog: AccessPointCatalog,
        checkedNodeIds: Set<String>
    ): PositionEstimate {
        
        val activeCatalog = catalog.filteredByCheckedNodes(checkedNodeIds)
        val fingerprintDb = activeCatalog.fingerprints
        val nodeRegistry = activeCatalog.nodes

        val result = LocationKnnAlgorithm.calculate(
            readings = snapshot.readings,
            fingerprints = fingerprintDb,
            nodes = nodeRegistry,
            timestamp = snapshot.timestamp,
            algorithmName = "Location-WKNN"
        )
        _nodeDistances.value = result.allLocationCandidates.associate { it.nodeId to it.distance }

        if (result.selectedCandidates.isEmpty()) {
            diagnostics.recordEvent(
                "PositioningFailed",
                mapOf("reason" to (result.estimate.diagnostics["reason"] ?: "no_location_candidates"))
            )
        }

        val rawEstimate = result.estimate
        
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

    private fun AccessPointCatalog.filteredByCheckedNodes(checkedNodeIds: Set<String>): AccessPointCatalog {
        return copy(
            nodes = nodes.filterKeys { it in checkedNodeIds },
            fingerprints = fingerprints.filter { it.locationId in checkedNodeIds }
        )
    }
}
