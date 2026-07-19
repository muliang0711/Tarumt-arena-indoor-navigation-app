import 'package:indoor_navigation/domain/navigation/derived_navigation_estimate.dart';

enum HeadingCandidateLabel {
  desired('desired'),
  observed('observed'),
  previous('previous');

  const HeadingCandidateLabel(this.wireValue);
  final String wireValue;
}

enum RouteMovementDirection {
  backward('backward'),
  blocked('blocked'),
  forward('forward');

  const RouteMovementDirection(this.wireValue);
  final String wireValue;
}

enum MovementBlockedReason {
  backwardConfirming('backward-confirming'),
  backwardWeakStep('backward-weak-step'),
  heading('heading'),
  shakeCooldown('shake-cooldown'),
  startupLock('startup-lock'),
  turningInPlace('turning-in-place');

  const MovementBlockedReason(this.wireValue);
  final String wireValue;
}

enum StepRejectReason {
  accepted('ACCEPTED'),
  lowPeak('LOW_PEAK'),
  noQuietSample('NO_QUIET_SAMPLE'),
  noSamples('NO_SAMPLES'),
  phoneRotation('PHONE_ROTATION'),
  shakeTooHigh('SHAKE_TOO_HIGH'),
  tooSoonAfterLastStep('TOO_SOON_AFTER_LAST_STEP');

  const StepRejectReason(this.wireValue);
  final String wireValue;
}

final class MotionVector {
  const MotionVector({required this.x, required this.y, required this.z});

  final double x;
  final double y;
  final double z;
}

final class MotionInputSample {
  const MotionInputSample({
    required this.acceleration,
    required this.headingDegrees,
    required this.timestampMs,
  });

  final MotionVector acceleration;
  final double headingDegrees;
  final int timestampMs;
}

final class HeadingCandidateScore {
  const HeadingCandidateScore({
    required this.headingDegrees,
    required this.label,
    required this.score,
  });

  final double headingDegrees;
  final HeadingCandidateLabel label;
  final double score;
}

final class PdrBatchDiagnostic {
  const PdrBatchDiagnostic({
    required this.acceptedSampleCount,
    required this.batchWindowMs,
    required this.droppedSampleCount,
    required this.maxBatchAgeMs,
    required this.maxSamplesPerBatch,
    required this.rawSampleCount,
    required this.sampleEndTimestampMs,
    required this.sampleStartTimestampMs,
  });

  final int acceptedSampleCount;
  final int batchWindowMs;
  final int droppedSampleCount;
  final int maxBatchAgeMs;
  final int maxSamplesPerBatch;
  final int rawSampleCount;
  final int? sampleEndTimestampMs;
  final int? sampleStartTimestampMs;
}

final class PdrHeadingDiagnostic {
  const PdrHeadingDiagnostic({
    required this.desiredHeadingDegrees,
    required this.observedHeadingDegrees,
    required this.previousHeadingDegrees,
    required this.topCandidate,
  });

  final double desiredHeadingDegrees;
  final double observedHeadingDegrees;
  final double previousHeadingDegrees;
  final HeadingCandidateScore? topCandidate;
}

final class PdrHeadingSnapshot {
  const PdrHeadingSnapshot({
    required this.headingDegrees,
    required this.timestampMs,
  });

  final double headingDegrees;
  final int timestampMs;
}

final class PdrMovementDiagnostic {
  const PdrMovementDiagnostic({
    required this.blockedReason,
    required this.direction,
    required this.distancePixels,
    required this.headingDegrees,
    required this.movedStepCount,
    required this.pixelsPerMeter,
    required this.stepLengthMeters,
  });

  final MovementBlockedReason? blockedReason;
  final RouteMovementDirection direction;
  final double distancePixels;
  final double headingDegrees;
  final int movedStepCount;
  final double pixelsPerMeter;
  final double stepLengthMeters;
}

final class PdrPipelineConfig {
  const PdrPipelineConfig({
    required this.accelerationStepThreshold,
    required this.backwardConfirmationWindowMs,
    required this.backwardMovementPeakThreshold,
    required this.batchWindowMs,
    required this.maxShakeAccelerationMagnitude,
    required this.maxBatchAgeMs,
    required this.maxSamplesPerBatch,
    required this.minStepIntervalMs,
    required this.movementHeadingToleranceDegrees,
    required this.fallbackPixelsPerMeter,
    required this.rotationOnlyHeadingTravelDegrees,
    required this.rotationOnlyMaxAverageAcceleration,
    required this.rotationOnlyWindowMs,
    required this.shakeCooldownMs,
    required this.shakeCooldownTriggerCount,
    required this.shakeCooldownWindowMs,
    required this.stillnessAccelerationMagnitude,
    required this.startupMovementLockMs,
    required this.stepLengthMeters,
    required this.turnInPlaceCooldownMs,
    required this.turnInPlaceHeadingDeltaDegrees,
  });

  final double accelerationStepThreshold;
  final int backwardConfirmationWindowMs;
  final double backwardMovementPeakThreshold;
  final int batchWindowMs;
  final double maxShakeAccelerationMagnitude;
  final int maxBatchAgeMs;
  final int maxSamplesPerBatch;
  final int minStepIntervalMs;
  final double movementHeadingToleranceDegrees;
  final double fallbackPixelsPerMeter;
  final double rotationOnlyHeadingTravelDegrees;
  final double rotationOnlyMaxAverageAcceleration;
  final int rotationOnlyWindowMs;
  final int shakeCooldownMs;
  final int shakeCooldownTriggerCount;
  final int shakeCooldownWindowMs;
  final double stillnessAccelerationMagnitude;
  final int startupMovementLockMs;
  final double stepLengthMeters;
  final int turnInPlaceCooldownMs;
  final double turnInPlaceHeadingDeltaDegrees;
}

final class StepDetectionDiagnostic {
  const StepDetectionDiagnostic({
    required this.averageAcceleration,
    required this.minAcceleration,
    required this.peakAcceleration,
    required this.peakTimestampMs,
    required this.rejectReason,
    required this.rotationHeadingTravelDegrees,
    required this.stepCount,
    required this.timeSinceLastStepMs,
  });

  final double averageAcceleration;
  final double minAcceleration;
  final double peakAcceleration;
  final int? peakTimestampMs;
  final StepRejectReason rejectReason;
  final double rotationHeadingTravelDegrees;
  final int stepCount;
  final int? timeSinceLastStepMs;
}

final class PdrPipelineDiagnostics {
  const PdrPipelineDiagnostics({
    required this.batch,
    required this.configSnapshot,
    required this.heading,
    required this.latencyMs,
    required this.movement,
    required this.step,
  });

  final PdrBatchDiagnostic batch;
  final PdrPipelineConfig configSnapshot;
  final PdrHeadingDiagnostic heading;
  final double latencyMs;
  final PdrMovementDiagnostic movement;
  final StepDetectionDiagnostic step;
}

final class PdrPipelineState {
  PdrPipelineState({
    required this.headingDegrees,
    required this.timestampMs,
    required this.x,
    required this.y,
    this.backwardConfirmationTimestampMs,
    this.lastStepTimestampMs,
    List<PdrHeadingSnapshot>? rotationHeadingSnapshots,
    this.rotationHeadingTravelDegrees,
    this.shakeCooldownUntilMs,
    this.shakeSpikeCount,
    this.shakeWindowStartedAtMs,
    this.startedAtMs,
    this.turnInPlaceUntilMs,
  }) : rotationHeadingSnapshots = rotationHeadingSnapshots == null
           ? null
           : List.unmodifiable(rotationHeadingSnapshots);

  final int? backwardConfirmationTimestampMs;
  final double headingDegrees;
  final int? lastStepTimestampMs;
  final List<PdrHeadingSnapshot>? rotationHeadingSnapshots;
  final double? rotationHeadingTravelDegrees;
  final int? shakeCooldownUntilMs;
  final int? shakeSpikeCount;
  final int? shakeWindowStartedAtMs;
  final int? startedAtMs;
  final int timestampMs;
  final int? turnInPlaceUntilMs;
  final double x;
  final double y;
}

final class PdrPipelineResult {
  PdrPipelineResult({
    required this.acceptedSampleCount,
    required this.diagnostics,
    required this.droppedSampleCount,
    required this.estimate,
    required List<HeadingCandidateScore> headingCandidates,
    required this.latencyMs,
    required this.nextState,
  }) : headingCandidates = List.unmodifiable(headingCandidates);

  final int acceptedSampleCount;
  final PdrPipelineDiagnostics diagnostics;
  final int droppedSampleCount;
  final DerivedNavigationEstimate estimate;
  final List<HeadingCandidateScore> headingCandidates;
  final double latencyMs;
  final PdrPipelineState nextState;
}
