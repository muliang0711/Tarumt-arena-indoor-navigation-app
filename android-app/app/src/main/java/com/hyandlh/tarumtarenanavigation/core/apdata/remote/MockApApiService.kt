package com.hyandlh.tarumtarenanavigation.core.apdata.remote

import javax.inject.Inject

class MockApApiService @Inject constructor() : ApApiService {
    override suspend fun getLatestCatalog(): ApCatalogResponse {
        return ApCatalogResponse(
            version = "mock-1.0",
            items = listOf(
                ApDto(bssid = "10:3f:8c:d6:19:e0", x = 51.330, y = 37.199, floorId = "floor-2"),
                ApDto(bssid = "10:3f:8c:d6:15:e0", x = 30.723, y = 56.811, floorId = "floor-2"),
                ApDto(bssid = "10:3f:8c:d6:00:60", x = 34.938, y = 52.644, floorId = "floor-2"),
                ApDto(bssid = "10:3f:8c:d6:18:80", x = 50.401, y = 66.047, floorId = "floor-2"),
                ApDto(bssid = "10:3f:8c:d6:11:a0", x = 11.192, y = 60.726, floorId = "floor-2"),
            )
        )z1
    }
}
