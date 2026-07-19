import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';
import 'package:indoor_navigation/domain/sensor_debug/codec/codec.dart';
import 'package:indoor_navigation/domain/sensor_debug/sensor_debug_models.dart';

void main() {
  test(
    'encodes session start with exact config and raw-motion field names',
    () {
      const event = SensorDebugSessionStart(
        configSnapshot: SensorDebugConfigSnapshot(
          pdr: defaultPdrPipelineConfig,
          rawMotion: rawMotionConsumerConfig,
        ),
        sessionId: 'step-test-2026-07-16T00-00-00Z',
        startedAtMs: 1000,
      );

      expect(encodeSensorDebugSessionStart(event), <String, Object?>{
        'configSnapshot': <String, Object?>{
          'pdr': _expectedPdrConfig,
          'rawMotion': <String, Object?>{
            'flushIntervalMs': 60,
            'headingUpdateIntervalMs': 50,
            'sensorUpdateIntervalMs': 30,
          },
        },
        'sessionId': 'step-test-2026-07-16T00-00-00Z',
        'startedAtMs': 1000,
      });
    },
  );

  test('encodes batch diagnostics with enum wires and explicit nulls', () {
    final log = SensorDebugBatchLog(
      batchId: 3,
      diagnostics: _diagnostics(),
      sessionId: 'session-1',
      timestampMs: 1200,
    );

    expect(encodeSensorDebugBatchLog(log), <String, Object?>{
      'batchId': 3,
      'diagnostics': <String, Object?>{
        'batch': <String, Object?>{
          'acceptedSampleCount': 0,
          'batchWindowMs': 180,
          'droppedSampleCount': 2,
          'maxBatchAgeMs': 200,
          'maxSamplesPerBatch': 32,
          'rawSampleCount': 2,
          'sampleEndTimestampMs': null,
          'sampleStartTimestampMs': null,
        },
        'configSnapshot': _expectedPdrConfig,
        'heading': <String, Object?>{
          'desiredHeadingDegrees': 90,
          'observedHeadingDegrees': 100,
          'previousHeadingDegrees': 80,
          'topCandidate': <String, Object?>{
            'headingDegrees': 90,
            'label': 'desired',
            'score': 0.9,
          },
        },
        'latencyMs': 25,
        'movement': <String, Object?>{
          'blockedReason': 'shake-cooldown',
          'direction': 'forward',
          'distancePixels': 0,
          'headingDegrees': 90,
          'movedStepCount': 0,
          'pixelsPerMeter': 56,
          'stepLengthMeters': 0.5,
        },
        'step': <String, Object?>{
          'averageAcceleration': null,
          'minAcceleration': 0.2,
          'peakAcceleration': null,
          'peakTimestampMs': null,
          'rejectReason': 'NO_SAMPLES',
          'rotationHeadingTravelDegrees': 0,
          'stepCount': 0,
          'timeSinceLastStepMs': null,
        },
      },
      'sessionId': 'session-1',
      'timestampMs': 1200,
    });
  });

  test('emits JSON-compatible nulls for non-finite JavaScript numbers', () {
    final encoded = encodePdrPipelineDiagnostics(_diagnostics());
    final json = jsonEncode(encoded);

    expect(json, contains('"averageAcceleration":null'));
    expect(json, contains('"peakAcceleration":null'));
    expect(json, isNot(contains('NaN')));
    expect(json, isNot(contains('Infinity')));
  });

  test('keeps nullable candidate and blocked reason fields explicit', () {
    final encoded = encodePdrPipelineDiagnostics(
      _diagnostics(includeBlockedReason: false, includeCandidate: false),
    );
    final heading = encoded['heading']! as Map<String, Object?>;
    final movement = encoded['movement']! as Map<String, Object?>;

    expect(heading, containsPair('topCandidate', null));
    expect(movement, containsPair('blockedReason', null));
  });

  test('encodes session stop with no infrastructure fields', () {
    expect(
      encodeSensorDebugSessionStop(
        const SensorDebugSessionStop(endedAtMs: 2000, sessionId: 'session-1'),
      ),
      <String, Object?>{'endedAtMs': 2000, 'sessionId': 'session-1'},
    );
  });
}

final Map<String, Object?> _expectedPdrConfig = <String, Object?>{
  'accelerationStepThreshold': 1.7,
  'backwardConfirmationWindowMs': 1200,
  'backwardMovementPeakThreshold': 1.8,
  'batchWindowMs': 180,
  'maxShakeAccelerationMagnitude': 5.5,
  'maxBatchAgeMs': 200,
  'maxSamplesPerBatch': 32,
  'minStepIntervalMs': 300,
  'movementHeadingToleranceDegrees': 80,
  'fallbackPixelsPerMeter': 56,
  'rotationOnlyHeadingTravelDegrees': 15,
  'rotationOnlyMaxAverageAcceleration': 1.45,
  'rotationOnlyWindowMs': 1000,
  'shakeCooldownMs': 1200,
  'shakeCooldownTriggerCount': 2,
  'shakeCooldownWindowMs': 1000,
  'stillnessAccelerationMagnitude': 1,
  'startupMovementLockMs': 2000,
  'stepLengthMeters': 0.5,
  'turnInPlaceCooldownMs': 700,
  'turnInPlaceHeadingDeltaDegrees': 35,
};

PdrPipelineDiagnostics _diagnostics({
  bool includeBlockedReason = true,
  bool includeCandidate = true,
}) {
  return PdrPipelineDiagnostics(
    batch: const PdrBatchDiagnostic(
      acceptedSampleCount: 0,
      batchWindowMs: 180,
      droppedSampleCount: 2,
      maxBatchAgeMs: 200,
      maxSamplesPerBatch: 32,
      rawSampleCount: 2,
      sampleEndTimestampMs: null,
      sampleStartTimestampMs: null,
    ),
    configSnapshot: defaultPdrPipelineConfig,
    heading: PdrHeadingDiagnostic(
      desiredHeadingDegrees: 90,
      observedHeadingDegrees: 100,
      previousHeadingDegrees: 80,
      topCandidate: includeCandidate
          ? const HeadingCandidateScore(
              headingDegrees: 90,
              label: HeadingCandidateLabel.desired,
              score: 0.9,
            )
          : null,
    ),
    latencyMs: 25,
    movement: PdrMovementDiagnostic(
      blockedReason: includeBlockedReason
          ? MovementBlockedReason.shakeCooldown
          : null,
      direction: RouteMovementDirection.forward,
      distancePixels: 0,
      headingDegrees: 90,
      movedStepCount: 0,
      pixelsPerMeter: 56,
      stepLengthMeters: 0.5,
    ),
    step: const StepDetectionDiagnostic(
      averageAcceleration: double.nan,
      minAcceleration: 0.2,
      peakAcceleration: double.infinity,
      peakTimestampMs: null,
      rejectReason: StepRejectReason.noSamples,
      rotationHeadingTravelDegrees: 0,
      stepCount: 0,
      timeSinceLastStepMs: null,
    ),
  );
}
