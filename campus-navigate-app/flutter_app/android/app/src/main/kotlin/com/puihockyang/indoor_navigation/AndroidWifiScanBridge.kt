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

internal const val WIFI_SCAN_SCHEMA_VERSION = 1
private const val WIFI_SCAN_METHOD_CHANNEL = "indoor_navigation/wifi_scan/methods/v1"
private const val WIFI_PERMISSION_REQUEST_CODE = 41_021
private const val WIFI_PERMISSION_REQUESTED_KEY = "fineLocationPermissionRequested"
private const val WIFI_PERMISSION_PREFERENCES = "wifiScanPermissions"
private const val WIFI_SCAN_TIMEOUT_MS = 15_000L

internal class AndroidWifiScanBridge(
    private val activity: Activity,
    messenger: BinaryMessenger,
) {
    private val handler = Handler(Looper.getMainLooper())
    private val locationManager =
        activity.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private val methodChannel = MethodChannel(messenger, WIFI_SCAN_METHOD_CHANNEL)
    private val packageManager = activity.packageManager
    private val preferences = activity.getSharedPreferences(
        WIFI_PERMISSION_PREFERENCES,
        Context.MODE_PRIVATE,
    )
    private val wifiManager =
        activity.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager

    private var disposed = false
    private var pendingPermissionResult: MethodChannel.Result? = null
    private var pendingScanResult: MethodChannel.Result? = null
    private var scanStartedAtMs: Long? = null

    private val scanReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != WifiManager.SCAN_RESULTS_AVAILABLE_ACTION) return
            val updated = intent.getBooleanExtra(WifiManager.EXTRA_RESULTS_UPDATED, false)
            if (!updated) {
                finishScanWithError(
                    "scanFailed",
                    "Android did not provide a newly updated Wi-Fi scan result.",
                )
                return
            }
            finishScanWithResults()
        }
    }

    private val scanTimeout = Runnable {
        finishScanWithError("scanFailed", "Wi-Fi scan timed out.")
    }

    init {
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
            expectSchemaVersion(call)
            when (call.method) {
                "checkAccess" -> {
                    ensureNotDisposed()
                    result.success(accessState())
                }
                "requestPermission" -> requestPermission(result)
                "scan" -> startScan(result)
                "dispose" -> {
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
    private fun startScan(result: MethodChannel.Result) {
        ensureNotDisposed()
        requireScanReady()
        if (pendingScanResult != null) {
            throw AndroidWifiScanException(
                "scanInProgress",
                "A Wi-Fi scan is already active.",
            )
        }

        registerScanReceiver()
        pendingScanResult = result
        scanStartedAtMs = System.currentTimeMillis()
        handler.postDelayed(scanTimeout, WIFI_SCAN_TIMEOUT_MS)
        val accepted = try {
            wifiManager.startScan()
        } catch (error: RuntimeException) {
            clearPendingScan()
            throw error
        }
        if (!accepted) {
            clearPendingScan()
            throw AndroidWifiScanException(
                "scanThrottled",
                "Android rejected the Wi-Fi scan; scanning may be throttled.",
            )
        }
    }

    @Suppress("DEPRECATION")
    private fun finishScanWithResults() {
        val result = pendingScanResult ?: return
        val startedAt = scanStartedAtMs ?: return
        val completedAt = System.currentTimeMillis()
        try {
            val readings = wifiManager.scanResults
                .mapNotNull { scanResult ->
                    scanResult.toWireReading(
                        completedAtMs = completedAt,
                        startedAtMs = startedAt,
                    )
                }
                .sortedBy { reading -> reading["bssid"] as String }
            clearPendingScan()
            result.success(
                mapOf(
                    "schemaVersion" to WIFI_SCAN_SCHEMA_VERSION,
                    "startedAtMs" to startedAt,
                    "completedAtMs" to completedAt,
                    "readings" to readings,
                ),
            )
        } catch (error: SecurityException) {
            clearPendingScan()
            result.error(
                "permissionDenied",
                error.message ?: "Android denied Wi-Fi scan result access.",
                null,
            )
        } catch (error: RuntimeException) {
            clearPendingScan()
            result.error(
                "scanFailed",
                error.message ?: "Android could not read Wi-Fi scan results.",
                null,
            )
        }
    }

    private fun finishScanWithError(code: String, message: String) {
        val result = pendingScanResult ?: return
        clearPendingScan()
        result.error(code, message, null)
    }

    private fun clearPendingScan() {
        handler.removeCallbacks(scanTimeout)
        pendingScanResult = null
        scanStartedAtMs = null
        try {
            activity.unregisterReceiver(scanReceiver)
        } catch (_: IllegalArgumentException) {
            // The receiver was not registered or was already removed.
        }
    }

    private fun registerScanReceiver() {
        val filter = IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            activity.registerReceiver(scanReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            activity.registerReceiver(scanReceiver, filter)
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

private fun expectSchemaVersion(call: MethodCall) {
    val arguments = call.arguments as? Map<*, *>
        ?: throw AndroidWifiScanException("scanFailed", "arguments must be a map")
    val schemaVersion = arguments["schemaVersion"] as? Number
        ?: throw AndroidWifiScanException("scanFailed", "schemaVersion must be an integer")
    if (schemaVersion.toInt() != WIFI_SCAN_SCHEMA_VERSION || arguments.size != 1) {
        throw AndroidWifiScanException("scanFailed", "unsupported Wi-Fi scan schema")
    }
}

private fun controlResponse(): Map<String, Any> = mapOf(
    "schemaVersion" to WIFI_SCAN_SCHEMA_VERSION,
)

@Suppress("DEPRECATION")
private fun ScanResult.toWireReading(
    completedAtMs: Long,
    startedAtMs: Long,
): Map<String, Any?>? {
    val normalizedBssid = normalizeBssid(BSSID ?: return null) ?: return null
    if (frequency <= 0) return null
    val observedAtMs = scanTimestampToEpochMs(
        scanTimestampMicros = timestamp,
        completedAtMs = completedAtMs,
        elapsedRealtimeMs = SystemClock.elapsedRealtime(),
    )
    if (observedAtMs < startedAtMs) return null
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
