package com.hyandlh.tarumtarenanavigation.core.positioning.remote

import com.hyandlh.tarumtarenanavigation.core.model.WifiScanReading
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import org.junit.Assert.assertEquals
import org.junit.Test

class PositioningRequestTest {
    @Test
    fun fromSnapshotSendsAllReadingsForCrowdednessCompatibleInference() {
        val target = WifiScanReading(
            bssid = "target-ap",
            rssi = -50,
            timestamp = 123L,
            ssid = "TARUMT-ARENA"
        )
        val foreign = WifiScanReading(
            bssid = "foreign-ap",
            rssi = -60,
            timestamp = 123L,
            ssid = "visitor"
        )
        val snapshot = WifiScanSnapshot(
            timestamp = 123L,
            readings = listOf(target),
            allReadings = listOf(target, foreign)
        )

        val request = PositioningRequest.fromSnapshot(snapshot, setOf("node-b", "node-a"))

        assertEquals(listOf(target, foreign), request.readings)
        assertEquals(listOf("node-a", "node-b"), request.checkedNodeIds)
    }
}
