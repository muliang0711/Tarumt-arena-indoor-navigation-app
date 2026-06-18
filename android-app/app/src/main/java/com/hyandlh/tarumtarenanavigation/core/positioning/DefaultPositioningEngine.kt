package com.hyandlh.tarumtarenanavigation.core.positioning

import com.hyandlh.tarumtarenanavigation.core.model.AccessPointCatalog
import com.hyandlh.tarumtarenanavigation.core.model.PositionEstimate
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import com.hyandlh.tarumtarenanavigation.core.observability.DiagnosticsRecorder
import com.hyandlh.tarumtarenanavigation.core.observability.HealthHeartbeat
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
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

    private val _currentPosition = MutableSharedFlow<PositionEstimate>(replay = 1)
    override val currentPosition: SharedFlow<PositionEstimate> = _currentPosition.asSharedFlow()

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

        // 3. Solve
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
        _currentPosition.tryEmit(smoothedEstimate)

        return smoothedEstimate
    }
}
