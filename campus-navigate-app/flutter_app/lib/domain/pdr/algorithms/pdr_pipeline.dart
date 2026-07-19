import 'dart:math' as math;

import 'package:indoor_navigation/domain/common/angle_math.dart';
import 'package:indoor_navigation/domain/common/javascript_number.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/navigation/derived_navigation_estimate.dart';
import 'package:indoor_navigation/domain/pdr/algorithms/heading_candidates.dart';
import 'package:indoor_navigation/domain/pdr/algorithms/movement_gate.dart';
import 'package:indoor_navigation/domain/pdr/algorithms/step_detection.dart';
import 'package:indoor_navigation/domain/pdr/algorithms/transient_motion_batch.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';

PdrPipelineResult runPdrPipeline({
  PdrPipelineConfig config = defaultPdrPipelineConfig,
  required double desiredHeadingDegrees,
  required int nowMs,
  double? pixelsPerMeter,
  required PdrPipelineState previousState,
  required List<MotionInputSample> samples,
}) {
  final batch = createTransientMotionBatch(
    config: config,
    nowMs: nowMs,
    samples: samples,
  );
  final observedHeadingDegrees = batch.acceptedSamples.isEmpty
      ? previousState.headingDegrees
      : circularMeanDegrees(
          batch.acceptedSamples.map((sample) => sample.headingDegrees),
        );
  final headingCandidates = rankHeadingCandidates(
    desiredHeadingDegrees: desiredHeadingDegrees,
    observedHeadingDegrees: observedHeadingDegrees,
    previousHeadingDegrees: previousState.headingDegrees,
  );
  final rotationWindowState = _createNextRotationWindowState(
    config: config,
    nowMs: nowMs,
    observedHeadingDegrees: observedHeadingDegrees,
    previousState: previousState,
  );
  final rawStepDiagnostic = analyzeStepDetection(
    config: config,
    previousState: previousState,
    samples: batch.acceptedSamples,
  );
  final stepDiagnostic = _applyPhoneRotationGate(
    config: config,
    rotationHeadingTravelDegrees:
        rotationWindowState.rotationHeadingTravelDegrees,
    stepDiagnostic: rawStepDiagnostic,
  );
  final stepCount = stepDiagnostic.stepCount;
  final movementDirection = getRouteMovementDirection(
    config: config,
    desiredHeadingDegrees: desiredHeadingDegrees,
    observedHeadingDegrees: observedHeadingDegrees,
  );
  final movementHeading = movementDirection == RouteMovementDirection.backward
      ? normalizeDegrees(desiredHeadingDegrees + 180)
      : headingCandidates.firstOrNull?.headingDegrees ?? observedHeadingDegrees;
  final effectivePixelsPerMeter = pixelsPerMeter != null && pixelsPerMeter > 0
      ? pixelsPerMeter
      : config.fallbackPixelsPerMeter;
  final movementGuardState = _createNextMovementGuardState(
    config: config,
    movementDirection: movementDirection,
    nowMs: nowMs,
    observedHeadingDegrees: observedHeadingDegrees,
    previousState: previousState,
    stepDiagnostic: stepDiagnostic,
  );
  final movementBlockedReason = _getMovementBlockedReason(
    config: config,
    guardState: movementGuardState,
    movementDirection: movementDirection,
    nowMs: nowMs,
    previousState: previousState,
    stepDiagnostic: stepDiagnostic,
  );
  final distancePixels = stepCount > 0 && movementBlockedReason == null
      ? stepCount * config.stepLengthMeters * effectivePixelsPerMeter
      : 0.0;
  final headingRadians = movementHeading * math.pi / 180;
  final latestStepTimestampMs = getLatestStepTimestamp(
    samples: batch.acceptedSamples,
    stepCount: stepCount,
  );
  final nextState = PdrPipelineState(
    backwardConfirmationTimestampMs:
        _shouldStoreBackwardConfirmation(
          config: config,
          movementDirection: movementDirection,
          stepDiagnostic: stepDiagnostic,
        )
        ? latestStepTimestampMs ?? previousState.backwardConfirmationTimestampMs
        : previousState.backwardConfirmationTimestampMs,
    headingDegrees: observedHeadingDegrees,
    lastStepTimestampMs:
        latestStepTimestampMs ?? previousState.lastStepTimestampMs,
    rotationHeadingSnapshots: rotationWindowState.rotationHeadingSnapshots,
    rotationHeadingTravelDegrees:
        rotationWindowState.rotationHeadingTravelDegrees,
    shakeCooldownUntilMs: movementGuardState.shakeCooldownUntilMs,
    shakeSpikeCount: movementGuardState.shakeSpikeCount,
    shakeWindowStartedAtMs: movementGuardState.shakeWindowStartedAtMs,
    // The TypeScript next-state literal intentionally does not carry the
    // one-shot `startedAtMs` marker forward, so the optional field is omitted.
    timestampMs: nowMs,
    turnInPlaceUntilMs: movementGuardState.turnInPlaceUntilMs,
    x: previousState.x + math.cos(headingRadians) * distancePixels,
    y: previousState.y + math.sin(headingRadians) * distancePixels,
  );
  final latencyMs = _calculateLatencyMs(batch.acceptedSamples, nowMs);

  return PdrPipelineResult(
    acceptedSampleCount: batch.acceptedSamples.length,
    diagnostics: PdrPipelineDiagnostics(
      batch: PdrBatchDiagnostic(
        acceptedSampleCount: batch.acceptedSamples.length,
        batchWindowMs: config.batchWindowMs,
        droppedSampleCount: batch.droppedSampleCount,
        maxBatchAgeMs: config.maxBatchAgeMs,
        maxSamplesPerBatch: config.maxSamplesPerBatch,
        rawSampleCount: samples.length,
        sampleEndTimestampMs: batch.acceptedSamples.lastOrNull?.timestampMs,
        sampleStartTimestampMs: batch.acceptedSamples.firstOrNull?.timestampMs,
      ),
      configSnapshot: config,
      heading: PdrHeadingDiagnostic(
        desiredHeadingDegrees: desiredHeadingDegrees,
        observedHeadingDegrees: observedHeadingDegrees,
        previousHeadingDegrees: previousState.headingDegrees,
        topCandidate: headingCandidates.firstOrNull,
      ),
      latencyMs: latencyMs.toDouble(),
      movement: PdrMovementDiagnostic(
        blockedReason: movementBlockedReason,
        direction: movementDirection,
        distancePixels: javascriptToFixedNumber(distancePixels, 3),
        headingDegrees: movementHeading,
        movedStepCount: distancePixels > 0 ? stepCount : 0,
        pixelsPerMeter: javascriptToFixedNumber(effectivePixelsPerMeter, 3),
        stepLengthMeters: config.stepLengthMeters,
      ),
      step: stepDiagnostic,
    ),
    droppedSampleCount: batch.droppedSampleCount,
    estimate: DerivedNavigationEstimate(
      confidence: _calculateConfidence(
        batch.acceptedSamples.length,
        headingCandidates.firstOrNull?.score ?? 0,
      ),
      headingDegrees: observedHeadingDegrees,
      source: DerivedNavigationEstimateSource.pdrSummary,
      timestampMs: nowMs,
      x: nextState.x,
      y: nextState.y,
    ),
    headingCandidates: headingCandidates,
    latencyMs: latencyMs.toDouble(),
    nextState: nextState,
  );
}

double _calculateConfidence(int sampleCount, double headingScore) {
  final sampleConfidence = math.min(1, sampleCount / 6);
  return javascriptToFixedNumber(
    sampleConfidence * 0.35 + headingScore * 0.65,
    3,
  );
}

_RotationWindowState _createNextRotationWindowState({
  required PdrPipelineConfig config,
  required int nowMs,
  required double observedHeadingDegrees,
  required PdrPipelineState previousState,
}) {
  final snapshots =
      <PdrHeadingSnapshot>[
            ...?previousState.rotationHeadingSnapshots,
            PdrHeadingSnapshot(
              headingDegrees: observedHeadingDegrees,
              timestampMs: nowMs,
            ),
          ]
          .where(
            (snapshot) =>
                nowMs - snapshot.timestampMs <= config.rotationOnlyWindowMs,
          )
          .toList(growable: false);

  return _RotationWindowState(
    rotationHeadingSnapshots: snapshots,
    rotationHeadingTravelDegrees: _calculateHeadingTravelDegrees(snapshots),
  );
}

double _calculateHeadingTravelDegrees(List<PdrHeadingSnapshot> snapshots) {
  var travelDegrees = 0.0;
  for (var index = 1; index < snapshots.length; index += 1) {
    travelDegrees += shortestAngleDistanceDegrees(
      snapshots[index].headingDegrees,
      snapshots[index - 1].headingDegrees,
    );
  }
  return javascriptToFixedNumber(travelDegrees, 3);
}

StepDetectionDiagnostic _applyPhoneRotationGate({
  required PdrPipelineConfig config,
  required double rotationHeadingTravelDegrees,
  required StepDetectionDiagnostic stepDiagnostic,
}) {
  final isPhoneRotation =
      stepDiagnostic.rejectReason == StepRejectReason.accepted &&
      rotationHeadingTravelDegrees >= config.rotationOnlyHeadingTravelDegrees &&
      stepDiagnostic.averageAcceleration <=
          config.rotationOnlyMaxAverageAcceleration;

  return StepDetectionDiagnostic(
    averageAcceleration: stepDiagnostic.averageAcceleration,
    minAcceleration: stepDiagnostic.minAcceleration,
    peakAcceleration: stepDiagnostic.peakAcceleration,
    peakTimestampMs: stepDiagnostic.peakTimestampMs,
    rejectReason: isPhoneRotation
        ? StepRejectReason.phoneRotation
        : stepDiagnostic.rejectReason,
    rotationHeadingTravelDegrees: rotationHeadingTravelDegrees,
    stepCount: isPhoneRotation ? 0 : stepDiagnostic.stepCount,
    timeSinceLastStepMs: stepDiagnostic.timeSinceLastStepMs,
  );
}

MovementBlockedReason? _getMovementBlockedReason({
  required PdrPipelineConfig config,
  required _MovementGuardState guardState,
  required RouteMovementDirection movementDirection,
  required int nowMs,
  required PdrPipelineState previousState,
  required StepDetectionDiagnostic stepDiagnostic,
}) {
  if (stepDiagnostic.stepCount == 0) {
    return null;
  }
  final startedAtMs = previousState.startedAtMs;
  if (startedAtMs != null &&
      nowMs - startedAtMs < config.startupMovementLockMs) {
    return MovementBlockedReason.startupLock;
  }
  final shakeCooldownUntilMs = guardState.shakeCooldownUntilMs;
  if (shakeCooldownUntilMs != null && nowMs < shakeCooldownUntilMs) {
    return MovementBlockedReason.shakeCooldown;
  }
  final turnInPlaceUntilMs = guardState.turnInPlaceUntilMs;
  if (turnInPlaceUntilMs != null && nowMs < turnInPlaceUntilMs) {
    return MovementBlockedReason.turningInPlace;
  }
  if (movementDirection == RouteMovementDirection.blocked) {
    return MovementBlockedReason.heading;
  }
  if (movementDirection == RouteMovementDirection.backward &&
      stepDiagnostic.peakAcceleration < config.backwardMovementPeakThreshold) {
    return MovementBlockedReason.backwardWeakStep;
  }
  if (movementDirection == RouteMovementDirection.backward &&
      !_hasRecentBackwardConfirmation(
        config: config,
        peakTimestampMs: stepDiagnostic.peakTimestampMs,
        previousBackwardConfirmationTimestampMs:
            previousState.backwardConfirmationTimestampMs,
      )) {
    return MovementBlockedReason.backwardConfirming;
  }
  return null;
}

_MovementGuardState _createNextMovementGuardState({
  required PdrPipelineConfig config,
  required RouteMovementDirection movementDirection,
  required int nowMs,
  required double observedHeadingDegrees,
  required PdrPipelineState previousState,
  required StepDetectionDiagnostic stepDiagnostic,
}) {
  final previousCooldownUntilMs = previousState.shakeCooldownUntilMs;
  var shakeCooldownUntilMs =
      previousCooldownUntilMs != null && nowMs < previousCooldownUntilMs
      ? previousCooldownUntilMs
      : null;
  var shakeSpikeCount = previousState.shakeSpikeCount ?? 0;
  var shakeWindowStartedAtMs = previousState.shakeWindowStartedAtMs;
  final previousTurnInPlaceUntilMs = previousState.turnInPlaceUntilMs;
  var turnInPlaceUntilMs =
      previousTurnInPlaceUntilMs != null && nowMs < previousTurnInPlaceUntilMs
      ? previousTurnInPlaceUntilMs
      : null;

  if (shakeWindowStartedAtMs != null &&
      nowMs - shakeWindowStartedAtMs > config.shakeCooldownWindowMs) {
    shakeSpikeCount = 0;
    shakeWindowStartedAtMs = null;
  }

  if (stepDiagnostic.rejectReason == StepRejectReason.shakeTooHigh &&
      stepDiagnostic.peakTimestampMs != null) {
    final peakTimestampMs = stepDiagnostic.peakTimestampMs!;
    if (shakeWindowStartedAtMs == null ||
        peakTimestampMs - shakeWindowStartedAtMs >
            config.shakeCooldownWindowMs) {
      shakeWindowStartedAtMs = peakTimestampMs;
      shakeSpikeCount = 1;
    } else {
      shakeSpikeCount += 1;
    }

    if (shakeSpikeCount >= config.shakeCooldownTriggerCount) {
      shakeCooldownUntilMs = _maxInt(
        shakeCooldownUntilMs ?? 0,
        peakTimestampMs + config.shakeCooldownMs,
      );
      shakeWindowStartedAtMs = peakTimestampMs;
      shakeSpikeCount = 0;
    }
  }

  if (movementDirection != RouteMovementDirection.backward &&
      stepDiagnostic.stepCount > 0 &&
      shortestAngleDistanceDegrees(
            observedHeadingDegrees,
            previousState.headingDegrees,
          ) >=
          config.turnInPlaceHeadingDeltaDegrees) {
    turnInPlaceUntilMs = _maxInt(
      turnInPlaceUntilMs ?? 0,
      nowMs + config.turnInPlaceCooldownMs,
    );
  }

  return _MovementGuardState(
    shakeCooldownUntilMs: shakeCooldownUntilMs,
    shakeSpikeCount: shakeSpikeCount,
    shakeWindowStartedAtMs: shakeWindowStartedAtMs,
    turnInPlaceUntilMs: turnInPlaceUntilMs,
  );
}

bool _shouldStoreBackwardConfirmation({
  required PdrPipelineConfig config,
  required RouteMovementDirection movementDirection,
  required StepDetectionDiagnostic stepDiagnostic,
}) {
  return stepDiagnostic.stepCount > 0 &&
      movementDirection == RouteMovementDirection.backward &&
      stepDiagnostic.peakAcceleration >= config.backwardMovementPeakThreshold;
}

bool _hasRecentBackwardConfirmation({
  required PdrPipelineConfig config,
  required int? peakTimestampMs,
  required int? previousBackwardConfirmationTimestampMs,
}) {
  if (peakTimestampMs == null ||
      previousBackwardConfirmationTimestampMs == null) {
    return false;
  }
  return peakTimestampMs - previousBackwardConfirmationTimestampMs <=
      config.backwardConfirmationWindowMs;
}

int _calculateLatencyMs(List<MotionInputSample> samples, int nowMs) {
  final newestSample = samples.lastOrNull;
  return newestSample == null ? 0 : nowMs - newestSample.timestampMs;
}

int _maxInt(int left, int right) => left > right ? left : right;

final class _RotationWindowState {
  _RotationWindowState({
    required List<PdrHeadingSnapshot> rotationHeadingSnapshots,
    required this.rotationHeadingTravelDegrees,
  }) : rotationHeadingSnapshots = List.unmodifiable(rotationHeadingSnapshots);

  final List<PdrHeadingSnapshot> rotationHeadingSnapshots;
  final double rotationHeadingTravelDegrees;
}

final class _MovementGuardState {
  const _MovementGuardState({
    required this.shakeCooldownUntilMs,
    required this.shakeSpikeCount,
    required this.shakeWindowStartedAtMs,
    required this.turnInPlaceUntilMs,
  });

  final int? shakeCooldownUntilMs;
  final int shakeSpikeCount;
  final int? shakeWindowStartedAtMs;
  final int? turnInPlaceUntilMs;
}
