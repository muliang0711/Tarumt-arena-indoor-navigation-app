package com.hyandlh.tarumtarenanavigation.core.positioning.remote

import com.hyandlh.tarumtarenanavigation.core.model.WifiScanReading
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot

data class PositioningRequest(
    val timestamp: Long,
    val readings: List<WifiScanReading>,
    val metadata: Map<String, String> = emptyMap(),
    val checkedNodeIds: List<String> = emptyList()
) {
    companion object {
        fun fromSnapshot(
            snapshot: WifiScanSnapshot,
            checkedNodeIds: Set<String>
        ): PositioningRequest {
            return PositioningRequest(
                timestamp = snapshot.timestamp,
                readings = snapshot.readings,
                metadata = snapshot.metadata,
                checkedNodeIds = checkedNodeIds.sorted()
            )
        }
    }
}
