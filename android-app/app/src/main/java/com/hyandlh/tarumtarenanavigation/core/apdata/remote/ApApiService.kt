package com.hyandlh.tarumtarenanavigation.core.apdata.remote

import retrofit2.http.GET

interface ApApiService {
    @GET("catalog/latest") // Example endpoint
    suspend fun getLatestCatalog(): ApCatalogResponse
}
