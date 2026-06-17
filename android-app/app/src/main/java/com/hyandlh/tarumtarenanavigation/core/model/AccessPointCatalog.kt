package com.hyandlh.tarumtarenanavigation.core.model

/**
 * A collection of known Access Point locations.
 */
data class AccessPointCatalog(
    val version: String,
    val locations: Map<String, AccessPointLocation>,
    val lastUpdated: Long
)
