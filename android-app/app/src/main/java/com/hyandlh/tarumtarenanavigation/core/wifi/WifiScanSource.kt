package com.hyandlh.tarumtarenanavigation.core.wifi

import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import kotlinx.coroutines.flow.Flow

/**
 * Failure states for Wi-Fi scanning.
 */
sealed class WifiScanFailure {
    object PermissionDenied : WifiScanFailure()
    object WifiDisabled : WifiScanFailure()
    object LocationServicesDisabled : WifiScanFailure()
    object Throttled : WifiScanFailure()
    data class Unknown(val message: String) : WifiScanFailure()
}

/**
 * Interface for a source of Wi-Fi scan snapshots.
 */
interface WifiScanSource {
    /**
     * Returns a Flow that emits snapshots as they are received.
     */
    val scanResults: Flow<WifiScanSnapshot>

    /**
     * Triggers a manual scan request.
     */
    suspend fun requestScan(): Result<Unit>

    /**
     * Returns the current failure state, if any.
     */
    val failureState: Flow<WifiScanFailure?>

//    suspend fun scanOnce(): List<AccessPoint>
}
