package com.hyandlh.tarumtarenanavigation.core.model

/**
 * A collection of known Access Point locations and/or Fingerprint data.
 */
data class AccessPointCatalog(
    val version: String,
    val locations: Map<String, AccessPointLocation> = emptyMap(),
    val fingerprints: List<FingerprintEntry> = emptyList(),
    val nodes: Map<String, Node> = emptyMap(),
    val lastUpdated: Long
)
