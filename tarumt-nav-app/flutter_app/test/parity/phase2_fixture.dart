import 'dart:convert';
import 'dart:io';

import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';

final class Phase2FixtureDocument {
  Phase2FixtureDocument({
    required this.approvedDivergences,
    required List<PdrParityCase> pdrCases,
    required this.schemaVersion,
    required this.tolerance,
  }) : pdrCases = List.unmodifiable(pdrCases);

  final List<Object?> approvedDivergences;
  final List<PdrParityCase> pdrCases;
  final int schemaVersion;
  final Phase2Tolerance tolerance;
}

final class Phase2Tolerance {
  const Phase2Tolerance({required this.absolute, required this.relative});

  final double absolute;
  final double relative;
}

final class PdrParityCase {
  PdrParityCase({
    required this.config,
    required this.description,
    required this.desiredHeadingDegrees,
    required this.id,
    required this.nowMs,
    required this.pixelsPerMeter,
    required this.previousState,
    required List<MotionInputSample> samples,
  }) : samples = List.unmodifiable(samples);

  final PdrPipelineConfig config;
  final String description;
  final double desiredHeadingDegrees;
  final String id;
  final int nowMs;
  final double? pixelsPerMeter;
  final PdrPipelineState previousState;
  final List<MotionInputSample> samples;
}

Phase2FixtureDocument loadPhase2Fixture() {
  final document = _readJsonMap('test/fixtures/parity/input.json');
  final tolerance = _asMap(document['tolerances']);
  return Phase2FixtureDocument(
    approvedDivergences: List<Object?>.unmodifiable(
      _asList(document['approvedDivergences']),
    ),
    pdrCases: _asList(
      document['pdrCases'],
    ).map(_asMap).map(_decodePdrCase).toList(growable: false),
    schemaVersion: _asInt(document['schemaVersion']),
    tolerance: Phase2Tolerance(
      absolute: _asDouble(tolerance['absolute']),
      relative: _asDouble(tolerance['relative']),
    ),
  );
}

Map<String, Object?> loadPhase2Golden() {
  return _readJsonMap('test/fixtures/parity/golden.json');
}

PdrParityCase _decodePdrCase(Map<String, Object?> value) {
  return PdrParityCase(
    config: _decodeConfig(_asOptionalMap(value['config'])),
    description: _asString(value['description']),
    desiredHeadingDegrees: _asDouble(value['desiredHeadingDegrees']),
    id: _asString(value['id']),
    nowMs: _asInt(value['nowMs']),
    pixelsPerMeter: _asOptionalDouble(value['pixelsPerMeter']),
    previousState: _decodeState(_asMap(value['previousState'])),
    samples: _decodeSamples(_asMap(value['samples'])),
  );
}

PdrPipelineConfig _decodeConfig(Map<String, Object?>? value) {
  final config = value ?? const <String, Object?>{};
  return PdrPipelineConfig(
    accelerationStepThreshold: _doubleOr(
      config,
      'accelerationStepThreshold',
      defaultPdrPipelineConfig.accelerationStepThreshold,
    ),
    backwardConfirmationWindowMs: _intOr(
      config,
      'backwardConfirmationWindowMs',
      defaultPdrPipelineConfig.backwardConfirmationWindowMs,
    ),
    backwardMovementPeakThreshold: _doubleOr(
      config,
      'backwardMovementPeakThreshold',
      defaultPdrPipelineConfig.backwardMovementPeakThreshold,
    ),
    batchWindowMs: _intOr(
      config,
      'batchWindowMs',
      defaultPdrPipelineConfig.batchWindowMs,
    ),
    maxShakeAccelerationMagnitude: _doubleOr(
      config,
      'maxShakeAccelerationMagnitude',
      defaultPdrPipelineConfig.maxShakeAccelerationMagnitude,
    ),
    maxBatchAgeMs: _intOr(
      config,
      'maxBatchAgeMs',
      defaultPdrPipelineConfig.maxBatchAgeMs,
    ),
    maxSamplesPerBatch: _intOr(
      config,
      'maxSamplesPerBatch',
      defaultPdrPipelineConfig.maxSamplesPerBatch,
    ),
    minStepIntervalMs: _intOr(
      config,
      'minStepIntervalMs',
      defaultPdrPipelineConfig.minStepIntervalMs,
    ),
    movementHeadingToleranceDegrees: _doubleOr(
      config,
      'movementHeadingToleranceDegrees',
      defaultPdrPipelineConfig.movementHeadingToleranceDegrees,
    ),
    fallbackPixelsPerMeter: _doubleOr(
      config,
      'fallbackPixelsPerMeter',
      defaultPdrPipelineConfig.fallbackPixelsPerMeter,
    ),
    rotationOnlyHeadingTravelDegrees: _doubleOr(
      config,
      'rotationOnlyHeadingTravelDegrees',
      defaultPdrPipelineConfig.rotationOnlyHeadingTravelDegrees,
    ),
    rotationOnlyMaxAverageAcceleration: _doubleOr(
      config,
      'rotationOnlyMaxAverageAcceleration',
      defaultPdrPipelineConfig.rotationOnlyMaxAverageAcceleration,
    ),
    rotationOnlyWindowMs: _intOr(
      config,
      'rotationOnlyWindowMs',
      defaultPdrPipelineConfig.rotationOnlyWindowMs,
    ),
    shakeCooldownMs: _intOr(
      config,
      'shakeCooldownMs',
      defaultPdrPipelineConfig.shakeCooldownMs,
    ),
    shakeCooldownTriggerCount: _intOr(
      config,
      'shakeCooldownTriggerCount',
      defaultPdrPipelineConfig.shakeCooldownTriggerCount,
    ),
    shakeCooldownWindowMs: _intOr(
      config,
      'shakeCooldownWindowMs',
      defaultPdrPipelineConfig.shakeCooldownWindowMs,
    ),
    stillnessAccelerationMagnitude: _doubleOr(
      config,
      'stillnessAccelerationMagnitude',
      defaultPdrPipelineConfig.stillnessAccelerationMagnitude,
    ),
    startupMovementLockMs: _intOr(
      config,
      'startupMovementLockMs',
      defaultPdrPipelineConfig.startupMovementLockMs,
    ),
    stepLengthMeters: _doubleOr(
      config,
      'stepLengthMeters',
      defaultPdrPipelineConfig.stepLengthMeters,
    ),
    turnInPlaceCooldownMs: _intOr(
      config,
      'turnInPlaceCooldownMs',
      defaultPdrPipelineConfig.turnInPlaceCooldownMs,
    ),
    turnInPlaceHeadingDeltaDegrees: _doubleOr(
      config,
      'turnInPlaceHeadingDeltaDegrees',
      defaultPdrPipelineConfig.turnInPlaceHeadingDeltaDegrees,
    ),
  );
}

PdrPipelineState _decodeState(Map<String, Object?> value) {
  final snapshotsValue = value['rotationHeadingSnapshots'];
  return PdrPipelineState(
    backwardConfirmationTimestampMs: _asOptionalInt(
      value['backwardConfirmationTimestampMs'],
    ),
    headingDegrees: _asDouble(value['headingDegrees']),
    lastStepTimestampMs: _asOptionalInt(value['lastStepTimestampMs']),
    rotationHeadingSnapshots: snapshotsValue == null
        ? null
        : _asList(snapshotsValue)
              .map(_asMap)
              .map(
                (snapshot) => PdrHeadingSnapshot(
                  headingDegrees: _asDouble(snapshot['headingDegrees']),
                  timestampMs: _asInt(snapshot['timestampMs']),
                ),
              )
              .toList(growable: false),
    rotationHeadingTravelDegrees: _asOptionalDouble(
      value['rotationHeadingTravelDegrees'],
    ),
    shakeCooldownUntilMs: _asOptionalInt(value['shakeCooldownUntilMs']),
    shakeSpikeCount: _asOptionalInt(value['shakeSpikeCount']),
    shakeWindowStartedAtMs: _asOptionalInt(value['shakeWindowStartedAtMs']),
    startedAtMs: _asOptionalInt(value['startedAtMs']),
    timestampMs: _asInt(value['timestampMs']),
    turnInPlaceUntilMs: _asOptionalInt(value['turnInPlaceUntilMs']),
    x: _asDouble(value['x']),
    y: _asDouble(value['y']),
  );
}

List<MotionInputSample> _decodeSamples(Map<String, Object?> series) {
  final type = _asString(series['type']);
  if (type == 'explicit') {
    return _asList(
      series['values'],
    ).map(_asMap).map(_decodeSample).toList(growable: false);
  }
  if (type != 'uniform') {
    throw FormatException('Unsupported sample series type: $type');
  }

  final overrides = <int, Map<String, Object?>>{};
  for (final value in _asOptionalList(series['overrides']) ?? const []) {
    final override = _asMap(value);
    overrides[_asInt(override['index'])] = override;
  }
  final count = _asInt(series['count']);
  final acceleration = _asMap(series['acceleration']);
  final heading = series['headingDegrees'];
  final intervalMs = _asInt(series['intervalMs']);
  final startTimestampMs = _asInt(series['startTimestampMs']);

  return List.generate(count, (index) {
    final override = overrides[index];
    return MotionInputSample(
      acceleration: _decodeVector(
        override?['acceleration'] == null
            ? acceleration
            : _asMap(override!['acceleration']),
      ),
      headingDegrees: _decodeNumber(override?['headingDegrees'] ?? heading),
      timestampMs: startTimestampMs + index * intervalMs,
    );
  }, growable: false);
}

MotionInputSample _decodeSample(Map<String, Object?> value) {
  return MotionInputSample(
    acceleration: _decodeVector(_asMap(value['acceleration'])),
    headingDegrees: _decodeNumber(value['headingDegrees']),
    timestampMs: _asInt(value['timestampMs']),
  );
}

MotionVector _decodeVector(Map<String, Object?> value) {
  return MotionVector(
    x: _decodeNumber(value['x']),
    y: _decodeNumber(value['y']),
    z: _decodeNumber(value['z']),
  );
}

double _decodeNumber(Object? value) {
  return switch (value) {
    'Infinity' => double.infinity,
    '-Infinity' => double.negativeInfinity,
    'NaN' => double.nan,
    final num number => number.toDouble(),
    _ => throw FormatException('Expected encoded number, got $value'),
  };
}

Map<String, Object?> _readJsonMap(String path) {
  final Object? decoded = jsonDecode(File(path).readAsStringSync());
  return _asMap(decoded);
}

Map<String, Object?> _asMap(Object? value) {
  if (value is! Map<Object?, Object?>) {
    throw FormatException('Expected JSON object, got $value');
  }
  return value.map((key, nested) {
    if (key is! String) {
      throw FormatException('Expected string JSON key, got $key');
    }
    return MapEntry(key, nested);
  });
}

Map<String, Object?>? _asOptionalMap(Object? value) {
  return value == null ? null : _asMap(value);
}

List<Object?> _asList(Object? value) {
  if (value is! List<Object?>) {
    throw FormatException('Expected JSON array, got $value');
  }
  return value;
}

List<Object?>? _asOptionalList(Object? value) {
  return value == null ? null : _asList(value);
}

String _asString(Object? value) {
  if (value is! String) {
    throw FormatException('Expected string, got $value');
  }
  return value;
}

int _asInt(Object? value) {
  if (value is! int) {
    throw FormatException('Expected integer, got $value');
  }
  return value;
}

int? _asOptionalInt(Object? value) => value == null ? null : _asInt(value);

double _asDouble(Object? value) {
  if (value is! num) {
    throw FormatException('Expected number, got $value');
  }
  return value.toDouble();
}

double? _asOptionalDouble(Object? value) {
  return value == null ? null : _asDouble(value);
}

int _intOr(Map<String, Object?> values, String key, int fallback) {
  return values[key] == null ? fallback : _asInt(values[key]);
}

double _doubleOr(Map<String, Object?> values, String key, double fallback) {
  return values[key] == null ? fallback : _asDouble(values[key]);
}
