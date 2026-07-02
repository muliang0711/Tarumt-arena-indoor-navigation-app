package com.hyandlh.tarumtarenanavigation.core.positioning.remote

import com.hyandlh.tarumtarenanavigation.core.model.PositionEstimate

data class PositioningResponse(
    val estimate: PositionEstimate,
    val nodeDistances: Map<String, Double>
)
