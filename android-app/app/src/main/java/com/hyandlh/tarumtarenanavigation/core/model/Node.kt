package com.hyandlh.tarumtarenanavigation.core.model

/**
 * A node in the navigation graph.
 */
data class Node(
    val nodeId: String,
    val floorId: String,
    val x: Double,
    val y: Double,
    val type: NodeType,
    val name: String? = null,
    val enabled: Boolean = true,
    val metadata: Map<String, String> = emptyMap()
)

enum class NodeType {
    DESTINATION, JUNCTION, STAIRS, ELEVATOR
}
