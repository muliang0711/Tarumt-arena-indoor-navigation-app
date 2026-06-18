package com.hyandlh.tarumtarenanavigation.core.wifi

import com.hyandlh.tarumtarenanavigation.core.model.WifiScanReading
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class AndroidWifiScannerTest {

    @Test
    fun `fake scanner emits snapshots correctly`() {
        // Arrange
        val fakeScanner = FakeWifiScanner()
        val readings = listOf(
            WifiScanReading("00:11:22:33:44:55", -50, System.currentTimeMillis()),
            WifiScanReading("66:77:88:99:AA:BB", -70, System.currentTimeMillis())
        )
        val expectedSnapshot = WifiScanSnapshot(
            timestamp = System.currentTimeMillis(),
            readings = readings
        )

        // Act
        fakeScanner.emitSnapshot(expectedSnapshot)

        // Assert
        val actualSnapshot = fakeScanner.scanResults.value
        assertNotNull(actualSnapshot)
        assertEquals(expectedSnapshot.readings.size, actualSnapshot.readings.size)
        assertEquals(expectedSnapshot.readings[0].bssid, actualSnapshot.readings[0].bssid)
        assertEquals(expectedSnapshot.readings[1].rssi, actualSnapshot.readings[1].rssi)
    }

    @Test
    fun `fake scanner handles failure state updates`() {
        // Arrange
        val fakeScanner = FakeWifiScanner()

        // Act
        fakeScanner.setFailure(WifiScanFailure.WifiDisabled)

        // Assert
        assertEquals(WifiScanFailure.WifiDisabled, fakeScanner.failureState.value)
    }
}
