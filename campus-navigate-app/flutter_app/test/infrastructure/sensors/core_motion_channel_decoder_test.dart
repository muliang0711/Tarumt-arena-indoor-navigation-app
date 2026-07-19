import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/sensors/sensor_models.dart';
import 'package:indoor_navigation/infrastructure/sensors/core_motion_channel_contract.dart';
import 'package:indoor_navigation/infrastructure/sensors/core_motion_channel_decoder.dart';

void main() {
  group('availability', () {
    for (final motionAvailable in <bool>[false, true]) {
      for (final headingAvailable in <bool>[false, true]) {
        test('decodes motion=$motionAvailable heading=$headingAvailable', () {
          final result = CoreMotionChannelDecoder.decodeAvailability({
            'schemaVersion': CoreMotionChannelContract.schemaVersion,
            'motionAvailable': motionAvailable,
            'headingAvailable': headingAvailable,
          });

          expect(result.isMotionAvailable, motionAvailable);
          expect(result.isHeadingAvailable, headingAvailable);
        });
      }
    }

    test('rejects malformed, unknown-schema, and extra fields', () {
      for (final raw in <Object?>[
        null,
        <String, Object?>{
          'schemaVersion': 2,
          'motionAvailable': true,
          'headingAvailable': true,
        },
        <String, Object?>{
          'schemaVersion': 1,
          'motionAvailable': 1,
          'headingAvailable': true,
        },
        <String, Object?>{
          'schemaVersion': 1,
          'motionAvailable': true,
          'headingAvailable': true,
          'unexpected': true,
        },
      ]) {
        expect(
          () => CoreMotionChannelDecoder.decodeAvailability(raw),
          throwsFormatException,
        );
      }
    });
  });

  test('decodes every permission status', () {
    const expected = <String, SensorPermissionStatus>{
      'notDetermined': SensorPermissionStatus.notDetermined,
      'granted': SensorPermissionStatus.granted,
      'denied': SensorPermissionStatus.denied,
      'restricted': SensorPermissionStatus.restricted,
    };

    for (final entry in expected.entries) {
      expect(
        CoreMotionChannelDecoder.decodePermission({
          'schemaVersion': 1,
          'status': entry.key,
        }),
        entry.value,
      );
    }
  });

  test('rejects unknown permission and malformed control response', () {
    expect(
      () => CoreMotionChannelDecoder.decodePermission({
        'schemaVersion': 1,
        'status': 'provisional',
      }),
      throwsFormatException,
    );
    expect(
      () => CoreMotionChannelDecoder.expectControlResponse(null, 'start'),
      throwsFormatException,
    );
    expect(
      () => CoreMotionChannelDecoder.expectControlResponse(<String, Object?>{
        'schemaVersion': 2,
      }, 'start'),
      throwsFormatException,
    );
    expect(
      () => CoreMotionChannelDecoder.expectControlResponse(<String, Object?>{
        'schemaVersion': 1,
        'extra': true,
      }, 'start'),
      throwsFormatException,
    );
    expect(
      () => CoreMotionChannelDecoder.expectControlResponse(<String, Object?>{
        'schemaVersion': 1,
      }, 'start'),
      returnsNormally,
    );
  });

  test('decodes and normalizes motion and heading events', () {
    final motion =
        CoreMotionChannelDecoder.decodeEvent(
              _motionEvent(generation: 7, fallbackHeadingDegrees: -1),
              receivedAtMs: 100,
            )
            as CoreMotionDecodedSensorEvent;
    final heading =
        CoreMotionChannelDecoder.decodeEvent(
              _headingEvent(generation: 7, headingDegrees: 721),
              receivedAtMs: 101,
            )
            as CoreMotionDecodedSensorEvent;

    final motionEvent = motion.event as MotionSensorEvent;
    final headingEvent = heading.event as HeadingSensorEvent;
    expect(motion.generation, 7);
    expect(motionEvent.accelerationMetersPerSecondSquared.x, 1);
    expect(motionEvent.fallbackHeadingDegrees, 359);
    expect(motionEvent.receivedAtMs, 100);
    expect(headingEvent.headingDegrees, 1);
    expect(headingEvent.source, SensorHeadingSource.magnetometer);
    expect(headingEvent.receivedAtMs, 101);
  });

  test('decodes both typed error events and nullable native code', () {
    final recoverable =
        CoreMotionChannelDecoder.decodeEvent(
              _errorEvent(
                code: 'streamFailed',
                generation: 1,
                nativeCode: null,
              ),
              receivedAtMs: 0,
            )
            as CoreMotionDecodedErrorEvent;
    final interruptedWithStringCode =
        CoreMotionChannelDecoder.decodeEvent(
              _errorEvent(
                code: 'interrupted',
                generation: 2,
                nativeCode: 'CM-9',
              ),
              receivedAtMs: 0,
            )
            as CoreMotionDecodedErrorEvent;
    final interruptedWithNativeInteger =
        CoreMotionChannelDecoder.decodeEvent(
              _errorEvent(code: 'interrupted', generation: 3, nativeCode: 109),
              receivedAtMs: 0,
            )
            as CoreMotionDecodedErrorEvent;

    expect(recoverable.error.code, SensorDeviceErrorCode.streamFailed);
    expect(recoverable.error.cause, isNull);
    expect(recoverable.interrupted, isFalse);
    expect(
      interruptedWithStringCode.error.code,
      SensorDeviceErrorCode.interrupted,
    );
    expect(interruptedWithStringCode.error.cause, 'CM-9');
    expect(interruptedWithStringCode.interrupted, isTrue);
    expect(interruptedWithNativeInteger.error.cause, 109);
    expect(interruptedWithNativeInteger.interrupted, isTrue);
  });

  test('rejects malformed event kinds, fields, sources, and headings', () {
    for (final raw in <Object?>[
      <String, Object?>{'schemaVersion': 1, 'kind': 'unknown'},
      _motionEvent(generation: 1)..['accelerationX'] = '1',
      _motionEvent(generation: 1)..['fallbackHeadingDegrees'] = double.nan,
      _headingEvent(generation: 1, headingDegrees: double.infinity),
      _headingEvent(generation: 1, headingDegrees: 1)..['source'] = 'gps',
      _headingEvent(generation: 1, headingDegrees: 1)..['extra'] = true,
      _errorEvent(code: 'fatal', generation: 1, nativeCode: null),
      _errorEvent(code: 'streamFailed', generation: 1, nativeCode: 4.5),
      _errorEvent(code: 'streamFailed', generation: 1, nativeCode: true),
    ]) {
      expect(
        () => CoreMotionChannelDecoder.decodeEvent(raw, receivedAtMs: 0),
        throwsFormatException,
      );
    }
  });
}

Map<String, Object?> _motionEvent({
  required int generation,
  double? fallbackHeadingDegrees = 0,
}) {
  return <String, Object?>{
    'schemaVersion': 1,
    'kind': 'motion',
    'generation': generation,
    'accelerationX': 1,
    'accelerationY': 2.5,
    'accelerationZ': -3,
    'fallbackHeadingDegrees': fallbackHeadingDegrees,
  };
}

Map<String, Object?> _headingEvent({
  required int generation,
  required double headingDegrees,
}) {
  return <String, Object?>{
    'schemaVersion': 1,
    'kind': 'heading',
    'generation': generation,
    'headingDegrees': headingDegrees,
    'source': 'magnetometer',
  };
}

Map<String, Object?> _errorEvent({
  required String code,
  required int generation,
  required Object? nativeCode,
}) {
  return <String, Object?>{
    'schemaVersion': 1,
    'kind': 'error',
    'generation': generation,
    'code': code,
    'message': 'native message',
    'nativeCode': nativeCode,
  };
}
