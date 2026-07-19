import 'package:indoor_navigation/domain/pdr/pdr_models.dart';
import 'package:indoor_navigation/domain/sensor_debug/sensor_debug_models.dart';

Map<String, Object?> encodeSensorDebugSessionStart(
  SensorDebugSessionStart event,
) {
  return <String, Object?>{
    'configSnapshot': <String, Object?>{
      'pdr': encodePdrPipelineConfig(event.configSnapshot.pdr),
      'rawMotion': <String, Object?>{
        'flushIntervalMs': event.configSnapshot.rawMotion.flushIntervalMs,
        'headingUpdateIntervalMs':
            event.configSnapshot.rawMotion.headingUpdateIntervalMs,
        'sensorUpdateIntervalMs':
            event.configSnapshot.rawMotion.sensorUpdateIntervalMs,
      },
    },
    'sessionId': event.sessionId,
    'startedAtMs': event.startedAtMs,
  };
}

Map<String, Object?> encodeSensorDebugBatchLog(SensorDebugBatchLog log) {
  return <String, Object?>{
    'batchId': log.batchId,
    'diagnostics': encodePdrPipelineDiagnostics(log.diagnostics),
    'sessionId': log.sessionId,
    'timestampMs': log.timestampMs,
  };
}

Map<String, Object?> encodeSensorDebugSessionStop(
  SensorDebugSessionStop event,
) {
  return <String, Object?>{
    'endedAtMs': event.endedAtMs,
    'sessionId': event.sessionId,
  };
}

Map<String, Object?> encodePdrPipelineConfig(PdrPipelineConfig config) {
  return <String, Object?>{
    'accelerationStepThreshold': _jsonDouble(config.accelerationStepThreshold),
    'backwardConfirmationWindowMs': config.backwardConfirmationWindowMs,
    'backwardMovementPeakThreshold': _jsonDouble(
      config.backwardMovementPeakThreshold,
    ),
    'batchWindowMs': config.batchWindowMs,
    'maxShakeAccelerationMagnitude': _jsonDouble(
      config.maxShakeAccelerationMagnitude,
    ),
    'maxBatchAgeMs': config.maxBatchAgeMs,
    'maxSamplesPerBatch': config.maxSamplesPerBatch,
    'minStepIntervalMs': config.minStepIntervalMs,
    'movementHeadingToleranceDegrees': _jsonDouble(
      config.movementHeadingToleranceDegrees,
    ),
    'fallbackPixelsPerMeter': _jsonDouble(config.fallbackPixelsPerMeter),
    'rotationOnlyHeadingTravelDegrees': _jsonDouble(
      config.rotationOnlyHeadingTravelDegrees,
    ),
    'rotationOnlyMaxAverageAcceleration': _jsonDouble(
      config.rotationOnlyMaxAverageAcceleration,
    ),
    'rotationOnlyWindowMs': config.rotationOnlyWindowMs,
    'shakeCooldownMs': config.shakeCooldownMs,
    'shakeCooldownTriggerCount': config.shakeCooldownTriggerCount,
    'shakeCooldownWindowMs': config.shakeCooldownWindowMs,
    'stillnessAccelerationMagnitude': _jsonDouble(
      config.stillnessAccelerationMagnitude,
    ),
    'startupMovementLockMs': config.startupMovementLockMs,
    'stepLengthMeters': _jsonDouble(config.stepLengthMeters),
    'turnInPlaceCooldownMs': config.turnInPlaceCooldownMs,
    'turnInPlaceHeadingDeltaDegrees': _jsonDouble(
      config.turnInPlaceHeadingDeltaDegrees,
    ),
  };
}

Map<String, Object?> encodePdrPipelineDiagnostics(
  PdrPipelineDiagnostics diagnostics,
) {
  return <String, Object?>{
    'batch': _encodeBatchDiagnostic(diagnostics.batch),
    'configSnapshot': encodePdrPipelineConfig(diagnostics.configSnapshot),
    'heading': _encodeHeadingDiagnostic(diagnostics.heading),
    'latencyMs': _jsonDouble(diagnostics.latencyMs),
    'movement': _encodeMovementDiagnostic(diagnostics.movement),
    'step': _encodeStepDiagnostic(diagnostics.step),
  };
}

Map<String, Object?> _encodeBatchDiagnostic(PdrBatchDiagnostic diagnostic) {
  return <String, Object?>{
    'acceptedSampleCount': diagnostic.acceptedSampleCount,
    'batchWindowMs': diagnostic.batchWindowMs,
    'droppedSampleCount': diagnostic.droppedSampleCount,
    'maxBatchAgeMs': diagnostic.maxBatchAgeMs,
    'maxSamplesPerBatch': diagnostic.maxSamplesPerBatch,
    'rawSampleCount': diagnostic.rawSampleCount,
    'sampleEndTimestampMs': diagnostic.sampleEndTimestampMs,
    'sampleStartTimestampMs': diagnostic.sampleStartTimestampMs,
  };
}

Map<String, Object?> _encodeHeadingDiagnostic(PdrHeadingDiagnostic diagnostic) {
  final topCandidate = diagnostic.topCandidate;
  return <String, Object?>{
    'desiredHeadingDegrees': _jsonDouble(diagnostic.desiredHeadingDegrees),
    'observedHeadingDegrees': _jsonDouble(diagnostic.observedHeadingDegrees),
    'previousHeadingDegrees': _jsonDouble(diagnostic.previousHeadingDegrees),
    'topCandidate': topCandidate == null
        ? null
        : <String, Object?>{
            'headingDegrees': _jsonDouble(topCandidate.headingDegrees),
            'label': topCandidate.label.wireValue,
            'score': _jsonDouble(topCandidate.score),
          },
  };
}

Map<String, Object?> _encodeMovementDiagnostic(
  PdrMovementDiagnostic diagnostic,
) {
  return <String, Object?>{
    'blockedReason': diagnostic.blockedReason?.wireValue,
    'direction': diagnostic.direction.wireValue,
    'distancePixels': _jsonDouble(diagnostic.distancePixels),
    'headingDegrees': _jsonDouble(diagnostic.headingDegrees),
    'movedStepCount': diagnostic.movedStepCount,
    'pixelsPerMeter': _jsonDouble(diagnostic.pixelsPerMeter),
    'stepLengthMeters': _jsonDouble(diagnostic.stepLengthMeters),
  };
}

Map<String, Object?> _encodeStepDiagnostic(StepDetectionDiagnostic diagnostic) {
  return <String, Object?>{
    'averageAcceleration': _jsonDouble(diagnostic.averageAcceleration),
    'minAcceleration': _jsonDouble(diagnostic.minAcceleration),
    'peakAcceleration': _jsonDouble(diagnostic.peakAcceleration),
    'peakTimestampMs': diagnostic.peakTimestampMs,
    'rejectReason': diagnostic.rejectReason.wireValue,
    'rotationHeadingTravelDegrees': _jsonDouble(
      diagnostic.rotationHeadingTravelDegrees,
    ),
    'stepCount': diagnostic.stepCount,
    'timeSinceLastStepMs': diagnostic.timeSinceLastStepMs,
  };
}

num? _jsonDouble(double value) {
  if (!value.isFinite) {
    // JSON.stringify converts JavaScript NaN and Infinity numbers to null.
    return null;
  }
  if (value == value.truncateToDouble() && value.abs() <= 9007199254740991) {
    return value.toInt();
  }
  return value;
}
