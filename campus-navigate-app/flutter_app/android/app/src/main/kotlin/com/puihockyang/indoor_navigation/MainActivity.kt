package com.puihockyang.indoor_navigation

import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    private var motionBridge: AndroidMotionBridge? = null
    private var wifiScanBridge: AndroidWifiScanBridge? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        @Suppress("DEPRECATION")
        val displayRotationProvider = { windowManager.defaultDisplay.rotation }
        motionBridge = AndroidMotionBridge(
            context = this,
            messenger = flutterEngine.dartExecutor.binaryMessenger,
            displayRotationProvider = displayRotationProvider,
        )
        wifiScanBridge = AndroidWifiScanBridge(
            activity = this,
            messenger = flutterEngine.dartExecutor.binaryMessenger,
        )
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        val handled = wifiScanBridge?.onRequestPermissionsResult(
            requestCode,
            permissions,
            grantResults,
        ) ?: false
        if (!handled) {
            super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        }
    }

    override fun cleanUpFlutterEngine(flutterEngine: FlutterEngine) {
        wifiScanBridge?.close()
        wifiScanBridge = null
        motionBridge?.close()
        motionBridge = null
        super.cleanUpFlutterEngine(flutterEngine)
    }
}
