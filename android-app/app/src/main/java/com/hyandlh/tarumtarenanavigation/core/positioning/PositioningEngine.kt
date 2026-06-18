package com.hyandlh.tarumtarenanavigation.core.positioning

import com.hyandlh.tarumtarenanavigation.core.model.AccessPointCatalog
import com.hyandlh.tarumtarenanavigation.core.model.PositionEstimate
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import kotlinx.coroutines.flow.Flow

/**
 * Interface for the core positioning logic.
 */
interface PositioningEngine {
    /**
     * Processes a new Wi-Fi scan snapshot and produces a position estimate.
     */
    fun calculatePosition(
        snapshot: WifiScanSnapshot,
        catalog: AccessPointCatalog
    ): PositionEstimate

    /**
     * A flow of position estimates (if the engine handles streaming/smoothing internally).
     */
    val currentPosition: Flow<PositionEstimate>
}
