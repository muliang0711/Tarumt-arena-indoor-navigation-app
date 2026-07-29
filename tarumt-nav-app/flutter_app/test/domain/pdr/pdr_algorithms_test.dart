import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/pdr/algorithms/algorithms.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';

void main() {
  group('transient motion batch', () {
    test('drops stale, future, and excess samples and sorts by timestamp', () {
      final batch = createTransientMotionBatch(
        config: _config(maxSamplesPerBatch: 3),
        nowMs: 1000,
        samples: <MotionInputSample>[
          _sample(1010, 20, 2),
          _sample(970, 8, 1.4),
          _sample(700, 0, 1.4),
          _sample(995, 10, 1.4),
          _sample(910, 2, 1.4),
          _sample(940, 5, 1.4),
        ],
      );

      expect(batch.acceptedSamples.map((sample) => sample.timestampMs), <int>[
        940,
        970,
        995,
      ]);
      expect(batch.droppedSampleCount, 3);
    });

    test('preserves input order for equal timestamps', () {
      final first = _sample(990, 10, 0.1);
      final second = _sample(990, 20, 0.2);
      final batch = createTransientMotionBatch(
        config: defaultPdrPipelineConfig,
        nowMs: 1000,
        samples: <MotionInputSample>[first, second],
      );

      expect(batch.acceptedSamples, <MotionInputSample>[first, second]);
    });

    test('supports high-frequency input and keeps only the newest 32', () {
      final samples = List.generate(
        40,
        (index) => _sample(9800 + index * 5, 0, index == 39 ? 1.9 : 0.4),
      );
      final batch = createTransientMotionBatch(
        config: defaultPdrPipelineConfig,
        nowMs: 10000,
        samples: samples,
      );

      expect(batch.acceptedSamples, hasLength(32));
      expect(batch.acceptedSamples.first.timestampMs, 9840);
      expect(batch.acceptedSamples.last.timestampMs, 9995);
      expect(batch.droppedSampleCount, 8);
    });
  });

  group('step detection', () {
    test('returns NO_SAMPLES for an empty batch', () {
      final diagnostic = analyzeStepDetection(
        config: defaultPdrPipelineConfig,
        previousState: _previousState,
        samples: const <MotionInputSample>[],
      );

      expect(diagnostic.rejectReason, StepRejectReason.noSamples);
      expect(diagnostic.stepCount, 0);
      expect(diagnostic.peakTimestampMs, isNull);
      expect(diagnostic.averageAcceleration, 0);
    });

    test('rejects low peak, missing quiet sample, shake, and fast repeat', () {
      StepRejectReason reason(List<MotionInputSample> samples) {
        return analyzeStepDetection(
          config: defaultPdrPipelineConfig,
          previousState: _previousState,
          samples: samples,
        ).rejectReason;
      }

      expect(
        reason(<MotionInputSample>[_sample(990, 0, 0.2)]),
        StepRejectReason.lowPeak,
      );
      expect(
        reason(<MotionInputSample>[_sample(920, 0, 2.4), _sample(960, 0, 2.6)]),
        StepRejectReason.noQuietSample,
      );
      expect(
        reason(<MotionInputSample>[_sample(920, 0, 0.2), _sample(960, 0, 6)]),
        StepRejectReason.shakeTooHigh,
      );
      final repeat = analyzeStepDetection(
        config: defaultPdrPipelineConfig,
        previousState: _state(lastStepTimestampMs: 800),
        samples: <MotionInputSample>[
          _sample(920, 0, 0.2),
          _sample(960, 0, 1.9),
        ],
      );
      expect(repeat.rejectReason, StepRejectReason.tooSoonAfterLastStep);
      expect(repeat.timeSinceLastStepMs, 160);
    });

    test('detects no more than one peak and returns its timestamp', () {
      final samples = <MotionInputSample>[
        _sample(920, 5, 0.2),
        _sample(960, 7, 1.9),
        _sample(990, 8, 2.1),
      ];

      expect(
        detectStepCount(
          config: defaultPdrPipelineConfig,
          previousState: _previousState,
          samples: samples,
        ),
        1,
      );
      expect(getLatestStepTimestamp(samples: samples, stepCount: 1), 990);
      expect(getLatestStepTimestamp(samples: samples, stepCount: 0), isNull);
    });

    test('matches Math.hypot behavior for NaN and Infinity', () {
      final nanDiagnostic = analyzeStepDetection(
        config: defaultPdrPipelineConfig,
        previousState: _previousState,
        samples: <MotionInputSample>[
          _sample(990, 0, double.nan),
          _sample(995, 0, 0.2),
        ],
      );
      final infinityDiagnostic = analyzeStepDetection(
        config: defaultPdrPipelineConfig,
        previousState: _previousState,
        samples: <MotionInputSample>[
          _sample(990, 0, 0.2),
          _vectorSample(
            timestampMs: 995,
            x: double.nan,
            y: double.infinity,
            z: 0,
          ),
        ],
      );

      expect(nanDiagnostic.peakAcceleration, isNaN);
      expect(nanDiagnostic.minAcceleration, isNaN);
      expect(nanDiagnostic.averageAcceleration, isNaN);
      expect(nanDiagnostic.rejectReason, StepRejectReason.noQuietSample);
      expect(infinityDiagnostic.peakAcceleration, double.infinity);
      expect(infinityDiagnostic.averageAcceleration, double.infinity);
      expect(infinityDiagnostic.rejectReason, StepRejectReason.shakeTooHigh);
    });
  });

  group('heading candidates and movement gate', () {
    test('ranks desired heading first and keeps stable order on ties', () {
      final ranked = rankHeadingCandidates(
        desiredHeadingDegrees: 0,
        observedHeadingDegrees: 10,
        previousHeadingDegrees: 350,
      );
      final tied = rankHeadingCandidates(
        desiredHeadingDegrees: 0,
        observedHeadingDegrees: 0,
        previousHeadingDegrees: 0,
      );

      expect(ranked.first.label, HeadingCandidateLabel.desired);
      expect(ranked.first.headingDegrees, 0);
      expect(
        tied.map((candidate) => candidate.label),
        HeadingCandidateLabel.values,
      );
    });

    test('classifies forward, backward, and blocked heading cones', () {
      expect(_direction(45), RouteMovementDirection.forward);
      expect(_direction(180), RouteMovementDirection.backward);
      expect(_direction(90), RouteMovementDirection.blocked);
      expect(
        shouldMoveForHeading(
          config: defaultPdrPipelineConfig,
          desiredHeadingDegrees: 0,
          observedHeadingDegrees: 180,
        ),
        isTrue,
      );
    });
  });

  group('mock motion batch', () {
    test('creates the TypeScript deterministic batch', () {
      final batch = createMockMotionBatch(
        desiredHeadingDegrees: 90,
        nowMs: 1000,
      );

      expect(batch.map((sample) => sample.headingDegrees), <double>[
        84,
        94,
        99,
        87,
      ]);
      expect(batch.map((sample) => sample.timestampMs), <int>[
        928,
        946,
        964,
        982,
      ]);
      expect(
        batch.where((sample) => sample.acceleration.x >= 1.45),
        hasLength(3),
      );
    });
  });
}

final _previousState = PdrPipelineState(
  headingDegrees: 350,
  timestampMs: 900,
  x: 236,
  y: 648,
);

MotionInputSample _sample(
  int timestampMs,
  double headingDegrees,
  double magnitude,
) {
  return MotionInputSample(
    acceleration: MotionVector(x: magnitude, y: 0, z: 0),
    headingDegrees: headingDegrees,
    timestampMs: timestampMs,
  );
}

MotionInputSample _vectorSample({
  required int timestampMs,
  required double x,
  required double y,
  required double z,
}) {
  return MotionInputSample(
    acceleration: MotionVector(x: x, y: y, z: z),
    headingDegrees: 0,
    timestampMs: timestampMs,
  );
}

PdrPipelineState _state({int? lastStepTimestampMs}) {
  return PdrPipelineState(
    headingDegrees: _previousState.headingDegrees,
    lastStepTimestampMs: lastStepTimestampMs,
    timestampMs: _previousState.timestampMs,
    x: _previousState.x,
    y: _previousState.y,
  );
}

RouteMovementDirection _direction(double observedHeadingDegrees) {
  return getRouteMovementDirection(
    config: defaultPdrPipelineConfig,
    desiredHeadingDegrees: 0,
    observedHeadingDegrees: observedHeadingDegrees,
  );
}

PdrPipelineConfig _config({required int maxSamplesPerBatch}) {
  return PdrPipelineConfig(
    accelerationStepThreshold:
        defaultPdrPipelineConfig.accelerationStepThreshold,
    backwardConfirmationWindowMs:
        defaultPdrPipelineConfig.backwardConfirmationWindowMs,
    backwardMovementPeakThreshold:
        defaultPdrPipelineConfig.backwardMovementPeakThreshold,
    batchWindowMs: defaultPdrPipelineConfig.batchWindowMs,
    maxShakeAccelerationMagnitude:
        defaultPdrPipelineConfig.maxShakeAccelerationMagnitude,
    maxBatchAgeMs: defaultPdrPipelineConfig.maxBatchAgeMs,
    maxSamplesPerBatch: maxSamplesPerBatch,
    minStepIntervalMs: defaultPdrPipelineConfig.minStepIntervalMs,
    movementHeadingToleranceDegrees:
        defaultPdrPipelineConfig.movementHeadingToleranceDegrees,
    fallbackPixelsPerMeter: defaultPdrPipelineConfig.fallbackPixelsPerMeter,
    rotationOnlyHeadingTravelDegrees:
        defaultPdrPipelineConfig.rotationOnlyHeadingTravelDegrees,
    rotationOnlyMaxAverageAcceleration:
        defaultPdrPipelineConfig.rotationOnlyMaxAverageAcceleration,
    rotationOnlyWindowMs: defaultPdrPipelineConfig.rotationOnlyWindowMs,
    shakeCooldownMs: defaultPdrPipelineConfig.shakeCooldownMs,
    shakeCooldownTriggerCount:
        defaultPdrPipelineConfig.shakeCooldownTriggerCount,
    shakeCooldownWindowMs: defaultPdrPipelineConfig.shakeCooldownWindowMs,
    stillnessAccelerationMagnitude:
        defaultPdrPipelineConfig.stillnessAccelerationMagnitude,
    startupMovementLockMs: defaultPdrPipelineConfig.startupMovementLockMs,
    stepLengthMeters: defaultPdrPipelineConfig.stepLengthMeters,
    turnInPlaceCooldownMs: defaultPdrPipelineConfig.turnInPlaceCooldownMs,
    turnInPlaceHeadingDeltaDegrees:
        defaultPdrPipelineConfig.turnInPlaceHeadingDeltaDegrees,
  );
}
