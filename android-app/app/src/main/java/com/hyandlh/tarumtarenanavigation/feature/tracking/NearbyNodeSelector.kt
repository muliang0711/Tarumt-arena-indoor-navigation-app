package com.hyandlh.tarumtarenanavigation.feature.tracking

import com.hyandlh.tarumtarenanavigation.core.model.AccessPointCatalog
import com.hyandlh.tarumtarenanavigation.core.model.Node
import com.hyandlh.tarumtarenanavigation.core.model.PositionEstimate
import com.hyandlh.tarumtarenanavigation.core.motion.MotionSnapshot
import javax.inject.Inject
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

data class NearbyNodeSelection(
    val nodeIds: Set<String>,
    val thresholdMeters: Double,
    val directionalLookaheadMeters: Double,
    val headingDegrees: Float?,
    val walkingSpeedMetersPerSecond: Double,
    val motionSource: String,
    val usedNearestFallback: Boolean
)

class NearbyNodeSelector @Inject constructor() {

    fun select(
        estimate: PositionEstimate,
        catalog: AccessPointCatalog,
        baseThresholdMeters: Double,
        motion: MotionSnapshot
    ): NearbyNodeSelection {
        val nodesOnFloor = catalog.nodes.values
            .filter { it.enabled && it.floorId == estimate.floorId }

        if (nodesOnFloor.isEmpty()) {
            return NearbyNodeSelection(
                nodeIds = emptySet(),
                thresholdMeters = normalizedThreshold(baseThresholdMeters),
                directionalLookaheadMeters = 0.0,
                headingDegrees = motion.headingDegrees,
                walkingSpeedMetersPerSecond = motion.walkingSpeedMetersPerSecond,
                motionSource = motion.source,
                usedNearestFallback = false
            )
        }

        val baseThreshold = normalizedThreshold(baseThresholdMeters)
        val speed = motion.walkingSpeedMetersPerSecond.coerceIn(0.0, MAX_WALKING_SPEED_METERS_PER_SECOND)
        val speedExpansion = (speed * SPEED_THRESHOLD_SECONDS).coerceAtMost(MAX_SPEED_EXPANSION_METERS)
        val threshold = baseThreshold + speedExpansion
        val directionalLookahead = threshold + speedExpansion
        val forwardVector = motion.headingDegrees?.let { headingToUnitVector(it) }

        val selected = nodesOnFloor.filter { node ->
            val distance = distanceBetween(estimate, node)
            distance <= threshold ||
                isAheadOfUser(
                    estimate = estimate,
                    node = node,
                    distance = distance,
                    forwardVector = forwardVector,
                    maxForwardMeters = directionalLookahead,
                    maxSideMeters = baseThreshold / 2.0 + speed
                )
        }.map { it.nodeId }.toSet()

        if (selected.isNotEmpty()) {
            return NearbyNodeSelection(
                nodeIds = selected,
                thresholdMeters = threshold,
                directionalLookaheadMeters = directionalLookahead,
                headingDegrees = motion.headingDegrees,
                walkingSpeedMetersPerSecond = speed,
                motionSource = motion.source,
                usedNearestFallback = false
            )
        }

        val nearest = nodesOnFloor.minBy { distanceBetween(estimate, it) }
        return NearbyNodeSelection(
            nodeIds = setOf(nearest.nodeId),
            thresholdMeters = threshold,
            directionalLookaheadMeters = directionalLookahead,
            headingDegrees = motion.headingDegrees,
            walkingSpeedMetersPerSecond = speed,
            motionSource = motion.source,
            usedNearestFallback = true
        )
    }

    private fun normalizedThreshold(value: Double): Double {
        return value.coerceIn(MIN_THRESHOLD_METERS, MAX_THRESHOLD_METERS)
    }

    private fun isAheadOfUser(
        estimate: PositionEstimate,
        node: Node,
        distance: Double,
        forwardVector: Pair<Double, Double>?,
        maxForwardMeters: Double,
        maxSideMeters: Double
    ): Boolean {
        if (forwardVector == null || distance == 0.0) return false

        val dx = node.x - estimate.x
        val dy = node.y - estimate.y
        val forwardMeters = dx * forwardVector.first + dy * forwardVector.second
        if (forwardMeters <= 0.0 || forwardMeters > maxForwardMeters) return false

        val sideMeters = sqrt(max(0.0, distance.pow(2) - forwardMeters.pow(2)))
        return sideMeters <= maxSideMeters
    }

    private fun headingToUnitVector(headingDegrees: Float): Pair<Double, Double> {
        val radians = headingDegrees.toDouble() * PI / 180.0
        return sin(radians) to cos(radians)
    }

    private fun distanceBetween(estimate: PositionEstimate, node: Node): Double {
        return sqrt(abs(node.x - estimate.x).pow(2) + abs(node.y - estimate.y).pow(2))
    }

    private companion object {
        const val MIN_THRESHOLD_METERS = 1.0
        const val MAX_THRESHOLD_METERS = 100.0
        const val MAX_WALKING_SPEED_METERS_PER_SECOND = 2.5
        const val SPEED_THRESHOLD_SECONDS = 2.5
        const val MAX_SPEED_EXPANSION_METERS = 8.0
    }
}
