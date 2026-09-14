package com.hyandlh.tarumtarenanavigation.core.apdata.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "ap_locations")
data class ApLocationEntity(
    @PrimaryKey val bssid: String,
    val x: Double,
    val y: Double,
    val floorId: String,
    val confidence: Double,
    val metadata: String // Store as JSON string for simplicity or use TypeConverters
)
