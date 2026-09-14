package com.hyandlh.tarumtarenanavigation.core.apdata.remote

data class ApCatalogResponse(
    val version: String,
    val items: List<ApDto>
)

data class ApDto(
    val bssid: String,
    val x: Double,
    val y: Double,
    val floorId: String,
    val metadata: String? = null
)
