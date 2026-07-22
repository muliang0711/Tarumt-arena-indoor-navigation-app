package com.hyandlh.tarumtarenanavigation.core.positioning.remote

import com.hyandlh.tarumtarenanavigation.config.GlobalConfig
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

    private var baseUrl: String = GlobalConfig.KNN_API_BASE_URL // NOTE: Use 10.0.2.2 for localhost on emulator

    fun setBaseUrl(url: String) {
        baseUrl = url.removeSuffix("/")
    }

    private val _currentPosition = MutableStateFlow<PositionEstimate?>(null)
    override val currentPosition: StateFlow<PositionEstimate?> = _currentPosition.asStateFlow()

    private val _nodeDistances = MutableStateFlow<Map<String, Double>>(emptyMap())
    override val nodeDistances: StateFlow<Map<String, Double>> = _nodeDistances.asStateFlow()

    override suspend fun calculatePosition(
        snapshot: WifiScanSnapshot,
        catalog: AccessPointCatalog,
        checkedNodeIds: Set<String>
    ): PositionEstimate {
        val startedAt = System.currentTimeMillis()
        return try {
            val apiUrl = "$baseUrl/${GlobalConfig.KNN_API_ENDPOINT_CALCPOSITION}"
            val request = PositioningRequest.fromSnapshot(snapshot, checkedNodeIds)
            diagnostics.recordEvent(
                "Calling KNN positioning API",
                metadata = mapOf(
                    "url" to apiUrl,
                    "readings" to snapshot.readings.size.toString(),
                    "checkedNodes" to request.checkedNodeIds.size.toString()
                ),
                source = "ApiPositioningEngine.calculatePosition"
            )
            val response = apiService.calculatePosition(apiUrl, request)

            diagnostics.recordRemotePositioning(
                success = true,
                latencyMs = System.currentTimeMillis() - startedAt,
                source = "ApiPositioningEngine.calculatePosition"
            )

            val rawEstimate = response.estimate

            diagnostics.recordEvent(
                "Received raw estimate from KNN API",
                metadata = mapOf(
                    "x" to rawEstimate.x.toString(),
                    "y" to rawEstimate.y.toString(),
                    "confidence" to rawEstimate.confidence.toString(),
                    "nodeDistances" to response.nodeDistances.size.toString(),
                    "candidates" to response.candidates.size.toString(),
                    "bestCandidate" to (response.candidates.firstOrNull()?.nodeId ?: "none"),
                    "bestOverlap" to (response.candidates.firstOrNull()?.overlapRatio?.toString() ?: "none")
                ),
                source = "ApiPositioningEngine.calculatePosition"
            )

//            val finalEstimate = smoother.smooth(rawEstimate)
            val finalEstimate = rawEstimate // testing no smoothing

            _currentPosition.value = finalEstimate
            _nodeDistances.value = response.nodeDistances

            diagnostics.recordPositionCalculated(
                finalEstimate.x,
                finalEstimate.y,
                finalEstimate.confidence
            )
            healthHeartbeat.beat("ApiPositioningEngine")

            finalEstimate
        } catch (e: Exception) {
            diagnostics.recordRemotePositioning(
                success = false,
                latencyMs = System.currentTimeMillis() - startedAt,
                error = e.message,
                source = "ApiPositioningEngine.calculatePosition"
            )
            diagnostics.recordError(
                "API positioning failed: ${e.message}",
                e,
                source = "ApiPositioningEngine.calculatePosition"
            )
            val fallback = PositionEstimate(0.0, 0.0, "unknown", 0.0, snapshot.timestamp)
            _currentPosition.value = fallback
            _nodeDistances.value = emptyMap()
            fallback
        }
    }
}
