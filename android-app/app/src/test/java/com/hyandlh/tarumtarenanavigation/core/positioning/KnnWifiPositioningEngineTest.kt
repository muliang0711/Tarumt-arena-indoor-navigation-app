package com.hyandlh.tarumtarenanavigation.core.positioning

import com.hyandlh.tarumtarenanavigation.core.model.*
import com.hyandlh.tarumtarenanavigation.core.observability.DiagnosticsRecorder
import com.hyandlh.tarumtarenanavigation.core.observability.HealthHeartbeat
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.Mockito.`when`
import org.mockito.MockitoAnnotations

class KnnWifiPositioningEngineTest {

    @Mock
    lateinit var fingerprintRepository: FingerprintRepository
    
    @Mock
    lateinit var smoother: PositionSmoother
    
    @Mock
    lateinit var diagnostics: DiagnosticsRecorder
    
    @Mock
    lateinit var healthHeartbeat: HealthHeartbeat

    private lateinit var engine: KnnWifiPositioningEngine

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        
        // Mock DB entries
        val fingerprints = listOf(
            FingerprintEntry("loc1", listOf(FingerprintAP("ap1", -50), FingerprintAP("ap2", -60))),
            FingerprintEntry("loc2", listOf(FingerprintAP("ap1", -80), FingerprintAP("ap2", -90)))
        )
        val nodes = mapOf(
            "loc1" to Node("loc1", "floor1", 10.0, 10.0, NodeType.JUNCTION),
            "loc2" to Node("loc2", "floor1", 20.0, 20.0, NodeType.JUNCTION)
        )

        `when`(fingerprintRepository.getFingerprintDb()).thenReturn(fingerprints)
        `when`(fingerprintRepository.getNodeRegistry()).thenReturn(nodes)
        
        // Mock smoother to return input
        `when`(smoother.smooth(any())).thenAnswer { it.arguments[0] as PositionEstimate }

        engine = KnnWifiPositioningEngine(fingerprintRepository, smoother, diagnostics, healthHeartbeat)
    }

    @Test
    fun `calculatePosition returns coordinates close to best signal match`() {
        // Live scan matches loc1 perfectly
        val readings = listOf(
            WifiScanReading("ap1", -50, 1000L),
            WifiScanReading("ap2", -60, 1000L)
        )
        val snapshot = WifiScanSnapshot(1000L, readings)
        val catalog = AccessPointCatalog("1", emptyMap(), 1000L)

        val result = engine.calculatePosition(snapshot, catalog)

        // Result should be very close to loc1 (10, 10)
        assertEquals(10.0, result.x, 1.0)
        assertEquals(10.0, result.y, 1.0)
        assertEquals("floor1", result.floorId)
    }

    // Helper for Mockito
    private fun <T> any(): T = org.mockito.ArgumentMatchers.any()
}
