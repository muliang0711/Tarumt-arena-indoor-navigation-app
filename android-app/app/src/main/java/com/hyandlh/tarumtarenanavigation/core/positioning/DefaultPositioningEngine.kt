package com.hyandlh.tarumtarenanavigation.core.positioning

import com.hyandlh.tarumtarenanavigation.core.model.AccessPointCatalog
import com.hyandlh.tarumtarenanavigation.core.model.PositionEstimate
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import com.hyandlh.tarumtarenanavigation.core.observability.DiagnosticsRecorder
import com.hyandlh.tarumtarenanavigation.core.observability.HealthHeartbeat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.pow
import kotlin.math.sqrt

@Singleton
class DefaultPositioningEngine @Inject constructor(
    private val preprocessor: SignalPreprocessor,
    private val matcher: APMatcher,
    private val solver: MultilaterationSolver,
    private val smoother: PositionSmoother,
    private val diagnostics: DiagnosticsRecorder,
    private val healthHeartbeat: HealthHeartbeat
) : PositioningEngine {

    private val _currentPosition = MutableStateFlow<PositionEstimate?>(null)
    override val currentPosition: StateFlow<PositionEstimate?> = _currentPosition.asStateFlow()

    private val _nodeDistances = MutableStateFlow<Map<String, Double>>(emptyMap())
    override val nodeDistances: StateFlow<Map<String, Double>> = _nodeDistances.asStateFlow()

    override suspend fun calculatePosition(
        snapshot: WifiScanSnapshot,
        catalog: AccessPointCatalog,
        checkedNodeIds: Set<String>
    ): PositionEstimate {
        val activeCatalog = catalog.filteredByCheckedNodes(checkedNodeIds)

        // 1. Preprocess
        val cleanSnapshot = preprocessor.preprocess(snapshot)

        // 2. Match
        val matches = matcher.match(cleanSnapshot, activeCatalog)
        
        if (matches.isEmpty()) {
            diagnostics.recordEvent("PositioningFailed", mapOf("reason" to "no_matching_aps"))
        }

        // 3. Solve (pass the snapshot timestamp)
        val rawEstimate = solver.solve(matches, snapshot.timestamp)

        // 4. Smooth
        val smoothedEstimate = smoother.smooth(rawEstimate)

        // 5. Diagnostics & Health
        diagnostics.recordPositionCalculated(
            smoothedEstimate.x,
            smoothedEstimate.y,
            smoothedEstimate.confidence
        )
        healthHeartbeat.beat("PositioningEngine")

        // 6. Update flows
        _currentPosition.value = smoothedEstimate
        updateNodeDistances(smoothedEstimate, activeCatalog)

        return smoothedEstimate
    }

    private fun AccessPointCatalog.filteredByCheckedNodes(checkedNodeIds: Set<String>): AccessPointCatalog {
        return copy(
            nodes = nodes.filterKeys { it in checkedNodeIds },
            fingerprints = fingerprints.filter { it.locationId in checkedNodeIds }
        )
    }

    private fun updateNodeDistances(estimate: PositionEstimate, catalog: AccessPointCatalog) {
        val distances = catalog.nodes.mapValues { (_, node) ->
            if (node.floorId == estimate.floorId) {
                sqrt((node.x - estimate.x).pow(2) + (node.y - estimate.y).pow(2))
            } else {
                Double.MAX_VALUE
            }
        }
        _nodeDistances.value = distances
    }
}
