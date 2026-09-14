package com.hyandlh.tarumtarenanavigation.core.apdata.repository

import com.hyandlh.tarumtarenanavigation.core.common.AppResult
import com.hyandlh.tarumtarenanavigation.core.model.AccessPointCatalog
import kotlinx.coroutines.flow.Flow

/**
 * Common interface for repositories providing data for positioning (AP locations or Fingerprints).
 */
interface PositioningDataRepository {
    /**
     * Observe the available data catalog.
     */
    fun getCatalogFlow(): Flow<AccessPointCatalog?>

    /**
     * Refresh the data from its source.
     */
    suspend fun refreshCatalog(): AppResult<Unit>
}
