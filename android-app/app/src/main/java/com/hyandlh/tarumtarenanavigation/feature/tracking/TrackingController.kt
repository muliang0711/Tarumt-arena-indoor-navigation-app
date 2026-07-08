package com.hyandlh.tarumtarenanavigation.feature.tracking

import com.hyandlh.tarumtarenanavigation.core.apdata.repository.PositioningDataRepository
import com.hyandlh.tarumtarenanavigation.core.common.AppError
import com.hyandlh.tarumtarenanavigation.core.common.AppResult
import com.hyandlh.tarumtarenanavigation.core.model.AccessPointCatalog
import com.hyandlh.tarumtarenanavigation.core.model.KnnDiagnosticReport
import com.hyandlh.tarumtarenanavigation.core.model.Node
import com.hyandlh.tarumtarenanavigation.core.model.PositionEstimate
import com.hyandlh.tarumtarenanavigation.core.model.TrackingState
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import com.hyandlh.tarumtarenanavigation.core.observability.DiagnosticsRecorder
import com.hyandlh.tarumtarenanavigation.core.positioning.KnnDiagnosticsAnalyzer
import com.hyandlh.tarumtarenanavigation.core.positioning.PositioningEngine
import com.hyandlh.tarumtarenanavigation.core.wifi.WifiScanSource
import com.hyandlh.tarumtarenanavigation.core.wifi.WifiScanSnapshotStore
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
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TrackingController @Inject constructor(
    private val wifiScanner: WifiScanSource,
    private val positioningEngine: PositioningEngine,
    private val repository: PositioningDataRepository,
    private val diagnostics: DiagnosticsRecorder,
    private val knnDiagnosticsAnalyzer: KnnDiagnosticsAnalyzer,
    private val snapshotStore: WifiScanSnapshotStore
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

    private val _knnDiagnostics = MutableStateFlow<KnnDiagnosticReport?>(null)
    val knnDiagnostics: StateFlow<KnnDiagnosticReport?> = _knnDiagnostics.asStateFlow()

    private val _lastSavedScanPath = MutableStateFlow<String?>(null)
    val lastSavedScanPath: StateFlow<String?> = _lastSavedScanPath.asStateFlow()

    private val _isOneOffScanRunning = MutableStateFlow(false)
    val isOneOffScanRunning: StateFlow<Boolean> = _isOneOffScanRunning.asStateFlow()

    private val _checkedNodeIds = MutableStateFlow<Set<String>>(emptySet())
    val checkedNodeIds: StateFlow<Set<String>> = _checkedNodeIds.asStateFlow()
    private var hasUserNodeSelection = false

    private var scanIntervalMs: Long = 6000L

    fun setScanInterval(intervalMs: Long) {
        scanIntervalMs = intervalMs
        if (trackingJob?.isActive == true && !_isPaused.value) {
            startScanLoop()
        }
    }

    fun syncDefaultCheckedNodes(nodes: Collection<Node>) {
        if (!hasUserNodeSelection && _checkedNodeIds.value.isEmpty() && nodes.isNotEmpty()) {
            _checkedNodeIds.value = nodes.map { it.nodeId }.toSet()
        }
    }

    fun setCheckedNodeIds(nodeIds: Set<String>) {
        hasUserNodeSelection = true
        _checkedNodeIds.value = nodeIds
        diagnostics.recordEvent(
            "Checked node selection updated",
            metadata = mapOf("checkedNodes" to nodeIds.size.toString()),
            source = "TrackingController.setCheckedNodeIds"
        )
    }

    fun startTracking() {
        if (trackingJob?.isActive == true) return
        
        diagnostics.startNewSession()
        _isPaused.value = false
        
        trackingJob = scope.launch {
            _state.value = TrackingState.LoadingCatalog
            diagnostics.recordCatalogUpdate("Fetching latest...", source = "TrackingController.startTracking")
            val result = repository.refreshCatalog()
            
            if (result is AppResult.Failure) {
                diagnostics.recordError(
                    "Catalog update failed: ${result.error.message}",
                    result.error.throwable,
                    source = "TrackingController.startTracking"
                )
                _state.value = TrackingState.Error(result.error.message)
                return@launch
            }
            
            diagnostics.recordCatalogUpdate("Complete", source = "TrackingController.startTracking")
            _state.value = TrackingState.Scanning
            
            combine(
                repository.getCatalogFlow(),
                wifiScanner.scanResults
            ) { catalog, snapshot ->
                if (catalog != null && snapshot.readings.isNotEmpty()) {
                    syncDefaultCheckedNodes(catalog.nodes.values)
                    val activeCatalog = catalog.filteredByCheckedNodes(_checkedNodeIds.value)
                    _state.value = TrackingState.Positioning
                    _latestSnapshot.value = snapshot
                    val report = knnDiagnosticsAnalyzer.analyze(snapshot, activeCatalog)
                    _knnDiagnostics.value = report
                    diagnostics.recordEvent(
                        "KNN diagnostic trace updated",
                        metadata = mapOf(
                            "nearestNode" to (report.nodeSummaries.firstOrNull()?.nodeId ?: "none"),
                            "nearestDistance" to (report.nodeSummaries.firstOrNull()?.bestDistance?.toString() ?: "n/a"),
                            "checkedNodes" to _checkedNodeIds.value.size.toString()
                        ),
                        source = "TrackingController.startTracking"
                    )
                    positioningEngine.calculatePosition(snapshot, catalog, _checkedNodeIds.value)
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

    suspend fun runOneOffScan(): AppResult<OneOffScanResult> {
        if (trackingJob?.isActive == true) {
            val message = "Stop tracking before running a one-off scan"
            diagnostics.recordError(message, source = "TrackingController.runOneOffScan")
            return AppResult.Failure(AppError(message))
        }
        if (_isOneOffScanRunning.value) {
            val message = "A one-off scan is already running"
            diagnostics.recordError(message, source = "TrackingController.runOneOffScan")
            return AppResult.Failure(AppError(message))
        }

        _isOneOffScanRunning.value = true
        diagnostics.startNewSession()
        diagnostics.recordEvent("One-off scan started", source = "TrackingController.runOneOffScan")

        return try {
            _state.value = TrackingState.LoadingCatalog
            diagnostics.recordCatalogUpdate("Fetching latest...", source = "TrackingController.runOneOffScan")
            val refreshResult = repository.refreshCatalog()
            if (refreshResult is AppResult.Failure) {
                diagnostics.recordError(
                    "Catalog update failed: ${refreshResult.error.message}",
                    refreshResult.error.throwable,
                    source = "TrackingController.runOneOffScan"
                )
                _state.value = TrackingState.Error(refreshResult.error.message)
                return refreshResult
            }

            val catalog = repository.getCatalogFlow().filterNotNull().first()
            syncDefaultCheckedNodes(catalog.nodes.values)
            val activeCatalog = catalog.filteredByCheckedNodes(_checkedNodeIds.value)
            diagnostics.recordCatalogUpdate("Complete", source = "TrackingController.runOneOffScan")

            _state.value = TrackingState.Scanning
            val scanResult = requestNextSnapshot("TrackingController.runOneOffScan")
            if (scanResult is AppResult.Failure) {
                _state.value = TrackingState.Error(scanResult.error.message)
                return scanResult
            }
            val snapshot = (scanResult as AppResult.Success).data
            val savedFile = snapshotStore.save(snapshot)
            _lastSavedScanPath.value = savedFile.absolutePath
            diagnostics.recordEvent(
                "One-off Wi-Fi scan saved as JSON",
                metadata = mapOf(
                    "path" to savedFile.absolutePath,
                    "readings" to snapshot.readings.size.toString()
                ),
                source = "TrackingController.runOneOffScan"
            )

            _state.value = TrackingState.Positioning
            val report = knnDiagnosticsAnalyzer.analyze(snapshot, activeCatalog)
            _knnDiagnostics.value = report
            val estimate = positioningEngine.calculatePosition(snapshot, catalog, _checkedNodeIds.value)
            diagnostics.recordEvent(
                "One-off positioning complete",
                metadata = mapOf(
                    "x" to estimate.x.toString(),
                    "y" to estimate.y.toString(),
                    "confidence" to estimate.confidence.toString(),
                    "checkedNodes" to _checkedNodeIds.value.size.toString()
                ),
                source = "TrackingController.runOneOffScan"
            )
            _state.value = TrackingState.Idle

            AppResult.Success(
                OneOffScanResult(
                    snapshot = snapshot,
                    savedPath = savedFile.absolutePath,
                    estimate = estimate,
                    diagnostics = report
                )
            )
        } finally {
            _isOneOffScanRunning.value = false
        }
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
            while (isActive) {

                if (_isPaused.value) {
                    // tracking has been paused,
                    // check every 200ms if it's been resumed
                    // instead of busy-waiting
                    delay(200)
                    continue
                }

                val scanResult = requestNextSnapshot("TrackingController.startScanLoop")
                if (scanResult is AppResult.Failure) {
                    val tryAgainDuration = 1000L
                    diagnostics.recordEvent(
                        "Retrying scan after failure",
                        metadata = mapOf("delayMs" to tryAgainDuration.toString()),
                        source = "TrackingController.startScanLoop"
                    )
                    delay(tryAgainDuration)
                    continue
                }

                delay(scanIntervalMs)
            }
        }
    }

    private suspend fun requestNextSnapshot(source: String): AppResult<WifiScanSnapshot> {
        val lastSeenTimestamp = _latestSnapshot.value?.timestamp ?: 0L
        val result = wifiScanner.requestScan()

        if (result.isFailure) {
            val message = "Scan request failed: ${result.exceptionOrNull()?.message}"
            diagnostics.recordError(message, result.exceptionOrNull(), source = source)
            return AppResult.Failure(AppError(message, throwable = result.exceptionOrNull()))
        }

        diagnostics.recordEvent("Scan request accepted; awaiting fresh result", source = source)
        val snapshot = wifiScanner.scanResults
            .filter { it.timestamp > lastSeenTimestamp }
            .first()

        _latestSnapshot.value = snapshot
        diagnostics.recordScanResult(snapshot.timestamp, snapshot.readings.size, source = source)
        return AppResult.Success(snapshot)
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
    val nodeDistances: StateFlow<Map<String, Double>>? = positioningEngine.nodeDistances

    private fun AccessPointCatalog.filteredByCheckedNodes(checkedNodeIds: Set<String>): AccessPointCatalog {
        return copy(
            nodes = nodes.filterKeys { it in checkedNodeIds },
            fingerprints = fingerprints.filter { it.locationId in checkedNodeIds }
        )
    }
}

data class OneOffScanResult(
    val snapshot: WifiScanSnapshot,
    val savedPath: String,
    val estimate: PositionEstimate,
    val diagnostics: KnnDiagnosticReport
)
