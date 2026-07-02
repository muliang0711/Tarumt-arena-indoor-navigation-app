package com.hyandlh.tarumtarenanavigation.core.positioning

import com.hyandlh.tarumtarenanavigation.core.model.FingerprintAP
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanReading
import kotlin.math.pow
import kotlin.math.sqrt

object DistanceUtils {
    const val PENALTY_RSSI = -100.0

    /**
     * Calculates the Euclidean distance between two sets of RSSI values.
     */
    fun calculateEuclideanDistance(
        liveScan: Map<String, Int>,
        fingerprint: Map<String, Int>
    ): Double {
        val allBssids = (liveScan.keys + fingerprint.keys).distinct()
        var sumSquaredDiff = 0.0

        for (bssid in allBssids) {
            val rssi1 = liveScan[bssid]?.toDouble() ?: PENALTY_RSSI
            val rssi2 = fingerprint[bssid]?.toDouble() ?: PENALTY_RSSI
            sumSquaredDiff += (rssi1 - rssi2).pow(2)
        }
        return sqrt(sumSquaredDiff)
    }

    /**
     * Overload for convenience with model types.
     */
    fun calculateEuclideanDistance(
        liveReadings: List<WifiScanReading>,
        fingerprintAps: List<FingerprintAP>
    ): Double {
        val liveMap = liveReadings.associate { it.bssid to it.rssi }
        val fingerMap = fingerprintAps.associate { it.bssid to it.rssi }
        return calculateEuclideanDistance(liveMap, fingerMap)
    }
}
