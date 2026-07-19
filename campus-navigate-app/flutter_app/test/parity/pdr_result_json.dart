import 'package:indoor_navigation/domain/navigation/derived_navigation_estimate.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';

Map<String, Object?> pdrResultToJson(PdrPipelineResult result) {
  return <String, Object?>{
    'acceptedSampleCount': result.acceptedSampleCount,
    'diagnostics': _diagnosticsToJson(result.diagnostics),
    'droppedSampleCount': result.droppedSampleCount,
    'estimate': _estimateToJson(result.estimate),
    'headingCandidates': result.headingCandidates
        .map(_headingCandidateToJson)
        .toList(growable: false),
    'latencyMs': result.latencyMs,
    'nextState': _stateToJson(result.nextState),
  };
}

Map<String, Object?> _diagnosticsToJson(PdrPipelineDiagnostics diagnostics) {
  return <String, Object?>{
    'batch': <String, Object?>{
      'acceptedSampleCount': diagnostics.batch.acceptedSampleCount,
      'batchWindowMs': diagnostics.batch.batchWindowMs,
      'droppedSampleCount': diagnostics.batch.droppedSampleCount,
      'maxBatchAgeMs': diagnostics.batch.maxBatchAgeMs,
      'maxSamplesPerBatch': diagnostics.batch.maxSamplesPerBatch,
      'rawSampleCount': diagnostics.batch.rawSampleCount,
      'sampleEndTimestampMs': diagnostics.batch.sampleEndTimestampMs,
      'sampleStartTimestampMs': diagnostics.batch.sampleStartTimestampMs,
    },
    'configSnapshot': _configToJson(diagnostics.configSnapshot),
    'heading': <String, Object?>{
      'desiredHeadingDegrees': diagnostics.heading.desiredHeadingDegrees,
      'observedHeadingDegrees': diagnostics.heading.observedHeadingDegrees,
      'previousHeadingDegrees': diagnostics.heading.previousHeadingDegrees,
      'topCandidate': diagnostics.heading.topCandidate == null
          ? null
          : _headingCandidateToJson(diagnostics.heading.topCandidate!),
    },
    'latencyMs': diagnostics.latencyMs,
    'movement': <String, Object?>{
      'blockedReason': diagnostics.movement.blockedReason?.wireValue,
      'direction': diagnostics.movement.direction.wireValue,
      'distancePixels': diagnostics.movement.distancePixels,
      'headingDegrees': diagnostics.movement.headingDegrees,
      'movedStepCount': diagnostics.movement.movedStepCount,
      'pixelsPerMeter': diagnostics.movement.pixelsPerMeter,
      'stepLengthMeters': diagnostics.movement.stepLengthMeters,
    },
    'step': <String, Object?>{
      'averageAcceleration': diagnostics.step.averageAcceleration,
      'minAcceleration': diagnostics.step.minAcceleration,
      'peakAcceleration': diagnostics.step.peakAcceleration,
      'peakTimestampMs': diagnostics.step.peakTimestampMs,
      'rejectReason': diagnostics.step.rejectReason.wireValue,
      'rotationHeadingTravelDegrees':
          diagnostics.step.rotationHeadingTravelDegrees,
      'stepCount': diagnostics.step.stepCount,
      'timeSinceLastStepMs': diagnostics.step.timeSinceLastStepMs,
    },
  };
}

Map<String, Object?> _configToJson(PdrPipelineConfig config) {
  return <String, Object?>{
    'accelerationStepThreshold': config.accelerationStepThreshold,
    'backwardConfirmationWindowMs': config.backwardConfirmationWindowMs,
    'backwardMovementPeakThreshold': config.backwardMovementPeakThreshold,
    'batchWindowMs': config.batchWindowMs,
    'maxShakeAccelerationMagnitude': config.maxShakeAccelerationMagnitude,
    'maxBatchAgeMs': config.maxBatchAgeMs,
    'maxSamplesPerBatch': config.maxSamplesPerBatch,
    'minStepIntervalMs': config.minStepIntervalMs,
    'movementHeadingToleranceDegrees': config.movementHeadingToleranceDegrees,
    'fallbackPixelsPerMeter': config.fallbackPixelsPerMeter,
    'rotationOnlyHeadingTravelDegrees': config.rotationOnlyHeadingTravelDegrees,
    'rotationOnlyMaxAverageAcceleration':
        config.rotationOnlyMaxAverageAcceleration,
    'rotationOnlyWindowMs': config.rotationOnlyWindowMs,
    'shakeCooldownMs': config.shakeCooldownMs,
    'shakeCooldownTriggerCount': config.shakeCooldownTriggerCount,
    'shakeCooldownWindowMs': config.shakeCooldownWindowMs,
    'stillnessAccelerationMagnitude': config.stillnessAccelerationMagnitude,
    'startupMovementLockMs': config.startupMovementLockMs,
    'stepLengthMeters': config.stepLengthMeters,
    'turnInPlaceCooldownMs': config.turnInPlaceCooldownMs,
    'turnInPlaceHeadingDeltaDegrees': config.turnInPlaceHeadingDeltaDegrees,
  };
}

Map<String, Object?> _headingCandidateToJson(HeadingCandidateScore candidate) {
  return <String, Object?>{
    'headingDegrees': candidate.headingDegrees,
    'label': candidate.label.wireValue,
    'score': candidate.score,
  };
}

Map<String, Object?> _estimateToJson(DerivedNavigationEstimate estimate) {
  return <String, Object?>{
    'confidence': estimate.confidence,
    'headingDegrees': estimate.headingDegrees,
    'source': estimate.source.wireValue,
    'timestampMs': estimate.timestampMs,
    'x': estimate.x,
    'y': estimate.y,
  };
}

Map<String, Object?> _stateToJson(PdrPipelineState state) {
  return <String, Object?>{
    'headingDegrees': state.headingDegrees,
    if (state.lastStepTimestampMs != null)
      'lastStepTimestampMs': state.lastStepTimestampMs,
    if (state.backwardConfirmationTimestampMs != null)
      'backwardConfirmationTimestampMs': state.backwardConfirmationTimestampMs,
    if (state.rotationHeadingSnapshots != null)
      'rotationHeadingSnapshots': state.rotationHeadingSnapshots!
          .map(
            (snapshot) => <String, Object?>{
              'headingDegrees': snapshot.headingDegrees,
              'timestampMs': snapshot.timestampMs,
            },
          )
          .toList(growable: false),
    if (state.rotationHeadingTravelDegrees != null)
      'rotationHeadingTravelDegrees': state.rotationHeadingTravelDegrees,
    if (state.shakeCooldownUntilMs != null)
      'shakeCooldownUntilMs': state.shakeCooldownUntilMs,
    if (state.shakeSpikeCount != null) 'shakeSpikeCount': state.shakeSpikeCount,
    if (state.shakeWindowStartedAtMs != null)
      'shakeWindowStartedAtMs': state.shakeWindowStartedAtMs,
    if (state.startedAtMs != null) 'startedAtMs': state.startedAtMs,
    if (state.turnInPlaceUntilMs != null)
      'turnInPlaceUntilMs': state.turnInPlaceUntilMs,
    'timestampMs': state.timestampMs,
    'x': state.x,
    'y': state.y,
  };
}
