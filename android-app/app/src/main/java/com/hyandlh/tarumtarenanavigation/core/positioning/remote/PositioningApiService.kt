package com.hyandlh.tarumtarenanavigation.core.positioning.remote

import com.hyandlh.tarumtarenanavigation.core.model.Node
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Url

interface PositioningApiService {
    @POST
    suspend fun calculatePosition(
        @Url url: String,
        @Body request: PositioningRequest
    ): PositioningResponse

    @POST
    suspend fun findClosestNode(
        @Url url: String,
        @Body request: PositioningRequest
    ): PositioningClosestNodeResponse

    @GET
    suspend fun getNodeRegistry(
        @Url url: String
    ): Map<String, Node>

    @GET
    suspend fun heartbeat(
        @Url url: String
    ): HeartbeatResponse
}
