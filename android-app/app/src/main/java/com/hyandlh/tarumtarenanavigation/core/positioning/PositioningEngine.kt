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
     * A flow of position estimates. Emits null if no position is currently estimated.
     */
    val currentPosition: Flow<PositionEstimate?>
}
