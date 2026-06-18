package com.hyandlh.tarumtarenanavigation.core.wifi

import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

/**
 * A fake Wi-Fi scanner for testing purposes.
 * It allows manual emission of snapshots and failure states.
 */
class FakeWifiScanner @Inject constructor() : WifiScanSource {

    private val _scanResults = MutableStateFlow<WifiScanSnapshot>(
        WifiScanSnapshot(timestamp = 0L, readings = emptyList())
    )
    override val scanResults: StateFlow<WifiScanSnapshot> = _scanResults.asStateFlow()

    private val _failureState = MutableStateFlow<WifiScanFailure?>(null)
    override val failureState: StateFlow<WifiScanFailure?> = _failureState.asStateFlow()

    private var nextScanResult: WifiScanSnapshot? = null

    override suspend fun requestScan(): Result<Unit> {
        val failure = _failureState.value
        if (failure != null) {
            return Result.failure(Exception("Fake scan failed: $failure"))
        }

        nextScanResult?.let {
            _scanResults.value = it
        }
        
        return Result.success(Unit)
    }

    /**
     * Set the snapshot that will be emitted on the next [requestScan] call.
     */
    fun setNextScanResult(snapshot: WifiScanSnapshot) {
        this.nextScanResult = snapshot
    }

    /**
     * Immediately emit a snapshot.
     */
    fun emitSnapshot(snapshot: WifiScanSnapshot) {
        _scanResults.value = snapshot
    }

    /**
     * Set the current failure state.
     */
    fun setFailure(failure: WifiScanFailure?) {
        _failureState.value = failure
    }
}
