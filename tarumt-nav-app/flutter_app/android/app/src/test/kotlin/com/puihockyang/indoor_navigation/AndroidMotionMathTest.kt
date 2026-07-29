package com.puihockyang.indoor_navigation

import kotlin.math.PI
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test

class AndroidMotionMathTest {
    @Test
    fun normalizesHeadingRadiansIntoNavigationDegrees() {
        assertEquals(0.0, normalizeHeadingRadians(0f), 0.0001)
        assertEquals(90.0, normalizeHeadingRadians((PI / 2).toFloat()), 0.0001)
        assertEquals(270.0, normalizeHeadingRadians((-PI / 2).toFloat()), 0.0001)
    }

    @Test
    fun gravityFilterRemovesStaticAccelerationAndCanReset() {
        val filter = GravityFilter(smoothing = 0.5f)

        assertArrayEquals(floatArrayOf(0f, 0f, 0f), filter.removeGravity(floatArrayOf(0f, 0f, 9.8f)), 0.0001f)
        assertArrayEquals(floatArrayOf(1f, 0f, 0f), filter.removeGravity(floatArrayOf(2f, 0f, 9.8f)), 0.0001f)

        filter.reset()
        assertArrayEquals(floatArrayOf(0f, 0f, 0f), filter.removeGravity(floatArrayOf(3f, 2f, 9.8f)), 0.0001f)
    }
}
