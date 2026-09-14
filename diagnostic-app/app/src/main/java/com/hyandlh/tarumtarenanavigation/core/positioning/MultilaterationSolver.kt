package com.hyandlh.tarumtarenanavigation.core.positioning

import com.hyandlh.tarumtarenanavigation.core.model.PositionEstimate
import javax.inject.Inject
import kotlin.math.pow

/**
 * Solves for a 2D position using matched Wi-Fi readings and their known locations.
 */
class MultilaterationSolver @Inject constructor() {

    /**
     * Calculates an estimated position using a Weighted Centroid approach.
     * Weights are based on linear power derived from RSSI.
     */
    fun solve(matches: List<APMatcher.MatchedReading>, timestamp: Long): PositionEstimate {
        if (matches.isEmpty()) {
            return PositionEstimate(
                x = 0.0,
                y = 0.0,
                floorId = "unknown",
                confidence = 0.0,
                timestamp = timestamp
            )
        }

        var totalWeight = 0.0
        var weightedX = 0.0
        var weightedY = 0.0

        // Determine floorId by majority or best signal. For now, take the first one
        // as the prototype is single-floor.
        val floorId = matches.first().location.floorId

        for (match in matches) {
            // Convert RSSI to a linear weight. 
            // -30 dBm is very strong, -90 dBm is very weak.
            // Using a simple exponential weight: 10^(RSSI/10)
            val weight = 10.0.pow(match.rssi.toDouble() / 10.0)
            
            weightedX += match.location.x * weight
            weightedY += match.location.y * weight
            totalWeight += weight
        }

        return if (totalWeight > 0) {
            PositionEstimate(
                x = weightedX / totalWeight,
                y = weightedY / totalWeight,
                floorId = floorId,
                confidence = calculateConfidence(matches),
                timestamp = timestamp
            )
        } else {
            PositionEstimate(0.0, 0.0, floorId, 0.0, timestamp)
        }
    }

    private fun calculateConfidence(matches: List<APMatcher.MatchedReading>): Double {
        // Simple heuristic: more matches = higher confidence, up to a point.
        // Also could consider the signal strength of the strongest AP.
        val countWeight = (matches.size / 5.0).coerceAtMost(1.0)
        val bestRssi = matches.maxOfOrNull { it.rssi } ?: -100
        val signalWeight = ((bestRssi + 100) / 70.0).coerceIn(0.0, 1.0)
        
        return (countWeight * 0.4 + signalWeight * 0.6)
    }
}
