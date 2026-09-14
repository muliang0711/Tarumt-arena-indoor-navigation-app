package com.hyandlh.tarumtarenanavigation.core.model

/**
 * A batch of Wi-Fi readings captured at a single point in time.
 */
data class WifiScanSnapshot(
    val timestamp: Long,
    val readings: List<WifiScanReading>,
    val allReadings: List<WifiScanReading> = readings,
    val metadata: Map<String, String> = emptyMap()
)
