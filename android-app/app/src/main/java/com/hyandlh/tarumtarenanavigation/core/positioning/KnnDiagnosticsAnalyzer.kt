package com.hyandlh.tarumtarenanavigation.core.positioning

import com.hyandlh.tarumtarenanavigation.core.model.AccessPointCatalog
import com.hyandlh.tarumtarenanavigation.core.model.KnnDiagnosticReport
import com.hyandlh.tarumtarenanavigation.core.model.KnnFingerprintDistanceDiagnostic
import com.hyandlh.tarumtarenanavigation.core.model.KnnNeighborDiagnostic
import com.hyandlh.tarumtarenanavigation.core.model.KnnNodeDiagnostic
import com.hyandlh.tarumtarenanavigation.core.model.WifiScanSnapshot
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class KnnDiagnosticsAnalyzer @Inject constructor() {
    fun analyze(snapshot: WifiScanSnapshot, catalog: AccessPointCatalog): KnnDiagnosticReport {
        val usedReadings = snapshot.readings.filter { it.rssi >= LocationKnnAlgorithm.MIN_RSSI }
        val liveMap = LocationKnnAlgorithm.strongestByBssid(usedReadings.map { it.bssid to it.rssi })
        val result = LocationKnnAlgorithm.calculate(
            readings = snapshot.readings,
            fingerprints = catalog.fingerprints,
            nodes = catalog.nodes,
            timestamp = snapshot.timestamp,
            algorithmName = "Location-WKNN-DiagnosticReplay"
        )
        val selectedKeys = result.selectedCandidates.map {
            it.candidate.bestFingerprint.fingerprint.locationId to it.candidate.bestFingerprint.fingerprint.scanId
        }.toSet()

        val allFingerprintDistances = result.fingerprintMatches.mapIndexed { index, match ->
            val fingerprint = match.fingerprint
            val node = catalog.nodes[fingerprint.locationId]
            KnnFingerprintDistanceDiagnostic(
                rank = index + 1,
                locationId = fingerprint.locationId,
                scanId = fingerprint.scanId,
                distance = match.components.distance,
                unionRmse = match.components.unionRmse,
                overlapRatio = match.components.overlapRatio,
                unionBssidCount = match.components.unionBssidCount,
                nodeId = node?.nodeId,
                nodeName = node?.name,
                nodeX = node?.x,
                nodeY = node?.y,
                floorId = node?.floorId,
                matchedBssidCount = match.components.matchedBssidCount,
                missingFromScanCount = fingerprint.apList.map { it.bssid }.toSet().subtract(liveMap.keys).size,
                extraFromScanCount = liveMap.keys.subtract(fingerprint.apList.map { it.bssid }.toSet()).size,
                fingerprintBssidCount = fingerprint.apList.map { it.bssid }.toSet().size,
                isSelectedNeighbor = (fingerprint.locationId to fingerprint.scanId) in selectedKeys
            )
        }

        val neighbors = result.selectedCandidates.mapIndexed { index, weighted ->
            val candidate = weighted.candidate
            val best = candidate.bestFingerprint
            val fingerprint = best.fingerprint
            val node = catalog.nodes[candidate.nodeId]
            KnnNeighborDiagnostic(
                rank = index + 1,
                locationId = candidate.nodeId,
                scanId = fingerprint.scanId,
                distance = candidate.distance,
                weight = weighted.weight,
                normalizedWeight = weighted.weight / result.totalWeight,
                nodeId = node?.nodeId,
                nodeName = node?.name,
                nodeX = node?.x,
                nodeY = node?.y,
                floorId = node?.floorId,
                matchedBssidCount = best.components.matchedBssidCount,
                missingFromScanCount = fingerprint.apList.map { it.bssid }.toSet().subtract(liveMap.keys).size,
                extraFromScanCount = liveMap.keys.subtract(fingerprint.apList.map { it.bssid }.toSet()).size,
                unionBssidCount = best.components.unionBssidCount,
                overlapRatio = best.components.overlapRatio,
                bestFingerprintDistance = best.components.distance,
                fingerprintCount = candidate.fingerprintCount
            )
        }

        val selectedByNode = neighbors.associateBy { it.locationId }
        val nodeSummaries = result.allLocationCandidates.mapIndexedNotNull { index, candidate ->
            val best = candidate.bestFingerprint
            val fingerprint = best.fingerprint
            val node = catalog.nodes[candidate.nodeId] ?: return@mapIndexedNotNull null
            val selected = selectedByNode[candidate.nodeId]
            KnnNodeDiagnostic(
                rank = index + 1,
                nodeId = candidate.nodeId,
                nodeName = node.name,
                x = node.x,
                y = node.y,
                floorId = node.floorId,
                bestDistance = candidate.distance,
                fingerprintCount = candidate.fingerprintCount,
                bestScanId = fingerprint.scanId,
                matchedBssidCount = best.components.matchedBssidCount,
                missingFromScanCount = fingerprint.apList.map { it.bssid }.toSet().subtract(liveMap.keys).size,
                extraFromScanCount = liveMap.keys.subtract(fingerprint.apList.map { it.bssid }.toSet()).size,
                selectedNeighborCount = if (selected == null) 0 else 1,
                contributionWeight = selected?.weight ?: 0.0,
                contributionPercent = selected?.normalizedWeight ?: 0.0,
                overlapRatio = best.components.overlapRatio,
                bestFingerprintDistance = best.components.distance
            )
        }

        return KnnDiagnosticReport(
            generatedAt = System.currentTimeMillis(),
            snapshotTimestamp = snapshot.timestamp,
            k = LocationKnnAlgorithm.LOCATION_K,
            penaltyRssi = DistanceUtils.PENALTY_RSSI,
            distanceMetric = "overlap_adjusted_union_rmse",
            fingerprintsPerLocation = LocationKnnAlgorithm.FINGERPRINTS_PER_LOCATION,
            minMatchedBssids = LocationKnnAlgorithm.MIN_MATCHED_BSSIDS,
            totalReadings = snapshot.readings.size,
            usedReadings = usedReadings.size,
            ignoredReadings = snapshot.readings.size - usedReadings.size,
            uniqueLiveBssidCount = liveMap.size,
            fingerprintCount = catalog.fingerprints.size,
            eligibleFingerprintCount = result.fingerprintMatches.size,
            nodeCount = catalog.nodes.size,
            localEstimate = result.estimate,
            floorWeights = result.floorWeights,
            allFingerprintDistances = allFingerprintDistances,
            nearestNeighbors = neighbors,
            nodeSummaries = nodeSummaries
        )
    }
}
