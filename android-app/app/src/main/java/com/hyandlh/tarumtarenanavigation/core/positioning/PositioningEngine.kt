package com.hyandlh.tarumtarenanavigation.core.positioning

import com.hyandlh.tarumtarenanavigation.core.model.AccessPointCatalog
import com.hyandlh.tarumtarenanavigation.core.model.PositionEstimate
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow

/**
 * Interface for the core positioning logic.
 */
interface PositioningEngine {
    /**
     * Processes a new Wi-Fi scan snapshot and produces a position estimate.
     */
    suspend fun calculatePosition(
        snapshot: WifiScanSnapshot,
        catalog: AccessPointCatalog,
        checkedNodeIds: Set<String>
    ): PositionEstimate

    /**
     * A flow of position estimates. Emits null if no position is currently estimated.
     */
    val currentPosition: Flow<PositionEstimate?>

    /**
     * A flow of calculated distances to each node based on the latest scan.
     * Engines that cannot provide node-level distances may return null.
     */
    val nodeDistances: StateFlow<Map<String, Double>>?
}
