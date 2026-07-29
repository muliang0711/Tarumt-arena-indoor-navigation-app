import 'dart:math' as math;

import 'package:indoor_navigation/domain/common/javascript_number.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';

int detectStepCount({
  required PdrPipelineConfig config,
  required PdrPipelineState previousState,
  required List<MotionInputSample> samples,
}) {
  return analyzeStepDetection(
    config: config,
    previousState: previousState,
    samples: samples,
  ).stepCount;
}

StepDetectionDiagnostic analyzeStepDetection({
  required PdrPipelineConfig config,
  required PdrPipelineState previousState,
  required List<MotionInputSample> samples,
}) {
  final peakSample = _findPeakSample(samples);
  if (peakSample == null) {
    return _createDiagnostic(
      rejectReason: StepRejectReason.noSamples,
      samples: samples,
      stepCount: 0,
    );
  }

  final peakMagnitude = accelerationMagnitude(peakSample);
  if (peakMagnitude < config.accelerationStepThreshold) {
    return _createDiagnostic(
      peakSample: peakSample,
      rejectReason: StepRejectReason.lowPeak,
      samples: samples,
      stepCount: 0,
    );
  }

  if (peakMagnitude > config.maxShakeAccelerationMagnitude) {
    return _createDiagnostic(
      peakSample: peakSample,
      rejectReason: StepRejectReason.shakeTooHigh,
      samples: samples,
      stepCount: 0,
    );
  }

  if (!_hasStillnessBeforePeak(samples, peakSample, config)) {
    return _createDiagnostic(
      peakSample: peakSample,
      rejectReason: StepRejectReason.noQuietSample,
      samples: samples,
      stepCount: 0,
    );
  }

  final previousStepTimestampMs = previousState.lastStepTimestampMs;
  if (previousStepTimestampMs != null &&
      peakSample.timestampMs - previousStepTimestampMs <
          config.minStepIntervalMs) {
    return _createDiagnostic(
      peakSample: peakSample,
      previousStepTimestampMs: previousStepTimestampMs,
      rejectReason: StepRejectReason.tooSoonAfterLastStep,
      samples: samples,
      stepCount: 0,
    );
  }

  return _createDiagnostic(
    peakSample: peakSample,
    previousStepTimestampMs: previousStepTimestampMs,
    rejectReason: StepRejectReason.accepted,
    samples: samples,
    stepCount: 1,
  );
}

int? getLatestStepTimestamp({
  required List<MotionInputSample> samples,
  required int stepCount,
}) {
  if (stepCount == 0) {
    return null;
  }
  return _findPeakSample(samples)?.timestampMs;
}

/// Matches JavaScript Math.hypot, including its Infinity-before-NaN behavior.
double accelerationMagnitude(MotionInputSample sample) {
  final values = <double>[
    sample.acceleration.x,
    sample.acceleration.y,
    sample.acceleration.z,
  ];
  if (values.any((value) => value.isInfinite)) {
    return double.infinity;
  }
  if (values.any((value) => value.isNaN)) {
    return double.nan;
  }

  final absoluteValues = values.map((value) => value.abs());
  final largest = absoluteValues.reduce(math.max);
  if (largest == 0) {
    return 0;
  }
  var scaledSquares = 0.0;
  for (final value in values) {
    final scaled = value / largest;
    scaledSquares += scaled * scaled;
  }
  return largest * math.sqrt(scaledSquares);
}

MotionInputSample? _findPeakSample(List<MotionInputSample> samples) {
  MotionInputSample? peakSample;
  for (final sample in samples) {
    if (peakSample == null ||
        accelerationMagnitude(sample) > accelerationMagnitude(peakSample)) {
      peakSample = sample;
    }
  }
  return peakSample;
}

bool _hasStillnessBeforePeak(
  List<MotionInputSample> samples,
  MotionInputSample peakSample,
  PdrPipelineConfig config,
) {
  return samples.any(
    (sample) =>
        sample.timestampMs < peakSample.timestampMs &&
        accelerationMagnitude(sample) <= config.stillnessAccelerationMagnitude,
  );
}

StepDetectionDiagnostic _createDiagnostic({
  MotionInputSample? peakSample,
  int? previousStepTimestampMs,
  required StepRejectReason rejectReason,
  required List<MotionInputSample> samples,
  required int stepCount,
}) {
  final magnitudes = samples.map(accelerationMagnitude).toList(growable: false);
  final peakAcceleration = peakSample == null
      ? 0.0
      : accelerationMagnitude(peakSample);
  final minAcceleration = magnitudes.isEmpty
      ? 0.0
      : magnitudes.reduce(math.min);
  final averageAcceleration = magnitudes.isEmpty
      ? 0.0
      : magnitudes.reduce((total, magnitude) => total + magnitude) /
            magnitudes.length;

  return StepDetectionDiagnostic(
    averageAcceleration: javascriptToFixedNumber(averageAcceleration, 3),
    minAcceleration: javascriptToFixedNumber(minAcceleration, 3),
    peakAcceleration: javascriptToFixedNumber(peakAcceleration, 3),
    peakTimestampMs: peakSample?.timestampMs,
    rejectReason: rejectReason,
    rotationHeadingTravelDegrees: 0,
    stepCount: stepCount,
    timeSinceLastStepMs: peakSample != null && previousStepTimestampMs != null
        ? peakSample.timestampMs - previousStepTimestampMs
        : null,
  );
}
