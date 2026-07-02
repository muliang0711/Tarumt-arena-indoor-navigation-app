package com.hyandlh.tarumtarenanavigation.core.positioning.remote

import com.hyandlh.tarumtarenanavigation.core.model.AccessPointCatalog
import com.hyandlh.tarumtarenanavigation.core.model.PositionEstimate
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import com.hyandlh.tarumtarenanavigation.core.observability.DiagnosticsRecorder
import com.hyandlh.tarumtarenanavigation.core.observability.HealthHeartbeat
import com.hyandlh.tarumtarenanavigation.core.positioning.PositionSmoother
import com.hyandlh.tarumtarenanavigation.core.positioning.PositioningEngine
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ApiPositioningEngine @Inject constructor(
    private val apiService: PositioningApiService,
    private val smoother: PositionSmoother,
    private val diagnostics: DiagnosticsRecorder,
    private val healthHeartbeat: HealthHeartbeat
) : PositioningEngine {

    private var baseUrl: String = "http://10.0.2.2:8080" // Use 10.0.2.2 for localhost on emulator

    fun setBaseUrl(url: String) {
        baseUrl = url.removeSuffix("/")
    }

    private val _currentPosition = MutableStateFlow<PositionEstimate?>(null)
    override val currentPosition: StateFlow<PositionEstimate?> = _currentPosition.asStateFlow()

    private val _nodeDistances = MutableStateFlow<Map<String, Double>>(emptyMap())
    override val nodeDistances: StateFlow<Map<String, Double>> = _nodeDistances.asStateFlow()

    override suspend fun calculatePosition(
        snapshot: WifiScanSnapshot,
        catalog: AccessPointCatalog
    ): PositionEstimate {
        return try {
            val response = apiService.calculatePosition("$baseUrl/calcPosition", snapshot)
            
            val rawEstimate = response.estimate
            val smoothedEstimate = smoother.smooth(rawEstimate)

            _currentPosition.value = smoothedEstimate
            _nodeDistances.value = response.nodeDistances

            diagnostics.recordPositionCalculated(
                smoothedEstimate.x,
                smoothedEstimate.y,
                smoothedEstimate.confidence
            )
            healthHeartbeat.beat("ApiPositioningEngine")

            smoothedEstimate
        } catch (e: Exception) {
            diagnostics.recordError("API Positioning Failed: ${e.message}")
            val fallback = PositionEstimate(0.0, 0.0, "unknown", 0.0, snapshot.timestamp)
            _currentPosition.value = fallback
            fallback
        }
    }
}
