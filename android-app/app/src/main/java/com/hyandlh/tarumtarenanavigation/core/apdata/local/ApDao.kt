package com.hyandlh.tarumtarenanavigation.core.apdata.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface ApDao {
    @Query("SELECT * FROM ap_locations")
    fun getAllLocations(): Flow<List<ApLocationEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(locations: List<ApLocationEntity>)

    @Query("DELETE FROM ap_locations")
    suspend fun clearAll()
}
