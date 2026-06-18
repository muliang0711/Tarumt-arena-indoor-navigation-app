package com.hyandlh.tarumtarenanavigation.core.positioning

import com.hyandlh.tarumtarenanavigation.core.model.WifiScanReading
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import org.junit.Assert.assertEquals
import org.junit.Test

class SignalPreprocessorTest {

    private val preprocessor = SignalPreprocessor()

    @Test
    fun `preprocess filters out weak signals`() {
        // Arrange
        val readings = listOf(
            WifiScanReading("ap1", -50, 1000L),  // Strong
            WifiScanReading("ap2", -95, 1000L),  // Too weak (threshold is -90)
            WifiScanReading("ap3", -89, 1000L)   // Just above threshold
        )
        val snapshot = WifiScanSnapshot(1000L, readings)

        // Act
        val result = preprocessor.preprocess(snapshot)

        // Assert
        assertEquals(2, result.readings.size)
        assertEquals("ap1", result.readings[0].bssid)
        assertEquals("ap3", result.readings[1].bssid)
    }

    @Test
    fun `preprocess keeps all signals if all are strong`() {
        val readings = listOf(
            WifiScanReading("ap1", -40, 1000L),
            WifiScanReading("ap2", -70, 1000L)
        )
        val snapshot = WifiScanSnapshot(1000L, readings)
        val result = preprocessor.preprocess(snapshot)
        assertEquals(2, result.readings.size)
    }
}
