package com.hyandlh.tarumtarenanavigation.core.positioning

import com.hyandlh.tarumtarenanavigation.core.model.FingerprintEntry
import com.hyandlh.tarumtarenanavigation.core.model.Node
import com.hyandlh.tarumtarenanavigation.core.model.PositionEstimate
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanReading
import java.util.Locale
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.pow
import kotlin.math.sqrt

object LocationKnnAlgorithm {
    const val MIN_RSSI = -90
    const val LOCATION_K = 3
    const val FINGERPRINTS_PER_LOCATION = 3
    const val MIN_MATCHED_BSSIDS = 3
    const val DISTANCE_TEMPERATURE = 5.0

    fun calculate(
        readings: List<WifiScanReading>,
        fingerprints: List<FingerprintEntry>,
        nodes: Map<String, Node>,
        timestamp: Long,
        algorithmName: String
    ): LocationKnnResult {
        val liveMap = strongestByBssid(readings.filter { it.rssi >= MIN_RSSI }.map { it.bssid to it.rssi })
        if (liveMap.isEmpty()) {
            return unknown(timestamp, algorithmName, "no_usable_live_readings")
        }

        val matches = fingerprints.mapNotNull { fingerprint ->
            val fingerprintMap = strongestByBssid(
                fingerprint.apList.filter { it.rssi >= MIN_RSSI }.map { it.bssid to it.rssi }
            )
            val components = normalizedDistance(liveMap, fingerprintMap)
            if (components.matchedBssidCount < MIN_MATCHED_BSSIDS) null else {
                FingerprintMatch(fingerprint, components)
            }
        }.sortedBy { it.components.distance }

        val allCandidates = matches.groupBy { it.fingerprint.locationId }.map { (nodeId, nodeMatches) ->
            val best = nodeMatches.sortedBy { it.components.distance }.take(FINGERPRINTS_PER_LOCATION)
            LocationCandidate(
                nodeId = nodeId,
                distance = best.map { it.components.distance }.average(),
                bestFingerprint = best.first(),
                fingerprintCount = nodeMatches.size
            )
        }.sortedBy { it.distance }

        val selected = allCandidates.take(LOCATION_K).filter { it.nodeId in nodes }
        if (selected.isEmpty()) {
            return unknown(timestamp, algorithmName, "insufficient_bssid_overlap", matches, allCandidates)
        }

        val bestDistance = selected.first().distance
        val weighted = selected.map { candidate ->
            WeightedLocationCandidate(
                candidate = candidate,
                weight = exp(-(candidate.distance - bestDistance) / DISTANCE_TEMPERATURE)
            )
        }
        val totalWeight = weighted.sumOf { it.weight }
        val floorWeights = weighted.groupBy { nodes.getValue(it.candidate.nodeId).floorId }
            .mapValues { (_, candidates) -> candidates.sumOf { it.weight } }
        val secondDistance = selected.getOrNull(1)?.distance ?: bestDistance * 1.5
        val separation = max(0.0, (secondDistance - bestDistance) / max(secondDistance, 0.1))
        val bestOverlap = selected.first().bestFingerprint.components.overlapRatio
        val distanceQuality = exp(-bestDistance / 25.0)
        val confidence = (
            0.4 * distanceQuality +
                0.35 * (separation / 0.25).coerceIn(0.0, 1.0) +
                0.25 * bestOverlap
            ).coerceIn(0.0, 1.0)

        val estimate = PositionEstimate(
            x = weighted.sumOf { nodes.getValue(it.candidate.nodeId).x * it.weight } / totalWeight,
            y = weighted.sumOf { nodes.getValue(it.candidate.nodeId).y * it.weight } / totalWeight,
            floorId = floorWeights.maxByOrNull { it.value }?.key ?: "unknown",
            confidence = confidence,
            timestamp = timestamp,
            diagnostics = mapOf(
                "algorithm" to algorithmName,
                "distance_metric" to "overlap_adjusted_union_rmse",
                "aggregation" to "mean_best_${FINGERPRINTS_PER_LOCATION}_per_location",
                "location_k" to selected.size.toString(),
                "nearest_dist" to String.format(Locale.US, "%.2f", bestDistance),
                "candidate_margin" to String.format(Locale.US, "%.4f", separation),
                "best_overlap" to String.format(Locale.US, "%.4f", bestOverlap),
                "confidence_kind" to "evidence_score_not_probability"
            )
        )

        return LocationKnnResult(
            estimate = estimate,
            fingerprintMatches = matches,
            allLocationCandidates = allCandidates,
            selectedCandidates = weighted,
            floorWeights = floorWeights,
            totalWeight = totalWeight
        )
    }

    fun strongestByBssid(readings: Iterable<Pair<String, Int>>): Map<String, Int> = buildMap {
        readings.forEach { (bssid, rssi) -> put(bssid, max(get(bssid) ?: Int.MIN_VALUE, rssi)) }
    }

    fun normalizedDistance(live: Map<String, Int>, fingerprint: Map<String, Int>): DistanceComponents {
        val union = live.keys union fingerprint.keys
        val matched = live.keys intersect fingerprint.keys
        if (union.isEmpty()) return DistanceComponents(Double.POSITIVE_INFINITY, 0, 0, 0.0, Double.POSITIVE_INFINITY)
        val sumSquared = union.sumOf { bssid ->
            ((live[bssid]?.toDouble() ?: DistanceUtils.PENALTY_RSSI) -
                (fingerprint[bssid]?.toDouble() ?: DistanceUtils.PENALTY_RSSI)).pow(2)
        }
        val unionRmse = sqrt(sumSquared / union.size)
        val overlap = matched.size.toDouble() / union.size
        return DistanceComponents(
            distance = unionRmse / sqrt(max(overlap, 0.01)),
            matchedBssidCount = matched.size,
            unionBssidCount = union.size,
            overlapRatio = overlap,
            unionRmse = unionRmse
        )
    }

    private fun unknown(
        timestamp: Long,
        algorithmName: String,
        reason: String,
        matches: List<FingerprintMatch> = emptyList(),
        candidates: List<LocationCandidate> = emptyList()
    ) = LocationKnnResult(
        estimate = PositionEstimate(
            0.0, 0.0, "unknown", 0.0, timestamp,
            mapOf("algorithm" to algorithmName, "reason" to reason)
        ),
        fingerprintMatches = matches,
        allLocationCandidates = candidates,
        selectedCandidates = emptyList(),
        floorWeights = emptyMap(),
        totalWeight = 0.0
    )
}

data class DistanceComponents(
    val distance: Double,
    val matchedBssidCount: Int,
    val unionBssidCount: Int,
    val overlapRatio: Double,
    val unionRmse: Double
)

data class FingerprintMatch(val fingerprint: FingerprintEntry, val components: DistanceComponents)

data class LocationCandidate(
    val nodeId: String,
    val distance: Double,
    val bestFingerprint: FingerprintMatch,
    val fingerprintCount: Int
)

data class WeightedLocationCandidate(val candidate: LocationCandidate, val weight: Double)

data class LocationKnnResult(
    val estimate: PositionEstimate,
    val fingerprintMatches: List<FingerprintMatch>,
    val allLocationCandidates: List<LocationCandidate>,
    val selectedCandidates: List<WeightedLocationCandidate>,
    val floorWeights: Map<String, Double>,
    val totalWeight: Double
)
