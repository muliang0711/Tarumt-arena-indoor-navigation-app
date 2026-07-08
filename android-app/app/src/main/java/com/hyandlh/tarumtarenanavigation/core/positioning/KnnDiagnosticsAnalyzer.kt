package com.hyandlh.tarumtarenanavigation.core.positioning

import com.hyandlh.tarumtarenanavigation.core.model.AccessPointCatalog
import com.hyandlh.tarumtarenanavigation.core.model.FingerprintEntry
import com.hyandlh.tarumtarenanavigation.core.model.KnnDiagnosticReport
import com.hyandlh.tarumtarenanavigation.core.model.KnnNeighborDiagnostic
import com.hyandlh.tarumtarenanavigation.core.model.KnnNodeDiagnostic
import com.hyandlh.tarumtarenanavigation.core.model.Node
import com.hyandlh.tarumtarenanavigation.core.model.PositionEstimate
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class KnnDiagnosticsAnalyzer @Inject constructor() {
    private val k = 3

    fun analyze(snapshot: WifiScanSnapshot, catalog: AccessPointCatalog): KnnDiagnosticReport {
        val usedReadings = snapshot.readings.filter { it.rssi >= MIN_RSSI }
        val liveMap = usedReadings.associate { it.bssid to it.rssi }
        val fingerprintDistances = catalog.fingerprints.map { fingerprint ->
            fingerprint.toDistance(liveMap)
        }
        val nearest = fingerprintDistances.sortedBy { it.distance }.take(k)
        val weightedResult = calculateWeightedEstimate(nearest, catalog.nodes, snapshot.timestamp)
        val neighbors = nearest.mapIndexed { index, distance ->
            val node = catalog.nodes[distance.locationId]
            val weight = if (node != null) weightFor(distance.distance) else 0.0
            KnnNeighborDiagnostic(
                rank = index + 1,
                locationId = distance.locationId,
                scanId = distance.scanId,
                distance = distance.distance,
                weight = weight,
                normalizedWeight = if (weightedResult.totalWeight > 0.0) weight / weightedResult.totalWeight else 0.0,
                nodeId = node?.nodeId,
                nodeName = node?.name,
                nodeX = node?.x,
                nodeY = node?.y,
                floorId = node?.floorId,
                matchedBssidCount = distance.matchedBssidCount,
                missingFromScanCount = distance.missingFromScanCount,
                extraFromScanCount = distance.extraFromScanCount
            )
        }

        val contributionByNode = neighbors
            .groupBy { it.locationId }
            .mapValues { (_, values) -> values.sumOf { it.normalizedWeight } }
        val selectedCountByNode = neighbors
            .groupBy { it.locationId }
            .mapValues { (_, values) -> values.size }

        val nodeSummaries = fingerprintDistances
            .groupBy { it.locationId }
            .mapNotNull { (nodeId, distances) ->
                val best = distances.minByOrNull { it.distance } ?: return@mapNotNull null
                val node = catalog.nodes[nodeId]
                KnnNodeDiagnostic(
                    rank = 0,
                    nodeId = nodeId,
                    nodeName = node?.name,
                    x = node?.x,
                    y = node?.y,
                    floorId = node?.floorId,
                    bestDistance = best.distance,
                    fingerprintCount = distances.size,
                    bestScanId = best.scanId,
                    matchedBssidCount = best.matchedBssidCount,
                    missingFromScanCount = best.missingFromScanCount,
                    extraFromScanCount = best.extraFromScanCount,
                    selectedNeighborCount = selectedCountByNode[nodeId] ?: 0,
                    contributionWeight = neighbors
                        .filter { it.locationId == nodeId }
                        .sumOf { it.weight },
                    contributionPercent = contributionByNode[nodeId] ?: 0.0
                )
            }
            .sortedBy { it.bestDistance }
            .mapIndexed { index, item -> item.copy(rank = index + 1) }

        return KnnDiagnosticReport(
            generatedAt = System.currentTimeMillis(),
            snapshotTimestamp = snapshot.timestamp,
            k = k,
            penaltyRssi = DistanceUtils.PENALTY_RSSI,
            totalReadings = snapshot.readings.size,
            usedReadings = usedReadings.size,
            ignoredReadings = snapshot.readings.size - usedReadings.size,
            uniqueLiveBssidCount = liveMap.size,
            fingerprintCount = catalog.fingerprints.size,
            nodeCount = catalog.nodes.size,
            localEstimate = weightedResult.estimate,
            floorWeights = weightedResult.floorWeights,
            nearestNeighbors = neighbors,
            nodeSummaries = nodeSummaries
        )
    }

    private fun FingerprintEntry.toDistance(liveMap: Map<String, Int>): FingerprintDistance {
        val fingerprintMap = apList.associate { it.bssid to it.rssi }
        val liveBssids = liveMap.keys
        val fingerprintBssids = fingerprintMap.keys

        return FingerprintDistance(
            locationId = locationId,
            scanId = scanId,
            distance = DistanceUtils.calculateEuclideanDistance(liveMap, fingerprintMap),
            matchedBssidCount = liveBssids.intersect(fingerprintBssids).size,
            missingFromScanCount = fingerprintBssids.subtract(liveBssids).size,
            extraFromScanCount = liveBssids.subtract(fingerprintBssids).size
        )
    }

    private fun calculateWeightedEstimate(
        nearest: List<FingerprintDistance>,
        nodes: Map<String, Node>,
        timestamp: Long
    ): WeightedKnnResult {
        var totalWeight = 0.0
        var sumX = 0.0
        var sumY = 0.0
        val floorWeights = mutableMapOf<String, Double>()

        nearest.forEach { neighbor ->
            val node = nodes[neighbor.locationId] ?: return@forEach
            val weight = weightFor(neighbor.distance)
            totalWeight += weight
            sumX += node.x * weight
            sumY += node.y * weight
            floorWeights[node.floorId] = floorWeights.getOrDefault(node.floorId, 0.0) + weight
        }

        if (totalWeight == 0.0) {
            return WeightedKnnResult(
                estimate = PositionEstimate(0.0, 0.0, "unknown", 0.0, timestamp),
                totalWeight = 0.0,
                floorWeights = floorWeights
            )
        }

        val bestDistance = nearest.firstOrNull()?.distance ?: Double.POSITIVE_INFINITY
        val confidence = (1.0 / (bestDistance / 10.0 + 1.0)).coerceIn(0.0, 1.0)
        val bestFloor = floorWeights.maxByOrNull { it.value }?.key ?: "unknown"

        return WeightedKnnResult(
            estimate = PositionEstimate(
                x = sumX / totalWeight,
                y = sumY / totalWeight,
                floorId = bestFloor,
                confidence = confidence,
                timestamp = timestamp,
                diagnostics = mapOf(
                    "algorithm" to "WKNN-DiagnosticReplay",
                    "k" to nearest.size.toString(),
                    "nearest_dist" to String.format(Locale.US, "%.2f", bestDistance)
                )
            ),
            totalWeight = totalWeight,
            floorWeights = floorWeights
        )
    }

    private fun weightFor(distance: Double): Double = 1.0 / (distance + 0.1)

    private data class FingerprintDistance(
        val locationId: String,
        val scanId: Int,
        val distance: Double,
        val matchedBssidCount: Int,
        val missingFromScanCount: Int,
        val extraFromScanCount: Int
    )

    private data class WeightedKnnResult(
        val estimate: PositionEstimate,
        val totalWeight: Double,
        val floorWeights: Map<String, Double>
    )

    private companion object {
        const val MIN_RSSI = -90
    }
}
