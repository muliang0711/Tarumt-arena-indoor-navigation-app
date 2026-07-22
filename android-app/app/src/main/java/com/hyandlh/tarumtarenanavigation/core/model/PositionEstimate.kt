package com.hyandlh.tarumtarenanavigation.core.model

/**
 * An estimated user position.
 */
data class PositionEstimate(
    val x: Double,
    val y: Double,
    val floorId: String,
    val confidence: Double,
    val timestamp: Long,
    val diagnostics: Map<String, String> = emptyMap(),
    val buildingId: String = "default"
)
