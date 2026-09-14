package com.hyandlh.tarumtarenanavigation.core.positioning

import com.hyandlh.tarumtarenanavigation.core.model.AccessPointCatalog
import com.hyandlh.tarumtarenanavigation.core.model.FingerprintAP
import com.hyandlh.tarumtarenanavigation.core.model.FingerprintEntry
import com.hyandlh.tarumtarenanavigation.core.model.Node
import com.hyandlh.tarumtarenanavigation.core.model.NodeType
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanReading
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class KnnDiagnosticsAnalyzerTest {

    private val analyzer = KnnDiagnosticsAnalyzer()

    @Test
    fun `analyze includes normalized distance for every eligible fingerprint`() {
        val snapshot = WifiScanSnapshot(
            timestamp = 1000L,
            readings = listOf(
                WifiScanReading("ap1", -50, 1000L),
                WifiScanReading("ap2", -60, 1000L),
                WifiScanReading("ap3", -70, 1000L)
            )
        )
        val catalog = AccessPointCatalog(
            version = "test",
            fingerprints = listOf(
                fingerprint("node-1", 1, -50, -60),
                fingerprint("node-2", 2, -55, -65),
                fingerprint("node-3", 3, -70, -80),
                fingerprint("node-4", 4, -85, -85)
            ),
            nodes = (1..4).associate { index ->
                "node-$index" to Node(
                    nodeId = "node-$index",
                    floorId = "2",
                    x = index.toDouble(),
                    y = index.toDouble(),
                    type = NodeType.JUNCTION
                )
            },
            lastUpdated = 1000L
        )

        val report = analyzer.analyze(snapshot, catalog)

        assertEquals(4, report.allFingerprintDistances.size)
        assertEquals(listOf(1, 2, 3, 4), report.allFingerprintDistances.map { it.rank })
        assertEquals(setOf(1, 2, 3), report.allFingerprintDistances.filter { it.isSelectedNeighbor }.map { it.scanId }.toSet())
        assertFalse(report.allFingerprintDistances.first { it.scanId == 4 }.isSelectedNeighbor)
        assertTrue(report.allFingerprintDistances.zipWithNext().all { (left, right) ->
            left.distance <= right.distance
        })
    }

    private fun fingerprint(locationId: String, scanId: Int, ap1Rssi: Int, ap2Rssi: Int): FingerprintEntry {
        return FingerprintEntry(
            locationId = locationId,
            timestamp = 1000L,
            scanId = scanId,
            apList = listOf(
                FingerprintAP("ap1", ap1Rssi),
                FingerprintAP("ap2", ap2Rssi),
                FingerprintAP("ap3", -70)
            )
        )
    }
}
