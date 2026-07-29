package com.puihockyang.indoor_navigation

import android.Manifest
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.wifi.ScanResult
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

internal const val WIFI_SCAN_SCHEMA_VERSION = 3
private const val WIFI_SCAN_METHOD_CHANNEL = "indoor_navigation/wifi_scan/methods/v3"
private const val WIFI_PERMISSION_REQUEST_CODE = 41_021
private const val WIFI_PERMISSION_REQUESTED_KEY = "fineLocationPermissionRequested"
private const val WIFI_PERMISSION_PREFERENCES = "wifiScanPermissions"
private const val WIFI_SCAN_TIMEOUT_MS = 15_000L
private const val WIFI_PASSIVE_SCAN_TIMEOUT_MS = 5_000L

internal class AndroidWifiScanBridge(
    private val activity: Activity,
    messenger: BinaryMessenger,
) {
    private val handler = Handler(Looper.getMainLooper())
    private val applicationContext = activity.applicationContext
    private val locationManager =
        activity.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private val methodChannel = MethodChannel(messenger, WIFI_SCAN_METHOD_CHANNEL)
    private val packageManager = activity.packageManager
    private val preferences = activity.getSharedPreferences(
        WIFI_PERMISSION_PREFERENCES,
        Context.MODE_PRIVATE,
    )
    private val wifiManager =
        applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager

    private var disposed = false
    private var pendingPermissionResult: MethodChannel.Result? = null
    private var pendingScanResult: MethodChannel.Result? = null
    private var pendingActiveScanAccepted: Boolean? = null
    private var latestScanSnapshot: AndroidWifiScanSnapshot? = null
    private var scanReceiverRegistered = false
    private var scanStartedAtMs: Long? = null

    private val scanReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != WifiManager.SCAN_RESULTS_AVAILABLE_ACTION) return
            val updated = intent.getBooleanExtra(WifiManager.EXTRA_RESULTS_UPDATED, false)
            if (!updated) {
                if (pendingActiveScanAccepted == false) {
                    // The active request was throttled. Keep waiting for a successful
                    // platform scan while the persistent receiver remains registered.
                    return
                }
                finishScanWithError(
                    "scanFailed",
                    "Android did not provide a newly updated Wi-Fi scan result.",
                )
                return
            }
            captureScanResults(
                source = if (pendingActiveScanAccepted == true) {
                    WifiScanBatchSource.ACTIVE
                } else {
                    WifiScanBatchSource.PASSIVE
                },
            )
        }
    }

    private val scanTimeout = Runnable {
        if (pendingActiveScanAccepted == false) {
            finishScanWithError(
                "scanThrottled",
                "Android throttled the active scan and no passive scan arrived before timeout.",
            )
        } else {
            finishScanWithError("scanFailed", "Wi-Fi scan timed out.")
        }
    }

    init {
        registerScanReceiver()
        methodChannel.setMethodCallHandler(::handleMethodCall)
    }

    fun close() {
        if (disposed) return
        disposed = true
        methodChannel.setMethodCallHandler(null)
        pendingPermissionResult?.error(
            "disposed",
            "Wi-Fi scan bridge was disposed during a permission request.",
            null,
        )
        pendingPermissionResult = null
        finishScanWithError(
            "disposed",
            "Wi-Fi scan bridge was disposed during a scan.",
        )
        unregisterScanReceiver()
    }

    fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ): Boolean {
        if (requestCode != WIFI_PERMISSION_REQUEST_CODE) return false
        val result = pendingPermissionResult
        pendingPermissionResult = null
        if (result != null && !disposed) {
            result.success(accessState())
        }
        return true
    }

    private fun handleMethodCall(call: MethodCall, result: MethodChannel.Result) {
        try {
            when (call.method) {
                "checkAccess" -> {
                    expectControlArguments(call)
                    ensureNotDisposed()
                    result.success(accessState())
                }
                "requestPermission" -> {
                    expectControlArguments(call)
                    requestPermission(result)
                }
                "scan" -> scan(
                    requestActiveScan = expectScanArguments(call),
                    result = result,
                )
                "dispose" -> {
                    expectControlArguments(call)
                    close()
                    result.success(controlResponse())
                }
                else -> result.notImplemented()
            }
        } catch (error: AndroidWifiScanException) {
            result.error(error.code, error.message, null)
        } catch (error: SecurityException) {
            result.error(
                "permissionDenied",
                error.message ?: "Android denied Wi-Fi scan access.",
                null,
            )
        } catch (error: RuntimeException) {
            result.error(
                "scanFailed",
                error.message ?: "Android Wi-Fi scan operation failed.",
                null,
            )
        }
    }

    private fun scan(requestActiveScan: Boolean, result: MethodChannel.Result) {
        ensureNotDisposed()
        requireScanReady()
        if (!requestActiveScan) {
            val snapshot = latestScanSnapshot
                ?: throw AndroidWifiScanException(
                    "scanFailed",
                    "Android has not observed a Wi-Fi scan batch yet.",
                )
            result.success(snapshot.toWireResponse(WifiScanBatchSource.CACHED))
            return
        }
        startActiveScan(result)
    }

    private fun requestPermission(result: MethodChannel.Result) {
        ensureNotDisposed()
        if (!hasWifiHardware() || hasFineLocationPermission()) {
            result.success(accessState())
            return
        }
        if (pendingPermissionResult != null) {
            throw AndroidWifiScanException(
                "permissionRequestInProgress",
                "A Wi-Fi scan permission request is already active.",
            )
        }
        preferences.edit().putBoolean(WIFI_PERMISSION_REQUESTED_KEY, true).apply()
        pendingPermissionResult = result
        activity.requestPermissions(
            arrayOf(
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION,
            ),
            WIFI_PERMISSION_REQUEST_CODE,
        )
    }

    @Suppress("DEPRECATION")
    private fun startActiveScan(result: MethodChannel.Result) {
        if (pendingScanResult != null) {
            throw AndroidWifiScanException(
                "scanInProgress",
                "A Wi-Fi scan is already active.",
            )
        }

        pendingScanResult = result
        pendingActiveScanAccepted = null
        scanStartedAtMs = System.currentTimeMillis()
        handler.postDelayed(scanTimeout, WIFI_SCAN_TIMEOUT_MS)
        val accepted = try {
            wifiManager.startScan()
        } catch (error: RuntimeException) {
            clearPendingScan()
            throw error
        }
        if (pendingScanResult != null) {
            pendingActiveScanAccepted = accepted
        }
        if (!accepted && pendingScanResult != null) {
            val snapshot = latestScanSnapshot
            if (snapshot != null) {
                finishScanWithSnapshot(snapshot, WifiScanBatchSource.CACHED)
            } else {
                handler.removeCallbacks(scanTimeout)
                handler.postDelayed(scanTimeout, WIFI_PASSIVE_SCAN_TIMEOUT_MS)
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun captureScanResults(source: WifiScanBatchSource) {
        val startedAt = scanStartedAtMs ?: System.currentTimeMillis()
        val completedAt = System.currentTimeMillis()
        try {
            val readings = wifiManager.scanResults
                .mapNotNull { scanResult ->
                    scanResult.toWireReading(
                        completedAtMs = completedAt,
                    )
                }
                .sortedBy { reading -> reading["bssid"] as String }
            val snapshot = AndroidWifiScanSnapshot(
                completedAtMs = completedAt,
                readings = readings,
                startedAtMs = startedAt,
            )
            latestScanSnapshot = snapshot
            if (pendingScanResult != null) {
                finishScanWithSnapshot(snapshot, source)
            }
        } catch (error: SecurityException) {
            finishScanWithError(
                "permissionDenied",
                error.message ?: "Android denied Wi-Fi scan result access.",
            )
        } catch (error: RuntimeException) {
            finishScanWithError(
                "scanFailed",
                error.message ?: "Android could not read Wi-Fi scan results.",
            )
        }
    }

    private fun finishScanWithSnapshot(
        snapshot: AndroidWifiScanSnapshot,
        source: WifiScanBatchSource,
    ) {
        val result = pendingScanResult ?: return
        clearPendingScan()
        result.success(snapshot.toWireResponse(source))
    }

    private fun finishScanWithError(code: String, message: String) {
        val result = pendingScanResult ?: return
        clearPendingScan()
        result.error(code, message, null)
    }

    private fun clearPendingScan() {
        handler.removeCallbacks(scanTimeout)
        pendingScanResult = null
        pendingActiveScanAccepted = null
        scanStartedAtMs = null
    }

    private fun registerScanReceiver() {
        if (scanReceiverRegistered) return
        val filter = IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            applicationContext.registerReceiver(
                scanReceiver,
                filter,
                Context.RECEIVER_NOT_EXPORTED,
            )
        } else {
            @Suppress("DEPRECATION")
            applicationContext.registerReceiver(scanReceiver, filter)
        }
        scanReceiverRegistered = true
    }

    private fun unregisterScanReceiver() {
        if (!scanReceiverRegistered) return
        try {
            applicationContext.unregisterReceiver(scanReceiver)
        } catch (_: IllegalArgumentException) {
            // The receiver was already removed by the Android runtime.
        } finally {
            scanReceiverRegistered = false
        }
    }

    private fun requireScanReady() {
        if (!hasWifiHardware()) {
            throw AndroidWifiScanException(
                "unsupported",
                "This Android device does not support Wi-Fi scanning.",
            )
        }
        if (!hasFineLocationPermission()) {
            throw AndroidWifiScanException(
                "permissionDenied",
                "Precise location permission is required for Wi-Fi positioning.",
            )
        }
        if (!wifiManager.isWifiEnabled) {
            throw AndroidWifiScanException(
                "wifiDisabled",
                "Wi-Fi must be enabled before scanning.",
            )
        }
        if (!locationServicesEnabled()) {
            throw AndroidWifiScanException(
                "locationServicesDisabled",
                "Location services must be enabled before Wi-Fi scanning.",
            )
        }
    }

    private fun accessState(): Map<String, Any> {
        val supported = hasWifiHardware()
        return mapOf(
            "schemaVersion" to WIFI_SCAN_SCHEMA_VERSION,
            "platformSupport" to if (supported) "supported" else "unsupported",
            "permission" to permissionStatus(),
            "wifiEnabled" to (supported && wifiManager.isWifiEnabled),
            "locationServicesEnabled" to (supported && locationServicesEnabled()),
        )
    }

    private fun permissionStatus(): String {
        if (hasFineLocationPermission()) return "granted"
        val requested = preferences.getBoolean(WIFI_PERMISSION_REQUESTED_KEY, false)
        if (!requested) return "notDetermined"
        return if (activity.shouldShowRequestPermissionRationale(
                Manifest.permission.ACCESS_FINE_LOCATION,
            )) {
            "denied"
        } else {
            "permanentlyDenied"
        }
    }

    private fun hasWifiHardware(): Boolean =
        packageManager.hasSystemFeature(PackageManager.FEATURE_WIFI)

    private fun hasFineLocationPermission(): Boolean =
        activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    @Suppress("DEPRECATION")
    private fun locationServicesEnabled(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            locationManager.isLocationEnabled
        } else {
            locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
        }

    private fun ensureNotDisposed() {
        if (disposed) {
            throw AndroidWifiScanException("disposed", "Wi-Fi scan bridge is disposed.")
        }
    }
}

internal class AndroidWifiScanException(
    val code: String,
    override val message: String,
) : RuntimeException(message)

internal enum class WifiScanBatchSource(val wireValue: String) {
    ACTIVE("active"),
    CACHED("cached"),
    PASSIVE("passive"),
}

internal data class AndroidWifiScanSnapshot(
    val completedAtMs: Long,
    val readings: List<Map<String, Any?>>,
    val startedAtMs: Long,
) {
    fun toWireResponse(source: WifiScanBatchSource): Map<String, Any> = mapOf(
        "schemaVersion" to WIFI_SCAN_SCHEMA_VERSION,
        "source" to source.wireValue,
        "startedAtMs" to startedAtMs,
        "completedAtMs" to completedAtMs,
        "readings" to readings,
    )
}

private fun expectControlArguments(call: MethodCall) {
    val arguments = call.arguments as? Map<*, *>
        ?: throw AndroidWifiScanException("scanFailed", "arguments must be a map")
    val schemaVersion = arguments["schemaVersion"] as? Number
        ?: throw AndroidWifiScanException("scanFailed", "schemaVersion must be an integer")
    if (
        schemaVersion.toInt() != WIFI_SCAN_SCHEMA_VERSION ||
        arguments.keys != setOf("schemaVersion")
    ) {
        throw AndroidWifiScanException("scanFailed", "unsupported Wi-Fi scan schema")
    }
}

private fun expectScanArguments(call: MethodCall): Boolean {
    val arguments = call.arguments as? Map<*, *>
        ?: throw AndroidWifiScanException("scanFailed", "arguments must be a map")
    val schemaVersion = arguments["schemaVersion"] as? Number
        ?: throw AndroidWifiScanException("scanFailed", "schemaVersion must be an integer")
    val requestActiveScan = arguments["requestActiveScan"] as? Boolean
        ?: throw AndroidWifiScanException("scanFailed", "requestActiveScan must be a bool")
    if (
        schemaVersion.toInt() != WIFI_SCAN_SCHEMA_VERSION ||
        arguments.keys != setOf("schemaVersion", "requestActiveScan")
    ) {
        throw AndroidWifiScanException("scanFailed", "unsupported Wi-Fi scan schema")
    }
    return requestActiveScan
}

private fun controlResponse(): Map<String, Any> = mapOf(
    "schemaVersion" to WIFI_SCAN_SCHEMA_VERSION,
)

@Suppress("DEPRECATION")
private fun ScanResult.toWireReading(
    completedAtMs: Long,
): Map<String, Any?>? {
    val normalizedBssid = normalizeBssid(BSSID ?: return null) ?: return null
    if (frequency <= 0) return null
    val observedAtMs = scanTimestampToEpochMs(
        scanTimestampMicros = timestamp,
        completedAtMs = completedAtMs,
        elapsedRealtimeMs = SystemClock.elapsedRealtime(),
    )
    return mapOf(
        "bssid" to normalizedBssid,
        "rssi" to level,
        "observedAtMs" to observedAtMs,
        "frequencyMhz" to frequency,
        "ssid" to SSID.trim().ifEmpty { null },
    )
}

internal fun normalizeBssid(value: String): String? {
    val normalized = value.trim().uppercase()
    return if (BSSID_PATTERN.matches(normalized)) normalized else null
}

internal fun scanTimestampToEpochMs(
    scanTimestampMicros: Long,
    completedAtMs: Long,
    elapsedRealtimeMs: Long,
): Long {
    val bootEpochMs = completedAtMs - elapsedRealtimeMs
    return (bootEpochMs + scanTimestampMicros / 1_000L).coerceIn(0L, completedAtMs)
}

private val BSSID_PATTERN = Regex("^[0-9A-F]{2}(?::[0-9A-F]{2}){5}$")
