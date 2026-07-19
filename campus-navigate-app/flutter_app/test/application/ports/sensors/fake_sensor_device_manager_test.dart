import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/sensors/sensors.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';

import '../../../parity/phase2_fixture.dart';
import '../../../support/fakes/fake_sensor_device_manager.dart';

final _request = SensorSamplingRequest(
  headingUpdateIntervalMs: 100,
  motionUpdateIntervalMs: 16,
);

void main() {
  test('availability and every permission branch are configurable', () async {
    for (final permission in SensorPermissionStatus.values) {
      final manager = FakeSensorDeviceManager(
        availability: const SensorAvailability(
          heading: SensorCapabilityStatus.unavailable,
          motion: SensorCapabilityStatus.available,
        ),
        permissionStatus: permission,
      );

      final availability = await manager.checkAvailability();
      expect(availability.isMotionAvailable, isTrue);
      expect(availability.isHeadingAvailable, isFalse);
      expect(await manager.requestPermissions(), permission);
      expect(manager.availabilityCheckCount, 1);
      expect(manager.permissionRequestCount, 1);
      await manager.dispose();
    }
  });

  test('start captures the exact request and surfaces typed failure', () async {
    const failure = SensorDeviceException(
      code: SensorDeviceErrorCode.startFailed,
      message: 'Expected failure.',
    );
    final manager = FakeSensorDeviceManager(startFailure: failure);

    await expectLater(manager.start(_request), throwsA(same(failure)));
    expect(manager.lastStartRequest, same(_request));
    expect(manager.startCallCount, 1);
    expect(manager.isRunning, isFalse);

    manager.startFailure = null;
    await manager.start(_request);
    expect(manager.isRunning, isTrue);
    await manager.dispose();
  });

  test('manual replay is asynchronous FIFO across event types', () async {
    final manager = FakeSensorDeviceManager();
    final received = <NormalizedSensorEvent>[];
    final subscription = manager.events.listen(received.add);
    final events = <NormalizedSensorEvent>[
      _motion(timestampMs: 300, x: 1),
      HeadingSensorEvent(
        headingDegrees: 45,
        receivedAtMs: 200,
        source: SensorHeadingSource.magnetometer,
      ),
      _motion(timestampMs: 100, x: 2),
    ];

    await manager.start(_request);
    expect(manager.replay(events), 3);
    expect(received, isEmpty, reason: 'Delivery must not be synchronous.');
    await _flushAsyncDelivery();

    expect(received, orderedEquals(events));
    expect(received.map((event) => event.receivedAtMs), [300, 200, 100]);
    expect(manager.pendingDeliveryCount, 0);
    await manager.dispose();
    await subscription.cancel();
  });

  test(
    'script is one-shot and restart discards pending old-run events',
    () async {
      final scripted = _motion(timestampMs: 1, x: 1);
      final stale = _motion(timestampMs: 2, x: 2);
      final fresh = _motion(timestampMs: 3, x: 3);
      final manager = FakeSensorDeviceManager(scriptedEvents: [scripted]);
      final received = <NormalizedSensorEvent>[];
      final subscription = manager.events.listen(received.add);

      await manager.start(_request);
      expect(manager.pendingScriptedEventCount, 0);
      expect(manager.emit(stale), isTrue);
      await manager.start(_request);
      expect(manager.stopCallCount, 1);
      expect(manager.emit(fresh), isTrue);
      await _flushAsyncDelivery();

      expect(received, [scripted, fresh]);
      expect(manager.startCallCount, 2);
      await manager.dispose();
      await subscription.cancel();
    },
  );

  test('stop and dispose suppress pending and future events', () async {
    final manager = FakeSensorDeviceManager();
    final received = <NormalizedSensorEvent>[];
    final subscription = manager.events.listen(received.add);

    await manager.start(_request);
    expect(manager.emit(_motion(timestampMs: 1, x: 1)), isTrue);
    await manager.stop();
    expect(manager.emit(_motion(timestampMs: 2, x: 2)), isFalse);
    await _flushAsyncDelivery();
    expect(received, isEmpty);

    await manager.start(_request);
    expect(manager.emit(_motion(timestampMs: 3, x: 3)), isTrue);
    await manager.dispose();
    expect(manager.emit(_motion(timestampMs: 4, x: 4)), isFalse);
    await _flushAsyncDelivery();
    expect(received, isEmpty);
    expect(manager.disposeCallCount, 1);
    await manager.dispose();
    expect(manager.disposeCallCount, 1);
    await subscription.cancel();
  });

  test('recoverable stream error preserves FIFO and active run', () async {
    final manager = FakeSensorDeviceManager();
    final received = <Object>[];
    final subscription = manager.events.listen(
      received.add,
      onError: received.add,
    );
    const error = SensorDeviceException(
      code: SensorDeviceErrorCode.streamFailed,
      message: 'Bad packet.',
    );
    final before = _motion(timestampMs: 1, x: 1);
    final after = _motion(timestampMs: 2, x: 2);

    await manager.start(_request);
    manager.emit(before);
    manager.emitStreamError(error);
    manager.emit(after);
    await _flushAsyncDelivery();

    expect(received, [before, error, after]);
    expect(manager.isRunning, isTrue);
    await manager.dispose();
    await subscription.cancel();
  });

  test('interruption stops the run and reports a typed error', () async {
    final manager = FakeSensorDeviceManager();
    final errors = <Object>[];
    final subscription = manager.events.listen((_) {}, onError: errors.add);

    await manager.start(_request);
    expect(manager.interrupt(), isTrue);
    expect(manager.isRunning, isFalse);
    expect(manager.emit(_motion(timestampMs: 2, x: 2)), isFalse);
    await _flushAsyncDelivery();

    expect(errors, hasLength(1));
    expect(
      (errors.single as SensorDeviceException).code,
      SensorDeviceErrorCode.interrupted,
    );
    expect(manager.interruptionCount, 1);
    expect(manager.interrupt(), isFalse);
    await manager.dispose();
    await subscription.cancel();
  });

  test(
    'immediate restart after interruption drains only the new run',
    () async {
      final manager = FakeSensorDeviceManager();
      final received = <NormalizedSensorEvent>[];
      final errors = <Object>[];
      final subscription = manager.events.listen(
        received.add,
        onError: errors.add,
      );
      final stale = _motion(timestampMs: 1, x: 1);
      final fresh = _motion(timestampMs: 2, x: 2);

      await manager.start(_request);
      expect(manager.emit(stale), isTrue);
      expect(manager.interrupt(), isTrue);
      manager.enqueueScript(<NormalizedSensorEvent>[fresh]);
      await manager.start(_request);
      await _flushAsyncDelivery();

      expect(received, <NormalizedSensorEvent>[fresh]);
      expect(errors, isEmpty);
      expect(manager.pendingDeliveryCount, 0);
      await manager.dispose();
      await subscription.cancel();
    },
  );

  test(
    'disposed manager rejects stateful operations with typed error',
    () async {
      final manager = FakeSensorDeviceManager();
      await manager.dispose();

      for (final operation in <Future<Object?> Function()>[
        manager.checkAvailability,
        manager.requestPermissions,
        () => manager.start(_request),
      ]) {
        await expectLater(
          operation(),
          throwsA(
            isA<SensorDeviceException>().having(
              (error) => error.code,
              'code',
              SensorDeviceErrorCode.disposed,
            ),
          ),
        );
      }
      expect(
        () => manager.enqueueScript([_motion(timestampMs: 1, x: 1)]),
        throwsA(
          isA<SensorDeviceException>().having(
            (error) => error.code,
            'code',
            SensorDeviceErrorCode.disposed,
          ),
        ),
      );
    },
  );

  test('all Phase 2 sample timelines replay losslessly without PDR', () async {
    final fixture = loadPhase2Fixture();
    expect(fixture.pdrCases, hasLength(14));
    final sourceSamples = fixture.pdrCases
        .expand((parityCase) => parityCase.samples)
        .toList(growable: false);
    final events = sourceSamples
        .map(
          (sample) => MotionSensorEvent(
            accelerationMetersPerSecondSquared: sample.acceleration,
            fallbackHeadingDegrees: sample.headingDegrees,
            receivedAtMs: sample.timestampMs,
          ),
        )
        .toList(growable: false);
    final manager = FakeSensorDeviceManager(scriptedEvents: events);
    final received = <MotionSensorEvent>[];
    final subscription = manager.events.listen(
      (event) => received.add(event as MotionSensorEvent),
    );

    await manager.start(_request);
    await _flushAsyncDelivery();

    expect(received, hasLength(sourceSamples.length));
    for (var index = 0; index < sourceSamples.length; index += 1) {
      final expected = sourceSamples[index];
      final actual = received[index];
      expect(actual.receivedAtMs, expected.timestampMs);
      expect(actual.fallbackHeadingDegrees, expected.headingDegrees);
      _expectSameNumber(
        actual.accelerationMetersPerSecondSquared.x,
        expected.acceleration.x,
      );
      _expectSameNumber(
        actual.accelerationMetersPerSecondSquared.y,
        expected.acceleration.y,
      );
      _expectSameNumber(
        actual.accelerationMetersPerSecondSquared.z,
        expected.acceleration.z,
      );
    }
    expect(manager.pendingDeliveryCount, 0);
    await manager.dispose();
    await subscription.cancel();
  });
}

MotionSensorEvent _motion({required int timestampMs, required double x}) {
  return MotionSensorEvent(
    accelerationMetersPerSecondSquared: MotionVector(x: x, y: 0, z: 0),
    fallbackHeadingDegrees: 0,
    receivedAtMs: timestampMs,
  );
}

Future<void> _flushAsyncDelivery() async {
  await Future<void>.delayed(Duration.zero);
}

void _expectSameNumber(double actual, double expected) {
  if (expected.isNaN) {
    expect(actual.isNaN, isTrue);
    return;
  }
  expect(actual, expected);
}
