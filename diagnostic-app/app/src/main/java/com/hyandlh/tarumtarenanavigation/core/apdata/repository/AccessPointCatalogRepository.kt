package com.hyandlh.tarumtarenanavigation.core.apdata.repository

import com.google.gson.Gson
import com.hyandlh.tarumtarenanavigation.core.apdata.local.ApDao
import com.hyandlh.tarumtarenanavigation.core.apdata.remote.ApApiService
import com.hyandlh.tarumtarenanavigation.core.common.AppError
import com.hyandlh.tarumtarenanavigation.core.common.AppResult
import com.hyandlh.tarumtarenanavigation.core.model.AccessPointCatalog
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AccessPointCatalogRepository @Inject constructor(
    private val apDao: ApDao,
    private val apApiService: ApApiService,
    private val gson: Gson
) : PositioningDataRepository {
    /**
     * Observe the cached catalog.
     */
    override fun getCatalogFlow(): Flow<AccessPointCatalog?> {
        return apDao.getAllLocations().map { entities ->
            if (entities.isEmpty()) return@map null
            
            AccessPointCatalog(
                version = "local",
                locations = entities.associate { it.bssid to it.toDomain(gson) },
                lastUpdated = System.currentTimeMillis()
            )
        }
    }

    /**
     * Refresh the catalog from the remote source.
     */
    override suspend fun refreshCatalog(): AppResult<Unit> {
        return try {
            val response = apApiService.getLatestCatalog()
            val entities = response.items.map { it.toEntity(gson) }
            apDao.clearAll()
            apDao.insertAll(entities)
            AppResult.Success(Unit)
        } catch (e: Exception) {
            AppResult.Failure(AppError("Failed to refresh catalog", throwable = e))
        }
    }
}
