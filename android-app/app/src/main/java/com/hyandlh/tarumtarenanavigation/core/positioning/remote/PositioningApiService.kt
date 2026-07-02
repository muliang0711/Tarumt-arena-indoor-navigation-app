package com.hyandlh.tarumtarenanavigation.core.positioning.remote

import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Url

interface PositioningApiService {
    @POST
    suspend fun calculatePosition(
        @Url url: String,
        @Body snapshot: WifiScanSnapshot
    ): PositioningResponse
}
