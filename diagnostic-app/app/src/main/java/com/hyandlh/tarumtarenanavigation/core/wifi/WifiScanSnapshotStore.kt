package com.hyandlh.tarumtarenanavigation.core.wifi

import android.content.Context
import com.google.gson.Gson
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WifiScanSnapshotStore @Inject constructor(
    @ApplicationContext private val context: Context,
    private val gson: Gson
) {
    fun save(snapshot: WifiScanSnapshot): File {
        val directory = File(context.filesDir, "wifi-scans")
        if (!directory.exists()) {
            directory.mkdirs()
        }

        val file = File(directory, "wifi-scan-${snapshot.timestamp}.json")
        file.writeText(gson.toJson(snapshot))
        return file
    }
}
