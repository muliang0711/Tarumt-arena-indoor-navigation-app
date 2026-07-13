package com.hyandlh.tarumtarenanavigation.feature.tracking

import com.hyandlh.tarumtarenanavigation.core.model.AccessPointCatalog
import com.hyandlh.tarumtarenanavigation.core.model.Node
import com.hyandlh.tarumtarenanavigation.core.model.NodeType
import com.hyandlh.tarumtarenanavigation.core.model.PositionEstimate
import com.hyandlh.tarumtarenanavigation.core.motion.MotionSnapshot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NearbyNodeSelectorTest {

    private val selector = NearbyNodeSelector()

    @Test
    fun `select includes nodes within speed-expanded threshold`() {
        val selection = selector.select(
            estimate = estimateAtOrigin(),
            catalog = catalogWith(
                Node("near", "2", 4.0, 0.0, NodeType.JUNCTION),
                Node("speed-expanded", "2", 7.0, 0.0, NodeType.JUNCTION),
                Node("far", "2", 20.0, 0.0, NodeType.JUNCTION)
            ),
            baseThresholdMeters = 5.0,
            motion = MotionSnapshot(
                headingDegrees = null,
                walkingSpeedMetersPerSecond = 1.0,
                source = "test"
            )
        )

        assertTrue(selection.nodeIds.contains("near"))
        assertTrue(selection.nodeIds.contains("speed-expanded"))
        assertFalse(selection.nodeIds.contains("far"))
        assertEquals(7.5, selection.thresholdMeters, 0.001)
    }

    @Test
    fun `select includes nodes ahead of current heading inside directional lookahead`() {
        val selection = selector.select(
            estimate = estimateAtOrigin(),
            catalog = catalogWith(
                Node("ahead", "2", 0.0, 9.0, NodeType.JUNCTION),
                Node("behind", "2", 0.0, -9.0, NodeType.JUNCTION),
                Node("side", "2", 9.0, 9.0, NodeType.JUNCTION)
            ),
            baseThresholdMeters = 5.0,
            motion = MotionSnapshot(
                headingDegrees = 0f,
                walkingSpeedMetersPerSecond = 1.0,
                source = "test"
            )
        )

        assertTrue(selection.nodeIds.contains("ahead"))
        assertFalse(selection.nodeIds.contains("behind"))
        assertFalse(selection.nodeIds.contains("side"))
    }

    @Test
    fun `select falls back to nearest node when none are close`() {
        val selection = selector.select(
            estimate = estimateAtOrigin(),
            catalog = catalogWith(
                Node("nearest", "2", 12.0, 0.0, NodeType.JUNCTION),
                Node("farther", "2", 20.0, 0.0, NodeType.JUNCTION)
            ),
            baseThresholdMeters = 5.0,
            motion = MotionSnapshot(
                headingDegrees = null,
                walkingSpeedMetersPerSecond = 0.0,
                source = "test"
            )
        )

        assertEquals(setOf("nearest"), selection.nodeIds)
        assertTrue(selection.usedNearestFallback)
    }

    private fun estimateAtOrigin(): PositionEstimate {
        return PositionEstimate(0.0, 0.0, "2", 1.0, 1000L)
    }

    private fun catalogWith(vararg nodes: Node): AccessPointCatalog {
        return AccessPointCatalog(
            version = "test",
            nodes = nodes.associateBy { it.nodeId },
            lastUpdated = 1000L
        )
    }
}
