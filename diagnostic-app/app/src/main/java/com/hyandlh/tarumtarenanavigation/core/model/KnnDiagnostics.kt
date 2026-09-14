package com.hyandlh.tarumtarenanavigation.core.model

data class KnnDiagnosticReport(
    val generatedAt: Long,
    val snapshotTimestamp: Long,
    val k: Int,
    val penaltyRssi: Double,
    val distanceMetric: String,
    val fingerprintsPerLocation: Int,
    val minMatchedBssids: Int,
    val totalReadings: Int,
    val usedReadings: Int,
    val ignoredReadings: Int,
    val uniqueLiveBssidCount: Int,
    val fingerprintCount: Int,
    val eligibleFingerprintCount: Int,
    val nodeCount: Int,
    val localEstimate: PositionEstimate,
    val floorWeights: Map<String, Double>,
    val allFingerprintDistances: List<KnnFingerprintDistanceDiagnostic>,
    val nearestNeighbors: List<KnnNeighborDiagnostic>,
    val nodeSummaries: List<KnnNodeDiagnostic>
)

data class KnnFingerprintDistanceDiagnostic(
    val rank: Int,
    val locationId: String,
    val scanId: Int,
    val distance: Double,
    val unionRmse: Double,
    val overlapRatio: Double,
    val unionBssidCount: Int,
    val nodeId: String?,
    val nodeName: String?,
    val nodeX: Double?,
    val nodeY: Double?,
    val floorId: String?,
    val matchedBssidCount: Int,
    val missingFromScanCount: Int,
    val extraFromScanCount: Int,
    val fingerprintBssidCount: Int,
    val isSelectedNeighbor: Boolean
)

data class KnnNeighborDiagnostic(
    val rank: Int,
    val locationId: String,
    val scanId: Int,
    val distance: Double,
    val weight: Double,
    val normalizedWeight: Double,
    val nodeId: String?,
    val nodeName: String?,
    val nodeX: Double?,
    val nodeY: Double?,
    val floorId: String?,
    val matchedBssidCount: Int,
    val missingFromScanCount: Int,
    val extraFromScanCount: Int,
    val unionBssidCount: Int,
    val overlapRatio: Double,
    val bestFingerprintDistance: Double,
    val fingerprintCount: Int
)

data class KnnNodeDiagnostic(
    val rank: Int,
    val nodeId: String,
    val nodeName: String?,
    val x: Double?,
    val y: Double?,
    val floorId: String?,
    val bestDistance: Double,
    val fingerprintCount: Int,
    val bestScanId: Int,
    val matchedBssidCount: Int,
    val missingFromScanCount: Int,
    val extraFromScanCount: Int,
    val selectedNeighborCount: Int,
    val contributionWeight: Double,
    val contributionPercent: Double,
    val overlapRatio: Double,
    val bestFingerprintDistance: Double
)

data class OneOffKnnDiagnosticsArtifact(
    val generatedAt: Long,
    val snapshotTimestamp: Long,
    val scanJsonPath: String,
    val checkedNodeIds: List<String>,
    val apiEstimate: PositionEstimate,
    val report: KnnDiagnosticReport
)
