package com.hyandlh.tarumtarenanavigation.core.apdata.remote

import javax.inject.Inject

class MockApApiService @Inject constructor() : ApApiService {
    override suspend fun getLatestCatalog(): ApCatalogResponse {
        return ApCatalogResponse(
            version = "mock-1.0",
            items = listOf(
                ApDto(bssid = "00:11:22:33:44:01", x = 10.0, y = 10.0, floorId = "floor-2", metadata = "{\"name\": \"AP-North\"}"),
                ApDto(bssid = "00:11:22:33:44:02", x = 50.0, y = 20.0, floorId = "floor-2", metadata = "{\"name\": \"AP-East\"}"),
                ApDto(bssid = "00:11:22:33:44:03", x = 30.0, y = 45.0, floorId = "floor-2", metadata = "{\"name\": \"AP-Center\"}"),
                ApDto(bssid = "00:11:22:33:44:04", x = 150.0, y = 10.0, floorId = "floor-2", metadata = "{\"name\": \"AP-Far-Right\"}"),
                ApDto(bssid = "00:11:22:33:44:05", x = 80.0, y = -5.0, floorId = "floor-2", metadata = "{\"name\": \"AP-South\"}")
            )
        )
    }
}
