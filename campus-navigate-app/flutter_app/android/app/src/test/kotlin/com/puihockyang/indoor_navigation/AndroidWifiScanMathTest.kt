package com.puihockyang.indoor_navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AndroidWifiScanMathTest {
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
