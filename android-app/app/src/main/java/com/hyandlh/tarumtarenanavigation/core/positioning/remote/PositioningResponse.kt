package com.hyandlh.tarumtarenanavigation.core.positioning.remote

import com.hyandlh.tarumtarenanavigation.core.model.PositionEstimate

data class PositioningResponse(
    val estimate: PositionEstimate,
    val nodeDistances: Map<String, Double>,
    val candidates: List<PositionCandidate> = emptyList()
)

data class PositionCandidate(
    val nodeId: String,
    val distance: Double,
    val weight: Double,
    val normalizedWeight: Double,
    val bestFingerprintDistance: Double,
    val matchedBssidCount: Int,
    val unionBssidCount: Int,
    val overlapRatio: Double,
    val fingerprintCount: Int
)
