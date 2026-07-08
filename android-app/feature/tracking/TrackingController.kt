package com.hyandlh.tarumtarenanavigation.feature.tracking

import com.hyandlh.tarumtarenanavigation.core.apdata.repository.AccessPointCatalogRepository
import com.hyandlh.tarumtarenanavigation.core.model.PositionEstimate
import com.hyandlh.tarumtarenanavigation.core.model.TrackingState
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
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TrackingController @Inject constructor(
    private val wifiScanner: WifiScanSource,
    private val positioningEngine: PositioningEngine,
    private val repository: AccessPointCatalogRepository,
    private val diagnostics: DiagnosticsRecorder
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var trackingJob: Job? = null
    private var scanLoopJob: Job? = null

    private val _state = MutableStateFlow<TrackingState>(TrackingState.Idle)
    val state: StateFlow<TrackingState> = _state.asStateFlow()

    private val _isPaused = MutableStateFlow(false)
    val isPaused: StateFlow<Boolean> = _isPaused.asStateFlow()

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
            _state.value = TrackingState.RequestingPermission // Transition state
            
            // Ensure catalog is loaded
            val initialCatalog = repository.getCatalogFlow().first()
            if (initialCatalog == null) {
                _state.value = TrackingState.Idle // Showing "Loading APs" in UI via Repository call
                repository.refreshCatalog()
            }

            _state.value = TrackingState.Scanning
            
            // Observe catalog and scan results together
            combine(
                repository.getCatalogFlow(),
                wifiScanner.scanResults
            ) { catalog, snapshot ->
                if (catalog != null && snapshot.readings.isNotEmpty()) {
                    _state.value = TrackingState.Positioning
                    positioningEngine.calculatePosition(snapshot, catalog, catalog.nodes.keys)
                } else if (catalog == null) {
                    _state.value = TrackingState.Error("AP Catalog not loaded")
                }
            }.collectLatest { }
        }
        
        startScanLoop()
    }

    fun stopTracking() {
        trackingJob?.cancel()
        scanLoopJob?.cancel()
        _state.value = TrackingState.Idle
    }

    fun pauseScanning() {
        _isPaused.value = true
        scanLoopJob?.cancel()
        _state.value = TrackingState.Paused
    }

    fun resumeScanning() {
        _isPaused.value = false
        startScanLoop()
        _state.value = TrackingState.Scanning
    }

    private fun startScanLoop() {
        scanLoopJob?.cancel()
        scanLoopJob = scope.launch {
            while (true) {
                if (!_isPaused.value) {
                    wifiScanner.requestScan()
                }
                delay(scanIntervalMs)
            }
        }
    }

    val currentPosition: StateFlow<PositionEstimate?> = positioningEngine.currentPosition as StateFlow<PositionEstimate?>
}
