package com.hyandlh.tarumtarenanavigation.core.positioning.remote

import com.hyandlh.tarumtarenanavigation.core.model.FingerprintEntry
import com.hyandlh.tarumtarenanavigation.core.model.Node
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Url

interface PositioningApiService {
    @POST
    suspend fun calculatePosition(
        @Url url: String,
        @Body snapshot: WifiScanSnapshot
    ): PositioningResponse

    @GET
    suspend fun getAllFingerprints(
        @Url url: String
    ): List<FingerprintEntry>

    @GET
    suspend fun getNodeRegistry(
        @Url url: String
    ): Map<String, Node>
}
