package com.hyandlh.tarumtarenanavigation.core.positioning

import com.hyandlh.tarumtarenanavigation.core.model.AccessPointCatalog
import com.hyandlh.tarumtarenanavigation.core.model.AccessPointLocation
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import javax.inject.Inject

/**
 * Matches Wi-Fi readings to known Access Point locations from the catalog.
 */
class APMatcher @Inject constructor() {

    /**
     * Pair of a reading and its corresponding known location.
     */
    data class MatchedReading(
        val bssid: String,
        val rssi: Int,
        val location: AccessPointLocation
    )

    /**
     * Finds matches between the snapshot and the catalog.
     */
    fun match(snapshot: WifiScanSnapshot, catalog: AccessPointCatalog): List<MatchedReading> {
        return snapshot.readings.mapNotNull { reading ->
            val location = catalog.locations[reading.bssid]
            if (location != null) {
                MatchedReading(
                    bssid = reading.bssid,
                    rssi = reading.rssi,
                    location = location
                )
            } else {
                null
            }
        }
    }
}
