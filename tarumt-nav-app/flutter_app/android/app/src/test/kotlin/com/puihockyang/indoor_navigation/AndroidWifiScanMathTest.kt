package com.puihockyang.indoor_navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AndroidWifiScanMathTest {
    @Test
    fun exposesStableScanBatchSourceWireValues() {
        assertEquals("active", WifiScanBatchSource.ACTIVE.wireValue)
        assertEquals("cached", WifiScanBatchSource.CACHED.wireValue)
        assertEquals("passive", WifiScanBatchSource.PASSIVE.wireValue)
    }

    @Test
    fun encodesCachedSnapshotsWithTheV3Contract() {
        val response = AndroidWifiScanSnapshot(
            completedAtMs = 200L,
            readings = emptyList(),
            startedAtMs = 100L,
        ).toWireResponse(WifiScanBatchSource.CACHED)

        assertEquals(3, response["schemaVersion"])
        assertEquals("cached", response["source"])
        assertEquals(100L, response["startedAtMs"])
        assertEquals(200L, response["completedAtMs"])
    }

    @Test
    fun normalizesOnlyCompleteBssids() {
        assertEquals("AA:BB:CC:DD:EE:FF", normalizeBssid(" aa:bb:cc:dd:ee:ff "))
        assertNull(normalizeBssid("AA:BB:CC"))
        assertNull(normalizeBssid("not-a-bssid"))
    }

    @Test
    fun convertsElapsedRealtimeScanTimestampToEpochMilliseconds() {
        assertEquals(
            1_699_999_995_000L,
            scanTimestampToEpochMs(
                scanTimestampMicros = 45_000_000L,
                completedAtMs = 1_700_000_000_000L,
                elapsedRealtimeMs = 50_000L,
            ),
        )
    }

    @Test
    fun clampsInvalidFutureScanTimestampToCompletionTime() {
        assertEquals(
            100_000L,
            scanTimestampToEpochMs(
                scanTimestampMicros = 200_000_000L,
                completedAtMs = 100_000L,
                elapsedRealtimeMs = 50_000L,
            ),
        )
    }
}
