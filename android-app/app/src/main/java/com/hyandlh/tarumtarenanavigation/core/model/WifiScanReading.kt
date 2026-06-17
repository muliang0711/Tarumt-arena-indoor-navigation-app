package com.hyandlh.tarumtarenanavigation.core.model

/**
 * A single reading from a Wi-Fi Access Point.
 */
data class WifiScanReading(
    val bssid: String,
    val rssi: Int,
    val timestamp: Long,
    val frequency: Int? = null,
    val ssid: String? = null,
    val metadata: Map<String, String> = emptyMap()
)
