package com.hyandlh.tarumtarenanavigation.core.common

import org.junit.Assert.assertEquals
import org.junit.Test

class CoordinateConverterTest {

    private val converter = CoordinateConverter()

    @Test
    fun `origin pixel maps to zero nav coordinates`() {
        val (navX, navY) = converter.toNavCoords(940.1506f, 3219.9489f)
        assertEquals(0.0, navX, 0.01)
        assertEquals(0.0, navY, 0.01)
    }

    @Test
    fun `zero nav coordinates map to origin pixels`() {
        val (pxX, pxY) = converter.toPixels(0.0, 0.0)
        assertEquals(940.1506f, pxX, 0.01f)
        assertEquals(3219.9489f, pxY, 0.01f)
    }

    @Test
    fun `calibration point P2X maps correctly`() {
        // P2X Nav value is 170.971185, px is 3834.4108
        val (pxX, pxY) = converter.toPixels(170.971185, 0.0)
        assertEquals(3834.4108f, pxX, 0.01f)
        assertEquals(3219.9489f, pxY, 0.01f)
    }

    @Test
    fun `calibration point P2Y maps correctly`() {
        // P2Y Nav value is 50.63209269, px is 2362.783
        val (pxX, pxY) = converter.toPixels(0.0, 50.63209269)
        assertEquals(940.1506f, pxX, 0.01f)
        assertEquals(2362.783f, pxY, 0.01f)
    }
}
