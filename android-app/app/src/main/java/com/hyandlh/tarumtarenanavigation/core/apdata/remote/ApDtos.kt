package com.hyandlh.tarumtarenanavigation.core.apdata.remote

import com.google.gson.annotations.SerializedName

data class ApCatalogResponse(
    @SerializedName("version") val version: String,
    @SerializedName("lastUpdated") val lastUpdated: Long,
    @SerializedName("items") val items: List<ApLocationDto>
)

data class ApLocationDto(
    @SerializedName("bssid") val bssid: String,
    @SerializedName("x") val x: Double,
    @SerializedName("y") val y: Double,
    @SerializedName("floorId") val floorId: String,
    @SerializedName("confidence") val confidence: Double? = 1.0,
    @SerializedName("metadata") val metadata: Map<String, String>? = emptyMap()
)
