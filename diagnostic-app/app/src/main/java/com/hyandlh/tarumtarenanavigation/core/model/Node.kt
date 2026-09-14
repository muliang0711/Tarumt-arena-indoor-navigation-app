package com.hyandlh.tarumtarenanavigation.core.model

/** A coordinate in one node coordinate frame. */
data class NodeCoordinate(
    val x: Double,
    val y: Double
)

/** Coordinate frames supplied by the node registry. */
data class NodeCoordinates(
    val lh: NodeCoordinate,
    val xy: NodeCoordinate
) {
    companion object {
        fun same(x: Double, y: Double): NodeCoordinates {
            val coordinate = NodeCoordinate(x, y)
            return NodeCoordinates(lh = coordinate, xy = coordinate)
        }
    }
}

/**
 * A node in the navigation graph.
 *
 * Android navigation and map code accesses [x] and [y], which are deliberately backed by the
 * `coordinates.lh` registry frame. The `coordinates.xy` frame remains available explicitly for
 * diagnostics or contracts that require the future Flutter coordinate system.
 */
data class Node(
    val nodeId: String,
    val floorId: String,
    val coordinates: NodeCoordinates,
    val type: NodeType,
    val name: String? = null,
    val enabled: Boolean = true,
    val metadata: Map<String, String> = emptyMap(),
    val buildingId: String = "default",
    val positioningEnabled: Boolean = true
) {
    val x: Double
        get() = coordinates.lh.x

    val y: Double
        get() = coordinates.lh.y

    /** Keeps local fixtures concise while producing the same nested coordinate model. */
    constructor(
        nodeId: String,
        floorId: String,
        x: Double,
        y: Double,
        type: NodeType,
        name: String? = null,
        enabled: Boolean = true,
        metadata: Map<String, String> = emptyMap(),
        buildingId: String = "default",
        positioningEnabled: Boolean = true
    ) : this(
        nodeId = nodeId,
        floorId = floorId,
        coordinates = NodeCoordinates.same(x, y),
        type = type,
        name = name,
        enabled = enabled,
        metadata = metadata,
        buildingId = buildingId,
        positioningEnabled = positioningEnabled
    )
}

enum class NodeType {
    DESTINATION, JUNCTION, STAIRS, ELEVATOR
}
