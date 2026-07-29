import 'package:indoor_navigation/domain/navigation/derived_navigation_estimate.dart';

enum DerivedEstimateSourceKind {
  debugReplay('debug-replay'),
  externalDerived('external-derived');

  const DerivedEstimateSourceKind(this.wireValue);
  final String wireValue;
}

enum DerivedEstimateIngestReason {
  accepted('accepted'),
  rateLimited('rate-limited');

  const DerivedEstimateIngestReason(this.wireValue);
  final String wireValue;
}

enum RawMotionConsumerStatus {
  idle('idle'),
  starting('starting'),
  running('running'),
  stopped('stopped'),
  unavailable('unavailable'),
  permissionDenied('permission-denied'),
  error('error');

  const RawMotionConsumerStatus(this.wireValue);
  final String wireValue;
}

final class DerivedEstimateSource {
  const DerivedEstimateSource({required this.kind, required this.name});

  final DerivedEstimateSourceKind kind;
  final String name;
}

final class DerivedEstimateBuffer {
  DerivedEstimateBuffer({
    required List<DerivedNavigationEstimate> acceptedEstimates,
    required this.droppedEstimateCount,
    required this.maxSize,
  }) : acceptedEstimates = List.unmodifiable(acceptedEstimates);

  final List<DerivedNavigationEstimate> acceptedEstimates;
  final int droppedEstimateCount;
  final int maxSize;
}

final class DerivedEstimateIngestResult {
  const DerivedEstimateIngestResult({
    required this.accepted,
    required this.acceptedEstimate,
    required this.buffer,
    required this.reason,
  });

  final bool accepted;
  final DerivedNavigationEstimate? acceptedEstimate;
  final DerivedEstimateBuffer buffer;
  final DerivedEstimateIngestReason reason;
}

final class NavigationInputPolicy {
  const NavigationInputPolicy({
    required this.maxDerivedUpdatesPerSecond,
    required this.maxRawSamplesInMemory,
  });

  final double maxDerivedUpdatesPerSecond;
  final int maxRawSamplesInMemory;
  bool get rawSensorRecordingEnabled => false;
  bool get transientRawSensorBatchingEnabled => true;
}

final class RawMotionBatchStats {
  const RawMotionBatchStats({
    required this.lastAcceptedSampleCount,
    required this.lastDroppedSampleCount,
    required this.lastHeadingDegrees,
    required this.lastLatencyMs,
    required this.rawSamplesInMemory,
    required this.totalBatches,
    required this.totalRawSamplesSeen,
  });

  final int lastAcceptedSampleCount;
  final int lastDroppedSampleCount;
  final double? lastHeadingDegrees;
  final double lastLatencyMs;
  final int rawSamplesInMemory;
  final int totalBatches;
  final int totalRawSamplesSeen;
}
