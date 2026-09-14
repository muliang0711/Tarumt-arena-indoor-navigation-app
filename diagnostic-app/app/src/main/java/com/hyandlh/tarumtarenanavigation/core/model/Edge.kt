package com.hyandlh.tarumtarenanavigation.core.model

/**
 * A traversable edge between two nodes.
 */
data class Edge(
    val edgeId: String,
    val fromNode: String,
    val toNode: String,
    val bidirectional: Boolean = true,
    val weight: Double,
    val distanceM: Double,
    val timeS: Double? = null,
    val accessibility: String = "standard",
    val enabled: Boolean = true,
    val properties: Map<String, String> = emptyMap()
)
