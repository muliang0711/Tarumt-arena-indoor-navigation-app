package com.hyandlh.tarumtarenanavigation.core.positioning

import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanReading
import javax.inject.Inject

/**
 * Filters and prepares raw Wi-Fi readings for the positioning engine.
 */
class SignalPreprocessor @Inject constructor() {

    companion object {
        private const val MIN_RSSI = -90 // Standard threshold to ignore very weak signals
    }

    /**
     * Filters out weak or irrelevant signals from the snapshot.
     */
    fun preprocess(snapshot: WifiScanSnapshot): WifiScanSnapshot {
        val filteredReadings = snapshot.readings.filter { reading ->
            isValid(reading)
        }
        return snapshot.copy(readings = filteredReadings)
    }

    private fun isValid(reading: WifiScanReading): Boolean {
        // Filter out readings with RSSI below the threshold
        return reading.rssi >= MIN_RSSI
    }
}
