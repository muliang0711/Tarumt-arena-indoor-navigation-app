import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/sensors/sensor_models.dart';
import 'package:indoor_navigation/infrastructure/sensors/core_motion_channel_client.dart';
import 'package:indoor_navigation/infrastructure/sensors/core_motion_channel_contract.dart';
import 'package:indoor_navigation/infrastructure/sensors/core_motion_sensor_device_manager.dart';

import '../../support/fakes/fake_clock.dart';
import 'fake_core_motion_channel_client.dart';

final _request = SensorSamplingRequest(
  headingUpdateIntervalMs: 50,
  motionUpdateIntervalMs: 30,
);

void main() {
  test(
    'uses exact methods and decodes availability and all permissions',
    () async {
      final client = FakeCoreMotionChannelClient()
        ..enqueueResult('checkAvailability', <String, Object?>{
          'schemaVersion': 1,
          'motionAvailable': true,
          'headingAvailable': false,
        });
      for (final status in <String>[
        'notDetermined',
        'granted',
        'denied',
        'restricted',
      ]) {
        client.enqueueResult('requestPermissions', <String, Object?>{
          'schemaVersion': 1,
          'status': status,
        });
      }
      final manager = _manager(client);

      final availability = await manager.checkAvailability();
      expect(availability.isMotionAvailable, isTrue);
      expect(availability.isHeadingAvailable, isFalse);
      expect([
        for (var index = 0; index < 4; index += 1)
          await manager.requestPermissions(),
      ], SensorPermissionStatus.values);
      expect(
        client.invocations.map((invocation) => invocation.method),
        <String>[
          CoreMotionChannelContract.checkAvailabilityMethod,
          CoreMotionChannelContract.requestPermissionsMethod,
          CoreMotionChannelContract.requestPermissionsMethod,
          CoreMotionChannelContract.requestPermissionsMethod,
          CoreMotionChannelContract.requestPermissionsMethod,
        ],
      );
      expect(
        client.invocations.every((invocation) => invocation.arguments == null),
        isTrue,
      );
      await manager.dispose();
      await client.closeEvents();
    },
  );

  test(
    'sends exact versioned start, replacement, stop, and dispose arguments',
    () async {
      final client = FakeCoreMotionChannelClient();
      final manager = _manager(client);

      await manager.start(_request);
      await manager.start(_request);
      await manager.stop();
      await manager.stop();
      await manager.dispose();
      await manager.dispose();

      expect(
        client.invocations.map((invocation) => invocation.method),
        <String>['start', 'stop', 'start', 'stop', 'dispose'],
      );
      expect(client.invocations[0].arguments, <String, Object?>{
        'schemaVersion': 1,
        'generation': 1,
        'motionUpdateIntervalMs': 30,
        'headingUpdateIntervalMs': 50,
      });
      expect(client.invocations[1].arguments, <String, Object?>{
        'schemaVersion': 1,
        'generation': 1,
      });
      expect(client.invocations[2].arguments, <String, Object?>{
        'schemaVersion': 1,
        'generation': 2,
        'motionUpdateIntervalMs': 30,
        'headingUpdateIntervalMs': 50,
      });
      expect(client.invocations[3].arguments, <String, Object?>{
        'schemaVersion': 1,
        'generation': 2,
      });
      expect(client.invocations[4].arguments, <String, Object?>{
        'schemaVersion': 1,
        'generation': 2,
      });
      await client.closeEvents();
    },
  );

  test(
    'delivers mixed motion, errors, and heading FIFO with receipt time',
    () async {
      final client = FakeCoreMotionChannelClient();
      final clock = FakeClock(initialNowMs: 100);
      final manager = _manager(client, clock: clock);
      final received = <Object>[];
      final subscription = manager.events.listen(
        received.add,
        onError: received.add,
      );

      await manager.start(_request);
      client.emit(_motion(generation: 1, fallbackHeadingDegrees: -1));
      clock.advanceToMs(101);
      client.emit(_error(code: 'streamFailed', generation: 1));
      clock.advanceToMs(102);
      client.emit(_heading(generation: 1, degrees: 721));
      await _flush();

      expect(received, hasLength(3));
      final motion = received[0] as MotionSensorEvent;
      final error = received[1] as SensorDeviceException;
      final heading = received[2] as HeadingSensorEvent;
      expect(motion.receivedAtMs, 100);
      expect(motion.fallbackHeadingDegrees, 359);
      expect(error.code, SensorDeviceErrorCode.streamFailed);
      expect(heading.receivedAtMs, 102);
      expect(heading.headingDegrees, 1);
      expect(heading.source, SensorHeadingSource.magnetometer);

      client.emit(_motion(generation: 1));
      await _flush();
      expect(received, hasLength(4), reason: 'streamFailed is recoverable');
      await manager.dispose();
      await subscription.cancel();
      await client.closeEvents();
    },
  );

  test(
    'suppresses stale generations and pending data on stop and dispose',
    () async {
      final client = FakeCoreMotionChannelClient();
      final manager = _manager(client);
      final received = <NormalizedSensorEvent>[];
      final subscription = manager.events.listen(received.add);

      await manager.start(_request);
      client.emit(_motion(generation: 0));
      client.emit(_motion(generation: 1));
      await manager.stop();
      await _flush();
      expect(received, isEmpty);

      await manager.start(_request);
      client.emit(_motion(generation: 2));
      await manager.dispose();
      await _flush();
      expect(received, isEmpty);
      await subscription.cancel();
      await client.closeEvents();
    },
  );

  test(
    'interruption ends a run and immediate restart suppresses old deliveries',
    () async {
      final client = FakeCoreMotionChannelClient();
      final manager = _manager(client);
      final received = <Object>[];
      final subscription = manager.events.listen(
        received.add,
        onError: received.add,
      );

      await manager.start(_request);
      client.emit(_motion(generation: 1));
      client.emit(_error(code: 'interrupted', generation: 1));
      client.emit(_motion(generation: 1));
      await manager.start(_request);
      client.emit(_heading(generation: 2, degrees: 45));
      await _flush();

      expect(received, hasLength(1));
      expect((received.single as HeadingSensorEvent).headingDegrees, 45);
      expect(
        client.invocations.map((invocation) => invocation.method),
        <String>['start', 'start'],
        reason: 'an interrupted run is already stopped natively',
      );
      await manager.dispose();
      await subscription.cancel();
      await client.closeEvents();
    },
  );

  test('delivers an interruption when no restart supersedes it', () async {
    final client = FakeCoreMotionChannelClient();
    final manager = _manager(client);
    final received = <Object>[];
    final subscription = manager.events.listen(
      received.add,
      onError: received.add,
    );

    await manager.start(_request);
    client.emit(_error(code: 'interrupted', generation: 1, nativeCode: 109));
    client.emit(_motion(generation: 1));
    await _flush();

    expect(received, hasLength(1));
    final interruption = received.single as SensorDeviceException;
    expect(interruption.code, SensorDeviceErrorCode.interrupted);
    expect(interruption.cause, 109);
    await manager.stop();
    expect(client.invocations.where((call) => call.method == 'stop'), isEmpty);
    await manager.dispose();
    await subscription.cancel();
    await client.closeEvents();
  });

  test(
    'maps malformed packets and transport errors to typed stream failures',
    () async {
      final client = FakeCoreMotionChannelClient();
      final manager = _manager(client);
      final received = <Object>[];
      final subscription = manager.events.listen(
        received.add,
        onError: received.add,
      );

      await manager.start(_request);
      client.emit(<String, Object?>{
        'schemaVersion': 99,
        'kind': 'motion',
        'generation': 1,
      });
      client.emit(<String, Object?>{
        'schemaVersion': 1,
        'kind': 'mystery',
        'generation': 1,
      });
      client.emit(_heading(generation: 1, degrees: double.nan));
      client.emitError(StateError('transport down'));
      await _flush();

      expect(received, hasLength(4));
      for (final value in received) {
        expect(value, isA<SensorDeviceException>());
        expect(
          (value as SensorDeviceException).code,
          SensorDeviceErrorCode.streamFailed,
        );
      }
      client.emit(_motion(generation: 1));
      await _flush();
      expect(received.last, isA<MotionSensorEvent>());
      await manager.dispose();
      await subscription.cancel();
      await client.closeEvents();
    },
  );

  test('typed transport interruption ends the active run', () async {
    final client = FakeCoreMotionChannelClient();
    final manager = _manager(client);
    final errors = <Object>[];
    final subscription = manager.events.listen((_) {}, onError: errors.add);

    await manager.start(_request);
    client.emitError(
      const CoreMotionChannelFailure(
        code: 'interrupted',
        message: 'system interruption',
      ),
    );
    client.emit(_motion(generation: 1));
    await _flush();

    expect(errors, hasLength(1));
    expect(
      (errors.single as SensorDeviceException).code,
      SensorDeviceErrorCode.interrupted,
    );
    await manager.start(_request);
    expect(client.invocations.where((call) => call.method == 'stop'), isEmpty);
    await manager.dispose();
    await subscription.cancel();
    await client.closeEvents();
  });

  test('maps method transport and codec failures by operation', () async {
    final availabilityClient = FakeCoreMotionChannelClient()
      ..enqueueFailure('checkAvailability', StateError('offline'));
    final availabilityManager = _manager(availabilityClient);
    await _expectDeviceFailure(
      availabilityManager.checkAvailability(),
      SensorDeviceErrorCode.unavailable,
    );
    await availabilityManager.dispose();
    await availabilityClient.closeEvents();

    final permissionClient = FakeCoreMotionChannelClient()
      ..enqueueResult('requestPermissions', <String, Object?>{
        'schemaVersion': 1,
        'status': 'unknown',
      });
    final permissionManager = _manager(permissionClient);
    await _expectDeviceFailure(
      permissionManager.requestPermissions(),
      SensorDeviceErrorCode.permissionDenied,
    );
    await permissionManager.dispose();
    await permissionClient.closeEvents();

    final startClient = FakeCoreMotionChannelClient()
      ..enqueueFailure(
        'start',
        const CoreMotionChannelFailure(
          code: 'startFailed',
          message: 'native start failed',
        ),
      );
    final startManager = _manager(startClient);
    await _expectDeviceFailure(
      startManager.start(_request),
      SensorDeviceErrorCode.startFailed,
    );
    await startManager.dispose();
    await startClient.closeEvents();

    final pendingPermissionClient = FakeCoreMotionChannelClient()
      ..enqueueFailure(
        'start',
        const CoreMotionChannelFailure(
          code: 'permissionNotDetermined',
          message: 'permission has not been requested',
        ),
      );
    final pendingPermissionManager = _manager(pendingPermissionClient);
    await _expectDeviceFailure(
      pendingPermissionManager.start(_request),
      SensorDeviceErrorCode.permissionDenied,
    );
    await pendingPermissionManager.dispose();
    await pendingPermissionClient.closeEvents();
  });

  test(
    'stop and dispose failures remain typed and terminal cleanup completes',
    () async {
      final stopClient = FakeCoreMotionChannelClient()
        ..enqueueResult('start', <String, Object?>{'schemaVersion': 1})
        ..enqueueFailure('stop', StateError('stop failed'));
      final stopManager = _manager(stopClient);
      await stopManager.start(_request);
      await _expectDeviceFailure(
        stopManager.stop(),
        SensorDeviceErrorCode.streamFailed,
      );
      await stopManager.dispose();
      await stopClient.closeEvents();

      final disposeClient = FakeCoreMotionChannelClient()
        ..enqueueFailure('dispose', StateError('dispose failed'));
      final disposeManager = _manager(disposeClient);
      final done = expectLater(disposeManager.events, emitsDone);
      await _expectDeviceFailure(
        disposeManager.dispose(),
        SensorDeviceErrorCode.streamFailed,
      );
      await done;
      await disposeManager.dispose();
      await disposeClient.closeEvents();
    },
  );

  test(
    'event stream is truly single-subscription and closes only on dispose',
    () async {
      final client = FakeCoreMotionChannelClient();
      final manager = _manager(client);
      var isDone = false;
      final subscription = manager.events.listen(
        (_) {},
        onDone: () => isDone = true,
      );

      expect(() => manager.events.listen((_) {}), throwsStateError);
      await manager.start(_request);
      await manager.stop();
      await _flush();
      expect(isDone, isFalse);
      await manager.dispose();
      expect(isDone, isTrue);
      await subscription.cancel();
      await client.closeEvents();
    },
  );

  test(
    'disposed operations fail with disposed while dispose stays idempotent',
    () async {
      final client = FakeCoreMotionChannelClient();
      final manager = _manager(client);
      await manager.dispose();

      await _expectDeviceFailure(
        manager.checkAvailability(),
        SensorDeviceErrorCode.disposed,
      );
      await _expectDeviceFailure(
        manager.requestPermissions(),
        SensorDeviceErrorCode.disposed,
      );
      await _expectDeviceFailure(
        manager.start(_request),
        SensorDeviceErrorCode.disposed,
      );
      await _expectDeviceFailure(
        manager.stop(),
        SensorDeviceErrorCode.disposed,
      );
      await manager.dispose();
      expect(
        client.invocations.where((call) => call.method == 'dispose'),
        hasLength(1),
      );
      await client.closeEvents();
    },
  );
}

CoreMotionSensorDeviceManager _manager(
  FakeCoreMotionChannelClient client, {
  FakeClock? clock,
}) {
  return CoreMotionSensorDeviceManager.withClient(
    clock: clock ?? FakeClock(initialNowMs: 1),
    client: client,
  );
}

Map<String, Object?> _motion({
  required int generation,
  double? fallbackHeadingDegrees = 0,
}) {
  return <String, Object?>{
    'schemaVersion': 1,
    'kind': 'motion',
    'generation': generation,
    'accelerationX': 1,
    'accelerationY': 2,
    'accelerationZ': 3,
    'fallbackHeadingDegrees': fallbackHeadingDegrees,
  };
}

Map<String, Object?> _heading({
  required double degrees,
  required int generation,
}) {
  return <String, Object?>{
    'schemaVersion': 1,
    'kind': 'heading',
    'generation': generation,
    'headingDegrees': degrees,
    'source': 'magnetometer',
  };
}

Map<String, Object?> _error({
  required String code,
  required int generation,
  Object? nativeCode,
}) {
  return <String, Object?>{
    'schemaVersion': 1,
    'kind': 'error',
    'generation': generation,
    'code': code,
    'message': code,
    'nativeCode': nativeCode,
  };
}

Future<void> _flush() async {
  await Future<void>.delayed(Duration.zero);
}

Future<void> _expectDeviceFailure(
  Future<Object?> future,
  SensorDeviceErrorCode code,
) async {
  await expectLater(
    future,
    throwsA(
      isA<SensorDeviceException>().having((error) => error.code, 'code', code),
    ),
  );
}
