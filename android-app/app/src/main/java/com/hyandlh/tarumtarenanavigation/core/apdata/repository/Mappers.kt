package com.hyandlh.tarumtarenanavigation.core.apdata.repository

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.hyandlh.tarumtarenanavigation.core.apdata.local.ApLocationEntity
import com.hyandlh.tarumtarenanavigation.core.apdata.remote.ApLocationDto
import com.hyandlh.tarumtarenanavigation.core.model.AccessPointLocation

fun ApLocationDto.toDomain(): AccessPointLocation {
    return AccessPointLocation(
        bssid = bssid,
        x = x,
        y = y,
        floorId = floorId,
        confidence = confidence ?: 1.0,
        metadata = metadata ?: emptyMap()
    )
}

fun ApLocationDto.toEntity(gson: Gson): ApLocationEntity {
    return ApLocationEntity(
        bssid = bssid,
        x = x,
        y = y,
        floorId = floorId,
        confidence = confidence ?: 1.0,
        metadata = gson.toJson(metadata ?: emptyMap<String, String>())
    )
}

fun ApLocationEntity.toDomain(gson: Gson): AccessPointLocation {
    val type = object : TypeToken<Map<String, String>>() {}.type
    val meta: Map<String, String> = gson.fromJson(metadata, type)
    return AccessPointLocation(
        bssid = bssid,
        x = x,
        y = y,
        floorId = floorId,
        confidence = confidence,
        metadata = meta
    )
}
