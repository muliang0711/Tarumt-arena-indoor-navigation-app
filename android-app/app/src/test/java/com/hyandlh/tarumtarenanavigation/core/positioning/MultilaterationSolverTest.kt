package com.hyandlh.tarumtarenanavigation.core.positioning

import com.hyandlh.tarumtarenanavigation.core.model.AccessPointLocation
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MultilaterationSolverTest {

    private val solver = MultilaterationSolver()

    @Test
    fun `solve returns weighted center of AP locations`() {
        // Arrange
        val ap1 = AccessPointLocation("ap1", 0.0, 0.0, "floor1")
        val ap2 = AccessPointLocation("ap2", 10.0, 0.0, "floor1")
        val timestamp = 12345L
        
        // Equal RSSI should result in the midpoint
        val matches = listOf(
            APMatcher.MatchedReading("ap1", -50, ap1),
            APMatcher.MatchedReading("ap2", -50, ap2)
        )

        // Act
        val result = solver.solve(matches, timestamp)

        // Assert
        assertEquals(5.0, result.x, 0.1)
        assertEquals(0.0, result.y, 0.1)
        assertEquals("floor1", result.floorId)
        assertEquals(timestamp, result.timestamp)
        assertTrue(result.confidence > 0)
    }

    @Test
    fun `solve favors stronger signals`() {
        // Arrange
        val ap1 = AccessPointLocation("ap1", 0.0, 0.0, "floor1")
        val ap2 = AccessPointLocation("ap2", 10.0, 0.0, "floor1")
        val timestamp = 12345L
        
        // ap1 is much stronger than ap2
        val matches = listOf(
            APMatcher.MatchedReading("ap1", -30, ap1),
            APMatcher.MatchedReading("ap2", -80, ap2)
        )

        // Act
        val result = solver.solve(matches, timestamp)

        // Assert
        // The result should be significantly closer to ap1 (0,0) than ap2 (10,0)
        assertTrue("X should be closer to 0 than 5", result.x < 2.0)
        assertEquals(timestamp, result.timestamp)
    }

    @Test
    fun `solve returns zero for empty matches`() {
        val timestamp = 12345L
        val result = solver.solve(emptyList(), timestamp)
        assertEquals(0.0, result.x, 0.0)
        assertEquals(0.0, result.y, 0.0)
        assertEquals(timestamp, result.timestamp)
        assertEquals(0.0, result.confidence, 0.0)
    }
}
