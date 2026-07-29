import 'package:indoor_navigation/domain/pdr/pdr_models.dart';

final class RawMotionConsumerConfig {
  const RawMotionConsumerConfig({
    required this.flushIntervalMs,
    required this.headingUpdateIntervalMs,
    required this.sensorUpdateIntervalMs,
  });

  final int flushIntervalMs;
  final int headingUpdateIntervalMs;
  final int sensorUpdateIntervalMs;
}

final class SensorDebugConfigSnapshot {
  const SensorDebugConfigSnapshot({required this.pdr, required this.rawMotion});

  final PdrPipelineConfig pdr;
  final RawMotionConsumerConfig rawMotion;
}

final class SensorDebugSessionStart {
  const SensorDebugSessionStart({
    required this.configSnapshot,
    required this.sessionId,
    required this.startedAtMs,
  });

  final SensorDebugConfigSnapshot configSnapshot;
  final String sessionId;
  final int startedAtMs;
}

final class SensorDebugBatchLog {
  const SensorDebugBatchLog({
    required this.batchId,
    required this.diagnostics,
    required this.sessionId,
    required this.timestampMs,
  });

  final int batchId;
  final PdrPipelineDiagnostics diagnostics;
  final String sessionId;
  final int timestampMs;
}

final class SensorDebugSessionStop {
  const SensorDebugSessionStop({
    required this.endedAtMs,
    required this.sessionId,
  });

  final int endedAtMs;
  final String sessionId;
}
