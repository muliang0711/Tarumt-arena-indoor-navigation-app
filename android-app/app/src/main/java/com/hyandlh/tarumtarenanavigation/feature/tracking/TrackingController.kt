package com.hyandlh.tarumtarenanavigation.feature.tracking

import com.hyandlh.tarumtarenanavigation.core.apdata.repository.PositioningDataRepository
import com.hyandlh.tarumtarenanavigation.core.common.AppResult
import com.hyandlh.tarumtarenanavigation.core.model.PositionEstimate
import com.hyandlh.tarumtarenanavigation.core.model.TrackingState
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import com.hyandlh.tarumtarenanavigation.core.observability.DiagnosticsRecorder
import com.hyandlh.tarumtarenanavigation.core.positioning.PositioningEngine
import com.hyandlh.tarumtarenanavigation.core.wifi.WifiScanSource
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TrackingController @Inject constructor(
    private val wifiScanner: WifiScanSource,
    private val positioningEngine: PositioningEngine,
    private val repository: PositioningDataRepository, // Inject interface
    private val diagnostics: DiagnosticsRecorder
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var trackingJob: Job? = null
    private var scanLoopJob: Job? = null
    private var countdownJob: Job? = null

    private val _state = MutableStateFlow<TrackingState>(TrackingState.Idle)
    val state: StateFlow<TrackingState> = _state.asStateFlow()

    private val _isPaused = MutableStateFlow(false)
    val isPaused: StateFlow<Boolean> = _isPaused.asStateFlow()

    private val _latestSnapshot = MutableStateFlow<WifiScanSnapshot?>(null)
    val latestSnapshot: StateFlow<WifiScanSnapshot?> = _latestSnapshot.asStateFlow()

    private var scanIntervalMs: Long = 5000L

    fun setScanInterval(intervalMs: Long) {
        scanIntervalMs = intervalMs
        if (trackingJob?.isActive == true && !_isPaused.value) {
            startScanLoop()
        }
    }

    fun startTracking() {
        if (trackingJob?.isActive == true) return
        
        diagnostics.startNewSession()
        _isPaused.value = false
        
        trackingJob = scope.launch {
            _state.value = TrackingState.LoadingCatalog
            diagnostics.recordCatalogUpdate("Fetching latest...")
            val result = repository.refreshCatalog()
            
            if (result is AppResult.Failure) {
                diagnostics.recordError("Catalog update failed: ${result.error.message}")
                _state.value = TrackingState.Error(result.error.message)
                return@launch
            }
            
            diagnostics.recordCatalogUpdate("Complete")
            _state.value = TrackingState.Scanning
            
            // Observe catalog and scan results together
            combine(
                repository.getCatalogFlow(),
                wifiScanner.scanResults.onEach { snapshot ->
                    _latestSnapshot.value = snapshot
                    diagnostics.recordScanResult(snapshot.timestamp, snapshot.readings.size)
                }
            ) { catalog, snapshot ->
                if (catalog != null && snapshot.readings.isNotEmpty()) {
                    _state.value = TrackingState.Positioning
                    diagnostics.recordMessage("calculating your current location")
                    positioningEngine.calculatePosition(snapshot, catalog)
                } else if (catalog == null) {
                    _state.value = TrackingState.Error("AP Catalog vanished from cache")
                }
            }.collectLatest { }
        }
        
        startScanLoop()
    }

    fun stopTracking() {
        trackingJob?.cancel()
        scanLoopJob?.cancel()
        countdownJob?.cancel()
        _state.value = TrackingState.Idle
    }

    suspend fun pauseScanning() {
        delay(500) 
        _isPaused.value = true
        scanLoopJob?.cancel()
        countdownJob?.cancel()
        _state.value = TrackingState.Paused
    }

    suspend fun resumeScanning() {
        delay(500)
        _isPaused.value = false
        startScanLoop()
        _state.value = TrackingState.Scanning
    }

    private fun startScanLoop() {
        scanLoopJob?.cancel()
        scanLoopJob = scope.launch {
            while (true) {
                if (!_isPaused.value) {
                    diagnostics.recordScanRequest(System.currentTimeMillis())
                    wifiScanner.requestScan()
                    startCountdown()
                }
                delay(scanIntervalMs)
            }
        }
    }

    private fun startCountdown() {
        countdownJob?.cancel()
        countdownJob = scope.launch {
            for (i in (scanIntervalMs / 1000).toInt() downTo 1) {
                val timeStr = if (i >= 60) "${i / 60}m ${i % 60}s" else "${i}s"
                diagnostics.recordMessage("next scan and location update in: $timeStr")
                delay(1000)
            }
        }
    }

    val currentPosition: StateFlow<PositionEstimate?> = positioningEngine.currentPosition as StateFlow<PositionEstimate?>
}
