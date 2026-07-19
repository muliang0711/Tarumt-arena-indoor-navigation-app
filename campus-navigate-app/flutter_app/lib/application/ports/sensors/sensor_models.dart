import 'package:indoor_navigation/domain/common/angle_math.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';

enum SensorPermissionStatus { notDetermined, granted, denied, restricted }

enum SensorCapabilityStatus { available, unavailable }

final class SensorAvailability {
  const SensorAvailability({required this.heading, required this.motion});

  final SensorCapabilityStatus heading;
  final SensorCapabilityStatus motion;

  bool get isHeadingAvailable => heading == SensorCapabilityStatus.available;
  bool get isMotionAvailable => motion == SensorCapabilityStatus.available;
}

final class SensorSamplingRequest {
  SensorSamplingRequest({
    required this.headingUpdateIntervalMs,
    required this.motionUpdateIntervalMs,
  }) {
    if (headingUpdateIntervalMs <= 0) {
      throw ArgumentError.value(
        headingUpdateIntervalMs,
        'headingUpdateIntervalMs',
        'must be greater than zero',
      );
    }
    if (motionUpdateIntervalMs <= 0) {
      throw ArgumentError.value(
        motionUpdateIntervalMs,
        'motionUpdateIntervalMs',
        'must be greater than zero',
      );
    }
  }

  final int headingUpdateIntervalMs;
  final int motionUpdateIntervalMs;
}

enum SensorHeadingSource { magnetometer, deviceMotionFallback }

sealed class NormalizedSensorEvent {
  const NormalizedSensorEvent({required this.receivedAtMs});

  /// The application receive time, not a native sensor timestamp.
  final int receivedAtMs;
}

final class MotionSensorEvent extends NormalizedSensorEvent {
  factory MotionSensorEvent({
    required MotionVector accelerationMetersPerSecondSquared,
    required double? fallbackHeadingDegrees,
    required int receivedAtMs,
  }) {
    return MotionSensorEvent._(
      accelerationMetersPerSecondSquared: accelerationMetersPerSecondSquared,
      fallbackHeadingDegrees: fallbackHeadingDegrees == null
          ? null
          : _normalizeFiniteHeading(fallbackHeadingDegrees),
      receivedAtMs: receivedAtMs,
    );
  }

  const MotionSensorEvent._({
    required this.accelerationMetersPerSecondSquared,
    required this.fallbackHeadingDegrees,
    required super.receivedAtMs,
  });

  /// Linear acceleration with gravity removed, in m/s².
  ///
  /// Axis direction and sign must be normalized by the platform adapter to the
  /// current TypeScript Expo DeviceMotion acceleration convention.
  ///
  /// Values are deliberately not forced finite so parity fixtures can preserve
  /// the JavaScript handling of `NaN` and infinities.
  final MotionVector accelerationMetersPerSecondSquared;
  final double? fallbackHeadingDegrees;
}

final class HeadingSensorEvent extends NormalizedSensorEvent {
  factory HeadingSensorEvent({
    required double headingDegrees,
    required int receivedAtMs,
    required SensorHeadingSource source,
  }) {
    return HeadingSensorEvent._(
      headingDegrees: _normalizeFiniteHeading(headingDegrees),
      receivedAtMs: receivedAtMs,
      source: source,
    );
  }

  const HeadingSensorEvent._({
    required this.headingDegrees,
    required super.receivedAtMs,
    required this.source,
  });

  final double headingDegrees;
  final SensorHeadingSource source;
}

double _normalizeFiniteHeading(double headingDegrees) {
  if (!headingDegrees.isFinite) {
    throw ArgumentError.value(
      headingDegrees,
      'headingDegrees',
      'must be finite',
    );
  }
  return normalizeDegrees(headingDegrees);
}

enum SensorDeviceErrorCode {
  disposed,

  /// The active run ended because the sensor source was interrupted.
  interrupted,
  permissionDenied,
  permissionRestricted,
  startFailed,

  /// A recoverable event-stream error; the active run may continue.
  streamFailed,
  unavailable,
}

final class SensorDeviceException implements Exception {
  const SensorDeviceException({
    required this.code,
    required this.message,
    this.cause,
  });

  final Object? cause;
  final SensorDeviceErrorCode code;
  final String message;

  @override
  String toString() => 'SensorDeviceException($code): $message';
}
