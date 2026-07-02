package com.hyandlh.tarumtarenanavigation.core.wifi

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.wifi.WifiManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.hyandlh.tarumtarenanavigation.config.ScanConfig
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanReading
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import com.hyandlh.tarumtarenanavigation.core.observability.DiagnosticsRecorder
import com.hyandlh.tarumtarenanavigation.core.observability.HealthHeartbeat
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AndroidWifiScanner @Inject constructor(
    @ApplicationContext private val context: Context,
    private val diagnostics: DiagnosticsRecorder,
    private val healthHeartbeat: HealthHeartbeat
) : WifiScanSource {

    private val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager

    private val _scanResults = MutableSharedFlow<WifiScanSnapshot>(
        replay = 1,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    override val scanResults: SharedFlow<WifiScanSnapshot> = _scanResults.asSharedFlow()

    private val _failureState = MutableStateFlow<WifiScanFailure?>(null)
    override val failureState: StateFlow<WifiScanFailure?> = _failureState.asStateFlow()

    private val wifiScanReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val success = intent.getBooleanExtra(WifiManager.EXTRA_RESULTS_UPDATED, false)
            if (success) {
                processScanResults()
            } else {
                diagnostics.recordError("Scan result update failed", metadata = mapOf("reason" to "throttled_or_hardware_failure"))
                _failureState.value = WifiScanFailure.Throttled
            }
        }
    }

    init {
        val intentFilter = IntentFilter()
        intentFilter.addAction(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION)
        context.registerReceiver(wifiScanReceiver, intentFilter)
    }

    override suspend fun requestScan(): Result<Unit> {
        if (!hasPermissions()) {
            diagnostics.recordError("Scan requested but permissions missing")
            _failureState.value = WifiScanFailure.PermissionDenied
            return Result.failure(SecurityException("Missing location permissions"))
        }

        if (!wifiManager.isWifiEnabled) {
            diagnostics.recordError("Scan requested but Wi-Fi disabled")
            _failureState.value = WifiScanFailure.WifiDisabled
            return Result.failure(IllegalStateException("Wi-Fi is disabled"))
        }

        val timestamp = System.currentTimeMillis()
        diagnostics.recordScanRequest(timestamp)
        
        val success = wifiManager.startScan()
        return if (success) {
            Result.success(Unit)
        } else {
            diagnostics.recordError("Scan startScan() returned false (throttled)")
            _failureState.value = WifiScanFailure.Throttled
            Result.failure(IllegalStateException("Scan request failed (likely throttled)"))
        }
    }

    private fun hasPermissions(): Boolean {
        val fineLocation = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
        val wifiState = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_WIFI_STATE)
        val changeWifiState = ContextCompat.checkSelfPermission(context, Manifest.permission.CHANGE_WIFI_STATE)

        return fineLocation == PackageManager.PERMISSION_GRANTED &&
               wifiState == PackageManager.PERMISSION_GRANTED &&
               changeWifiState == PackageManager.PERMISSION_GRANTED
    }

    private fun processScanResults() {
        if (!hasPermissions()) return

        try {
            val results = wifiManager.scanResults
            val now = System.currentTimeMillis()

            // `diagnostics.recordScanResult` is already done in TrackingController.startTracking().
            //diagnostics.recordScanResult(now, results.size)
            healthHeartbeat.beat("WifiScanner")

            val snapshot = WifiScanSnapshot(
                timestamp = now,
                readings = results
                    .filter { result ->
                        result.SSID == ScanConfig.FILTER_SSID
                    }
                    .map { result ->
                    WifiScanReading(
                        bssid = result.BSSID,
                        rssi = result.level,
                        timestamp = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1) {
                             System.currentTimeMillis() - (android.os.SystemClock.elapsedRealtime() - result.timestamp / 1000)
                        } else {
                            System.currentTimeMillis()
                        },
                        frequency = result.frequency,
                        ssid = result.SSID
                    )
                }
            )
            _scanResults.tryEmit(snapshot)
            _failureState.value = null
        } catch (e: SecurityException) {
            diagnostics.recordError("SecurityException during scan processing", e)
            _failureState.value = WifiScanFailure.PermissionDenied
        } catch (e: Exception) {
            diagnostics.recordError("Unknown error during scan processing", e)
            _failureState.value = WifiScanFailure.Unknown(e.message ?: "Unknown error")
        }
    }
}
