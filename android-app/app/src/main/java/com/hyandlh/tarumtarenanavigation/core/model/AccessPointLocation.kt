package com.hyandlh.tarumtarenanavigation.core.model

/**
 * Known location and properties of an Access Point.
 */
data class AccessPointLocation(
    val bssid: String,
    val x: Double,
    val y: Double,
    val floorId: String,
    val confidence: Double = 1.0,
    val metadata: Map<String, String> = emptyMap()
)
