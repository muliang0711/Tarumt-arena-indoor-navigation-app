import 'package:indoor_navigation/application/ports/sensors/sensor_models.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';
import 'package:indoor_navigation/infrastructure/sensors/core_motion_channel_contract.dart';

sealed class CoreMotionDecodedEvent {
  const CoreMotionDecodedEvent({required this.generation});

  final int generation;
}

final class CoreMotionDecodedSensorEvent extends CoreMotionDecodedEvent {
  const CoreMotionDecodedSensorEvent({
    required this.event,
    required super.generation,
  });

  final NormalizedSensorEvent event;
}

final class CoreMotionDecodedErrorEvent extends CoreMotionDecodedEvent {
  const CoreMotionDecodedErrorEvent({
    required this.error,
    required super.generation,
    required this.interrupted,
  });

  final SensorDeviceException error;
  final bool interrupted;
}

abstract final class CoreMotionChannelDecoder {
  static SensorAvailability decodeAvailability(Object? raw) {
    final map = _wireMap(raw, 'availability');
    _expectKeys(map, const {
      'schemaVersion',
      'motionAvailable',
      'headingAvailable',
    });
    _expectSchemaVersion(map);
    return SensorAvailability(
      heading: _bool(map, 'headingAvailable')
          ? SensorCapabilityStatus.available
          : SensorCapabilityStatus.unavailable,
      motion: _bool(map, 'motionAvailable')
          ? SensorCapabilityStatus.available
          : SensorCapabilityStatus.unavailable,
    );
  }

  static SensorPermissionStatus decodePermission(Object? raw) {
    final map = _wireMap(raw, 'permission');
    _expectKeys(map, const {'schemaVersion', 'status'});
    _expectSchemaVersion(map);
    final status = _string(map, 'status');
    return switch (status) {
      'notDetermined' => SensorPermissionStatus.notDetermined,
      'granted' => SensorPermissionStatus.granted,
      'denied' => SensorPermissionStatus.denied,
      'restricted' => SensorPermissionStatus.restricted,
      _ => throw FormatException(
        'Unknown Core Motion permission status: $status',
      ),
    };
  }

  static void expectControlResponse(Object? raw, String operation) {
    final map = _wireMap(raw, '$operation response');
    _expectKeys(map, const {'schemaVersion'});
    _expectSchemaVersion(map);
  }

  static CoreMotionDecodedEvent decodeEvent(
    Object? raw, {
    required int receivedAtMs,
  }) {
    final map = _wireMap(raw, 'event');
    _expectSchemaVersion(map);
    final kind = _string(map, 'kind');
    return switch (kind) {
      CoreMotionChannelContract.motionEventKind => _decodeMotion(
        map,
        receivedAtMs,
      ),
      CoreMotionChannelContract.headingEventKind => _decodeHeading(
        map,
        receivedAtMs,
      ),
      CoreMotionChannelContract.errorEventKind => _decodeError(map),
      _ => throw FormatException('Unknown Core Motion event kind: $kind'),
    };
  }

  static CoreMotionDecodedSensorEvent _decodeMotion(
    Map<String, Object?> map,
    int receivedAtMs,
  ) {
    _expectKeys(map, const {
      'schemaVersion',
      'kind',
      'generation',
      'accelerationX',
      'accelerationY',
      'accelerationZ',
      'fallbackHeadingDegrees',
    });
    final fallbackHeading = _nullableDouble(map, 'fallbackHeadingDegrees');
    _expectFinite(fallbackHeading, 'fallbackHeadingDegrees');
    return CoreMotionDecodedSensorEvent(
      generation: _int(map, 'generation'),
      event: MotionSensorEvent(
        accelerationMetersPerSecondSquared: MotionVector(
          x: _double(map, 'accelerationX'),
          y: _double(map, 'accelerationY'),
          z: _double(map, 'accelerationZ'),
        ),
        fallbackHeadingDegrees: fallbackHeading,
        receivedAtMs: receivedAtMs,
      ),
    );
  }

  static CoreMotionDecodedSensorEvent _decodeHeading(
    Map<String, Object?> map,
    int receivedAtMs,
  ) {
    _expectKeys(map, const {
      'schemaVersion',
      'kind',
      'generation',
      'headingDegrees',
      'source',
    });
    final heading = _double(map, 'headingDegrees');
    _expectFinite(heading, 'headingDegrees');
    final source = switch (_string(map, 'source')) {
      CoreMotionChannelContract.magnetometerHeadingSource =>
        SensorHeadingSource.magnetometer,
      CoreMotionChannelContract.deviceMotionFallbackHeadingSource =>
        SensorHeadingSource.deviceMotionFallback,
      final unknown => throw FormatException(
        'Unknown Core Motion heading source: $unknown',
      ),
    };
    return CoreMotionDecodedSensorEvent(
      generation: _int(map, 'generation'),
      event: HeadingSensorEvent(
        headingDegrees: heading,
        receivedAtMs: receivedAtMs,
        source: source,
      ),
    );
  }

  static CoreMotionDecodedErrorEvent _decodeError(Map<String, Object?> map) {
    _expectKeys(map, const {
      'schemaVersion',
      'kind',
      'generation',
      'code',
      'message',
      'nativeCode',
    });
    final code = _string(map, 'code');
    final errorCode = switch (code) {
      CoreMotionChannelContract.streamFailedErrorCode =>
        SensorDeviceErrorCode.streamFailed,
      CoreMotionChannelContract.interruptedErrorCode =>
        SensorDeviceErrorCode.interrupted,
      _ => throw FormatException('Unknown Core Motion error code: $code'),
    };
    final nativeCode = _nullableNativeCode(map, 'nativeCode');
    return CoreMotionDecodedErrorEvent(
      error: SensorDeviceException(
        cause: nativeCode,
        code: errorCode,
        message: _string(map, 'message'),
      ),
      generation: _int(map, 'generation'),
      interrupted: errorCode == SensorDeviceErrorCode.interrupted,
    );
  }
}

Map<String, Object?> _wireMap(Object? raw, String label) {
  if (raw is! Map<Object?, Object?>) {
    throw FormatException(
      'Core Motion $label must be a map, got ${raw.runtimeType}',
    );
  }
  final result = <String, Object?>{};
  for (final entry in raw.entries) {
    final key = entry.key;
    if (key is! String) {
      throw FormatException('Core Motion $label contains a non-string key');
    }
    result[key] = entry.value;
  }
  return result;
}

void _expectKeys(Map<String, Object?> map, Set<String> expected) {
  final actual = map.keys.toSet();
  if (actual.length != expected.length || !actual.containsAll(expected)) {
    throw FormatException(
      'Unexpected Core Motion fields: expected $expected, got $actual',
    );
  }
}

void _expectSchemaVersion(Map<String, Object?> map) {
  final value = _int(map, 'schemaVersion');
  if (value != CoreMotionChannelContract.schemaVersion) {
    throw FormatException('Unsupported Core Motion schema version: $value');
  }
}

bool _bool(Map<String, Object?> map, String key) {
  final value = map[key];
  if (value is! bool) {
    throw FormatException('$key must be a bool, got ${value.runtimeType}');
  }
  return value;
}

int _int(Map<String, Object?> map, String key) {
  final value = map[key];
  if (value is! int) {
    throw FormatException('$key must be an int, got ${value.runtimeType}');
  }
  return value;
}

double _double(Map<String, Object?> map, String key) {
  final value = map[key];
  if (value is! num) {
    throw FormatException('$key must be a number, got ${value.runtimeType}');
  }
  return value.toDouble();
}

double? _nullableDouble(Map<String, Object?> map, String key) {
  final value = map[key];
  if (value == null) {
    return null;
  }
  if (value is! num) {
    throw FormatException('$key must be a number or null');
  }
  return value.toDouble();
}

String _string(Map<String, Object?> map, String key) {
  final value = map[key];
  if (value is! String) {
    throw FormatException('$key must be a string, got ${value.runtimeType}');
  }
  return value;
}

Object? _nullableNativeCode(Map<String, Object?> map, String key) {
  final value = map[key];
  if (value == null || value is String || value is int) {
    return value;
  }
  throw FormatException('$key must be an int, string, or null');
}

void _expectFinite(double? value, String key) {
  if (value != null && !value.isFinite) {
    throw FormatException('$key must be finite');
  }
}
