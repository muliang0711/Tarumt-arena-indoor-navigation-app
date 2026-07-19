import 'package:indoor_navigation/domain/navigation_input/navigation_input_models.dart';

RawMotionBatchStats createRawMotionBatchStats() {
  return const RawMotionBatchStats(
    lastAcceptedSampleCount: 0,
    lastDroppedSampleCount: 0,
    lastHeadingDegrees: null,
    lastLatencyMs: 0,
    rawSamplesInMemory: 0,
    totalBatches: 0,
    totalRawSamplesSeen: 0,
  );
}

RawMotionBatchStats updateRawMotionStatsAfterSensorEvent({
  required RawMotionBatchStats currentStats,
  required int rawSamplesInMemory,
}) {
  return RawMotionBatchStats(
    lastAcceptedSampleCount: currentStats.lastAcceptedSampleCount,
    lastDroppedSampleCount: currentStats.lastDroppedSampleCount,
    lastHeadingDegrees: currentStats.lastHeadingDegrees,
    lastLatencyMs: currentStats.lastLatencyMs,
    rawSamplesInMemory: rawSamplesInMemory,
    totalBatches: currentStats.totalBatches,
    totalRawSamplesSeen: currentStats.totalRawSamplesSeen + 1,
  );
}

RawMotionBatchStats updateRawMotionStatsAfterHeading({
  required RawMotionBatchStats currentStats,
  required double headingDegrees,
}) {
  return RawMotionBatchStats(
    lastAcceptedSampleCount: currentStats.lastAcceptedSampleCount,
    lastDroppedSampleCount: currentStats.lastDroppedSampleCount,
    lastHeadingDegrees: headingDegrees,
    lastLatencyMs: currentStats.lastLatencyMs,
    rawSamplesInMemory: currentStats.rawSamplesInMemory,
    totalBatches: currentStats.totalBatches,
    totalRawSamplesSeen: currentStats.totalRawSamplesSeen,
  );
}

RawMotionBatchStats updateRawMotionStatsAfterFlush({
  required RawMotionBatchStats currentStats,
  required int acceptedSampleCount,
  required int droppedSampleCount,
  required double latencyMs,
  int rawSamplesInMemory = 0,
}) {
  return RawMotionBatchStats(
    lastAcceptedSampleCount: acceptedSampleCount,
    lastDroppedSampleCount: droppedSampleCount,
    lastHeadingDegrees: currentStats.lastHeadingDegrees,
    lastLatencyMs: latencyMs,
    rawSamplesInMemory: rawSamplesInMemory,
    totalBatches: currentStats.totalBatches + 1,
    totalRawSamplesSeen: currentStats.totalRawSamplesSeen,
  );
}
