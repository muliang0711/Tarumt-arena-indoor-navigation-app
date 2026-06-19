package com.hyandlh.tarumtarenanavigation.core.apdata.repository

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.hyandlh.tarumtarenanavigation.core.apdata.local.ApLocationEntity
import com.hyandlh.tarumtarenanavigation.core.apdata.remote.ApDto
import com.hyandlh.tarumtarenanavigation.core.model.AccessPointLocation

fun ApDto.toDomain(): AccessPointLocation {
    return AccessPointLocation(
        bssid = bssid,
        x = x,
        y = y,
        floorId = floorId,
        confidence = 1.0,
        metadata = emptyMap() // Simplification for now
    )
}

fun ApDto.toEntity(gson: Gson): ApLocationEntity {
    return ApLocationEntity(
        bssid = bssid,
        x = x,
        y = y,
        floorId = floorId,
        confidence = 1.0,
        metadata = metadata ?: "{}"
    )
}

fun ApLocationEntity.toDomain(gson: Gson): AccessPointLocation {
    val type = object : TypeToken<Map<String, String>>() {}.type
    val meta: Map<String, String> = try {
        gson.fromJson(metadata, type)
    } catch (e: Exception) {
        emptyMap()
    }
    return AccessPointLocation(
        bssid = bssid,
        x = x,
        y = y,
        floorId = floorId,
        confidence = confidence,
        metadata = meta
    )
}
