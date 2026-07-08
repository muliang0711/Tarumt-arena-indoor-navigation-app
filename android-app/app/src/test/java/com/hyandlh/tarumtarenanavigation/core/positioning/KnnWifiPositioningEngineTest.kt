package com.hyandlh.tarumtarenanavigation.core.positioning

import com.hyandlh.tarumtarenanavigation.core.model.*
import com.hyandlh.tarumtarenanavigation.core.common.AppLogger
import com.hyandlh.tarumtarenanavigation.core.observability.DiagnosticsRecorder
import com.hyandlh.tarumtarenanavigation.core.observability.HealthHeartbeat
import com.hyandlh.tarumtarenanavigation.core.observability.InMemoryLogStore
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class KnnWifiPositioningEngineTest {

    private lateinit var smoother: PositionSmoother

    private lateinit var diagnostics: DiagnosticsRecorder
    private lateinit var healthHeartbeat: HealthHeartbeat

    private lateinit var engine: KnnWifiPositioningEngine

    @Before
    fun setup() {
        val logger = NoOpLogger()
        val logStore = InMemoryLogStore()
        smoother = object : PositionSmoother {
            override fun smooth(newEstimate: PositionEstimate): PositionEstimate = newEstimate
            override fun reset() = Unit
        }
        diagnostics = DiagnosticsRecorder(logger, logStore)
        healthHeartbeat = HealthHeartbeat(logger, logStore)

        engine = KnnWifiPositioningEngine(smoother, diagnostics, healthHeartbeat)
    }

    @Test
    fun `calculatePosition returns coordinates close to best signal match`() = runBlocking {
        // Live scan matches loc1 perfectly
        val readings = listOf(
            WifiScanReading("ap1", -50, 1000L),
            WifiScanReading("ap2", -60, 1000L)
        )
        val snapshot = WifiScanSnapshot(1000L, readings)
        val fingerprints = listOf(
            FingerprintEntry(
                locationId = "loc1",
                timestamp = 1000L,
                scanId = 1,
                apList = listOf(FingerprintAP("ap1", -50), FingerprintAP("ap2", -60))
            ),
            FingerprintEntry(
                locationId = "loc2",
                timestamp = 1000L,
                scanId = 2,
                apList = listOf(FingerprintAP("ap1", -80), FingerprintAP("ap2", -90))
            )
        )
        val nodes = mapOf(
            "loc1" to Node("loc1", "floor1", 10.0, 10.0, NodeType.JUNCTION),
            "loc2" to Node("loc2", "floor1", 20.0, 20.0, NodeType.JUNCTION)
        )
        val catalog = AccessPointCatalog(
            version = "1",
            fingerprints = fingerprints,
            nodes = nodes,
            lastUpdated = 1000L
        )

        val result = engine.calculatePosition(snapshot, catalog, nodes.keys)

        // Result should be very close to loc1 (10, 10)
        assertEquals(10.0, result.x, 1.0)
        assertEquals(10.0, result.y, 1.0)
        assertEquals("floor1", result.floorId)
    }

    private class NoOpLogger : AppLogger {
        override fun d(tag: String, message: String) = Unit
        override fun i(tag: String, message: String) = Unit
        override fun w(tag: String, message: String, throwable: Throwable?) = Unit
        override fun e(tag: String, message: String, throwable: Throwable?) = Unit
    }
}
