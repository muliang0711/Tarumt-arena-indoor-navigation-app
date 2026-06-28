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

    /**
     * (this is only used for KnnWifiPositioningEngine and is irrelevant here)
     * (had to override this here as this member is defined in the interface)
     * (this variable will not be used in this class)
     * A flow of calculated distances to each node in the catalog based on the latest scan.
     * The key is the nodeId, and the value is the calculated distance (e.g., Euclidean).
     */
    override val nodeDistances: StateFlow<Map<String, Double>>? = null

    override fun calculatePosition(
        snapshot: WifiScanSnapshot,
        catalog: AccessPointCatalog
    ): PositionEstimate {
        // 1. Preprocess
        val cleanSnapshot = preprocessor.preprocess(snapshot)

        // 2. Match
        val matches = matcher.match(cleanSnapshot, catalog)
        
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

        // 6. Update flow
        _currentPosition.value = smoothedEstimate

        return smoothedEstimate
    }
}
