package com.hyandlh.tarumtarenanavigation.core.apdata.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(entities = [ApLocationEntity::class], version = 1, exportSchema = false)
abstract class ApDatabase : RoomDatabase() {
    abstract fun apDao(): ApDao
}
