package com.hyandlh.tarumtarenanavigation.core.model

/**
 * A recorded signal pattern at a specific location.
 */
data class FingerprintEntry(
    val locationId: String,
    val timestamp: Long,
    val scanId: Int,
    val apList: List<FingerprintAP>,
    val sessionId: String? = null,
    val orientation: String? = null
)

/**
 * A single AP reading within a fingerprint.
 */
data class FingerprintAP(
    val bssid: String,
    val rssi: Int,
    val channel: Int? = null
)
