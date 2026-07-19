import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/sensors/sensors.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';

void main() {
  group('SensorAvailability', () {
    for (final motion in SensorCapabilityStatus.values) {
      for (final heading in SensorCapabilityStatus.values) {
        test('reports $motion motion and $heading heading independently', () {
          final availability = SensorAvailability(
            heading: heading,
            motion: motion,
          );

          expect(
            availability.isMotionAvailable,
            motion == SensorCapabilityStatus.available,
          );
          expect(
            availability.isHeadingAvailable,
            heading == SensorCapabilityStatus.available,
          );
        });
      }
    }
  });

  test('permission model exposes every application state', () {
    expect(
      SensorPermissionStatus.values,
      containsAllInOrder([
        SensorPermissionStatus.notDetermined,
        SensorPermissionStatus.granted,
        SensorPermissionStatus.denied,
        SensorPermissionStatus.restricted,
      ]),
    );
  });

  test('motion event normalizes a finite fallback heading', () {
    const acceleration = MotionVector(x: 1, y: 2, z: 3);

    final event = MotionSensorEvent(
      accelerationMetersPerSecondSquared: acceleration,
      fallbackHeadingDegrees: -1,
      receivedAtMs: 123,
    );

    expect(event.accelerationMetersPerSecondSquared, same(acceleration));
    expect(event.fallbackHeadingDegrees, 359);
    expect(event.receivedAtMs, 123);
  });

  test('motion event accepts non-finite acceleration for JS parity', () {
    final event = MotionSensorEvent(
      accelerationMetersPerSecondSquared: const MotionVector(
        x: double.nan,
        y: double.infinity,
        z: double.negativeInfinity,
      ),
      fallbackHeadingDegrees: null,
      receivedAtMs: 1,
    );

    expect(event.accelerationMetersPerSecondSquared.x.isNaN, isTrue);
    expect(event.accelerationMetersPerSecondSquared.y, double.infinity);
    expect(event.accelerationMetersPerSecondSquared.z, double.negativeInfinity);
  });

  test('heading event normalizes degrees and preserves source', () {
    final event = HeadingSensorEvent(
      headingDegrees: 721,
      receivedAtMs: 456,
      source: SensorHeadingSource.magnetometer,
    );

    expect(event.headingDegrees, 1);
    expect(event.receivedAtMs, 456);
    expect(event.source, SensorHeadingSource.magnetometer);
  });

  test('events reject non-finite heading values', () {
    expect(
      () => HeadingSensorEvent(
        headingDegrees: double.nan,
        receivedAtMs: 0,
        source: SensorHeadingSource.deviceMotionFallback,
      ),
      throwsArgumentError,
    );
    expect(
      () => MotionSensorEvent(
        accelerationMetersPerSecondSquared: const MotionVector(
          x: 0,
          y: 0,
          z: 0,
        ),
        fallbackHeadingDegrees: double.infinity,
        receivedAtMs: 0,
      ),
      throwsArgumentError,
    );
  });

  test('sampling request rejects non-positive intervals', () {
    expect(
      () => SensorSamplingRequest(
        headingUpdateIntervalMs: 0,
        motionUpdateIntervalMs: 16,
      ),
      throwsArgumentError,
    );
    expect(
      () => SensorSamplingRequest(
        headingUpdateIntervalMs: 100,
        motionUpdateIntervalMs: -1,
      ),
      throwsArgumentError,
    );
  });

  test('typed device exception exposes stable code, message, and cause', () {
    final cause = StateError('native failure');
    final error = SensorDeviceException(
      cause: cause,
      code: SensorDeviceErrorCode.startFailed,
      message: 'Unable to start sensors.',
    );

    expect(error.code, SensorDeviceErrorCode.startFailed);
    expect(error.message, 'Unable to start sensors.');
    expect(error.cause, same(cause));
    expect(error.toString(), contains('startFailed'));
  });
}
