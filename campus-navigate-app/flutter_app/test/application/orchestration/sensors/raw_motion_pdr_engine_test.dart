import 'dart:async';
import 'dart:collection';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/sensors/raw_motion_pdr_engine.dart';
import 'package:indoor_navigation/application/orchestration/sensors/raw_motion_pdr_engine_state.dart';
import 'package:indoor_navigation/application/ports/sensors/sensors.dart';
import 'package:indoor_navigation/domain/navigation/derived_navigation_estimate.dart';
import 'package:indoor_navigation/domain/navigation_input/navigation_input_models.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';
import 'package:indoor_navigation/domain/sensor_debug/sensor_debug_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

import '../../../support/fakes/fake_clock.dart';
import '../../../support/fakes/fake_periodic_scheduler.dart';
import '../../../support/fakes/fake_sensor_debug_sink.dart';
import '../../../support/fakes/fake_sensor_device_manager.dart';

const _marker = RedMarkerState(
  headingDegrees: 0,
  screenX: 10,
  screenY: 20,
  tiledX: 30,
  tiledY: 40,
);
const _route = RoutePosition(
  distanceAlongRoute: 0,
  headingDegrees: 0,
  screenX: 10,
  screenY: 20,
  segmentIndex: 0,
  tiledX: 30,
  tiledY: 40,
);

void main() {
  test(
    'initial state is immutable, idle, and contains no raw sample list',
    () async {
      final harness = _Harness();

      expect(harness.engine.state.status, RawMotionConsumerStatus.idle);
      expect(harness.engine.state.lastPdrResult, isNull);
      expect(harness.engine.state.stats.totalRawSamplesSeen, 0);
      expect(harness.engine.state, isA<RawMotionPdrEngineState>());
      expect(harness.engine.state, isNot(isA<Iterable<MotionInputSample>>()));

      await harness.dispose();
    },
  );

  test('covers unavailable and every permission branch', () async {
    final unavailable = _Harness(
      sensor: FakeSensorDeviceManager(
        availability: const SensorAvailability(
          heading: SensorCapabilityStatus.available,
          motion: SensorCapabilityStatus.unavailable,
        ),
      ),
    );
    await unavailable.engine.start();
    expect(
      unavailable.engine.state.status,
      RawMotionConsumerStatus.unavailable,
    );
    expect(unavailable.fakeSensor.permissionRequestCount, 0);
    await unavailable.dispose();

    for (final permission in SensorPermissionStatus.values) {
      final harness = _Harness(
        sensor: FakeSensorDeviceManager(permissionStatus: permission),
      );
      await harness.engine.start();
      expect(
        harness.engine.state.status,
        permission == SensorPermissionStatus.granted
            ? RawMotionConsumerStatus.running
            : RawMotionConsumerStatus.permissionDenied,
      );
      await harness.dispose();
    }
  });

  test('maps typed startup failures to stable status branches', () async {
    for (final entry in <SensorDeviceErrorCode, RawMotionConsumerStatus>{
      SensorDeviceErrorCode.unavailable: RawMotionConsumerStatus.unavailable,
      SensorDeviceErrorCode.permissionDenied:
          RawMotionConsumerStatus.permissionDenied,
      SensorDeviceErrorCode.permissionRestricted:
          RawMotionConsumerStatus.permissionDenied,
      SensorDeviceErrorCode.startFailed: RawMotionConsumerStatus.error,
    }.entries) {
      final harness = _Harness(
        sensor: FakeSensorDeviceManager(
          startFailure: SensorDeviceException(
            code: entry.key,
            message: 'scripted ${entry.key}',
          ),
        ),
      );

      await harness.engine.start();

      expect(harness.engine.state.status, entry.value);
      expect(harness.scheduler.activeTaskCount, 0);
      await harness.dispose();
    }
  });

  test(
    'uses the exact 30/50/60ms configuration and starts debug session',
    () async {
      final harness = _Harness(initialNowMs: 1000);

      await harness.engine.start();

      expect(harness.fakeSensor.lastStartRequest?.motionUpdateIntervalMs, 30);
      expect(harness.fakeSensor.lastStartRequest?.headingUpdateIntervalMs, 50);
      expect(harness.scheduler.activeTaskCount, 1);
      expect(harness.scheduler.activeNextDueTimesMs, <int>[1060]);
      expect(harness.debug.events, hasLength(1));
      final start = harness.debug.events.single as SensorDebugSessionStart;
      expect(start.sessionId, 'step-test-1970-01-01T00-00-01Z');
      expect(start.startedAtMs, 1000);
      expect(start.configSnapshot.rawMotion.flushIntervalMs, 60);
      expect(start.configSnapshot.rawMotion.headingUpdateIntervalMs, 50);
      expect(start.configSnapshot.rawMotion.sensorUpdateIntervalMs, 30);
      await harness.dispose();
    },
  );

  test(
    'accepts asynchronous scripted events emitted during sensor start',
    () async {
      final sensor = FakeSensorDeviceManager(
        scriptedEvents: <NormalizedSensorEvent>[
          _heading(30),
          _motion(timestampMs: 1, fallbackHeading: 10),
        ],
      );
      final harness = _Harness(sensor: sensor);

      await harness.engine.start();
      await _flushAsync();

      expect(harness.engine.state.status, RawMotionConsumerStatus.running);
      expect(harness.engine.state.stats.lastHeadingDegrees, 30);
      expect(harness.engine.state.stats.totalRawSamplesSeen, 1);
      expect(harness.engine.state.stats.rawSamplesInMemory, 1);
      await harness.dispose();
    },
  );

  test('starting while running replaces the run and active timer', () async {
    final harness = _Harness();
    await harness.engine.start();
    final firstSession =
        (harness.debug.events.single as SensorDebugSessionStart).sessionId;

    harness.clock.advanceByMs(1000);
    await harness.engine.start();

    expect(harness.engine.state.status, RawMotionConsumerStatus.running);
    expect(harness.fakeSensor.startCallCount, 2);
    expect(harness.scheduler.activeTaskCount, 1);
    expect(harness.debug.events, hasLength(3));
    expect(harness.debug.events[1], isA<SensorDebugSessionStop>());
    final secondStart = harness.debug.events[2] as SensorDebugSessionStart;
    expect(secondStart.sessionId, isNot(firstSession));
    await harness.dispose();
  });

  test('heading precedes motion and live heading wins over fallback', () async {
    final headings = <double>[];
    final harness = _Harness(onHeading: headings.add);
    final states = <RawMotionPdrEngineState>[];
    final subscription = harness.engine.states.listen(states.add);
    await harness.engine.start();
    await _flushAsync();
    states.clear();

    harness.fakeSensor.emit(_heading(90));
    harness.fakeSensor.emit(_motion(timestampMs: 1, fallbackHeading: 45));
    await _flushAsync();

    expect(headings, <double>[90]);
    expect(states, hasLength(2));
    expect(states[0].stats.lastHeadingDegrees, 90);
    expect(states[0].stats.totalRawSamplesSeen, 0);
    expect(states[1].stats.totalRawSamplesSeen, 1);
    harness.scheduler.advanceByMs(60);
    expect(
      harness
          .engine
          .state
          .lastPdrResult
          ?.diagnostics
          .heading
          .observedHeadingDegrees,
      90,
    );
    await harness.dispose();
    await subscription.cancel();
  });

  test('applies trusted-node heading correction to sensor input', () async {
    final headings = <double>[];
    final harness = _Harness(onHeading: headings.add);
    await harness.engine.start();

    harness.engine.setHeadingCorrectionDegrees(180);
    harness.fakeSensor.emit(_heading(90));
    harness.fakeSensor.emit(_motion(timestampMs: 1, fallbackHeading: 90));
    await _flushAsync();

    expect(harness.engine.latestDeviceHeadingDegrees, 90);
    expect(headings, <double>[270]);
    expect(harness.engine.state.stats.lastHeadingDegrees, 270);
    harness.scheduler.advanceByMs(60);
    expect(
      harness
          .engine
          .state
          .lastPdrResult
          ?.diagnostics
          .heading
          .observedHeadingDegrees,
      270,
    );
    await harness.dispose();
  });

  test(
    'motion fallback updates heading first when heading source is unavailable',
    () async {
      final headings = <double>[];
      final harness = _Harness(
        onHeading: headings.add,
        sensor: FakeSensorDeviceManager(
          availability: const SensorAvailability(
            heading: SensorCapabilityStatus.unavailable,
            motion: SensorCapabilityStatus.available,
          ),
        ),
      );
      await harness.engine.start();

      harness.fakeSensor.emit(_motion(timestampMs: 1, fallbackHeading: 315));
      await _flushAsync();

      expect(headings, <double>[315]);
      expect(harness.engine.state.stats.lastHeadingDegrees, 315);
      expect(harness.engine.state.stats.totalRawSamplesSeen, 1);
      await harness.dispose();
    },
  );

  test(
    'caps at 32, prunes at 200ms, and flushes only after new motion',
    () async {
      final harness = _Harness(initialNowMs: 1000);
      await harness.engine.start();
      for (var index = 0; index < 35; index += 1) {
        final timestamp = index == 32 ? 800 : 1000 + index;
        harness.fakeSensor.emit(_motion(timestampMs: timestamp));
      }
      await _flushAsync();

      expect(harness.engine.state.stats.rawSamplesInMemory, 32);
      expect(harness.engine.state.stats.totalRawSamplesSeen, 35);
      harness.scheduler.advanceByMs(60);
      expect(harness.engine.state.stats.totalBatches, 1);
      expect(harness.engine.state.stats.rawSamplesInMemory, 31);
      expect(
        harness.engine.state.lastPdrResult?.diagnostics.batch.rawSampleCount,
        32,
      );

      harness.scheduler.advanceByMs(60);
      expect(harness.engine.state.stats.totalBatches, 1);
      harness.fakeSensor.emit(_motion(timestampMs: harness.clock.nowMs()));
      await _flushAsync();
      harness.scheduler.advanceByMs(60);
      expect(harness.engine.state.stats.totalBatches, 2);
      await harness.dispose();
    },
  );

  test(
    'uses latest route context and invokes estimate callback after flush',
    () async {
      final estimates = <DerivedNavigationEstimate>[];
      final harness = _Harness(onEstimate: estimates.add, initialNowMs: 5000);
      await harness.engine.start();
      harness.engine.updateRouteContext(
        pixelsPerMeter: 123,
        routePosition: const RoutePosition(
          distanceAlongRoute: 10,
          headingDegrees: 90,
          screenX: 0,
          screenY: 0,
          segmentIndex: 1,
          tiledX: 0,
          tiledY: 0,
        ),
      );
      harness.fakeSensor.emit(
        _motion(timestampMs: 5000, fallbackHeading: null),
      );
      await _flushAsync();
      harness.scheduler.advanceByMs(60);

      expect(estimates, hasLength(1));
      expect(
        estimates.single,
        same(harness.engine.state.lastPdrResult?.estimate),
      );
      expect(
        harness
            .engine
            .state
            .lastPdrResult
            ?.diagnostics
            .heading
            .desiredHeadingDegrees,
        90,
      );
      expect(
        harness.engine.state.lastPdrResult?.diagnostics.movement.pixelsPerMeter,
        123,
      );
      await harness.dispose();
    },
  );

  test(
    'debug start, batch, stop stay ordered and failures are best-effort',
    () async {
      final debug = FakeSensorDebugSink()
        ..enqueueFailure(StateError('start sink failed'))
        ..enqueueFailure(StateError('batch sink failed'))
        ..enqueueFailure(StateError('stop sink failed'));
      final harness = _Harness(debug: debug, initialNowMs: 1000);

      await harness.engine.start();
      harness.fakeSensor.emit(_motion(timestampMs: 1000));
      await _flushAsync();
      harness.scheduler.advanceByMs(60);
      await harness.engine.stop();

      expect(harness.engine.state.status, RawMotionConsumerStatus.stopped);
      expect(debug.events, hasLength(3));
      expect(debug.events[0], isA<SensorDebugSessionStart>());
      expect(debug.events[1], isA<SensorDebugBatchLog>());
      expect(debug.events[2], isA<SensorDebugSessionStop>());
      final batch = debug.events[1] as SensorDebugBatchLog;
      expect(batch.batchId, 1);
      expect(
        batch.sessionId,
        (debug.events[0] as SensorDebugSessionStart).sessionId,
      );
      await harness.dispose();
    },
  );

  test(
    'reset is synchronous and preserves running status while clearing output',
    () async {
      final harness = _Harness();
      await harness.engine.start();
      harness.fakeSensor.emit(_motion(timestampMs: 0));
      await _flushAsync();
      harness.scheduler.advanceByMs(60);
      expect(harness.engine.state.lastPdrResult, isNotNull);

      harness.engine.reset();

      expect(harness.engine.state.status, RawMotionConsumerStatus.running);
      expect(harness.engine.state.lastPdrResult, isNull);
      expect(harness.engine.state.stats.totalBatches, 0);
      expect(harness.engine.state.stats.totalRawSamplesSeen, 0);
      await harness.dispose();
    },
  );

  test('rebase anchors the next PDR batch at a trusted position', () async {
    final harness = _Harness();
    await harness.engine.start();
    const trusted = RoutePosition(
      distanceAlongRoute: 40,
      headingDegrees: 180,
      screenX: 120,
      screenY: 240,
      segmentIndex: 2,
      tiledX: 30,
      tiledY: 60,
    );

    harness.engine.rebase(trusted);
    harness.fakeSensor.emit(_motion(timestampMs: 100));
    await _flushAsync();
    harness.scheduler.advanceByMs(60);

    final result = harness.engine.state.lastPdrResult;
    expect(result, isNotNull);
    expect(result!.nextState.x, closeTo(trusted.screenX, 0.001));
    expect(result.nextState.y, closeTo(trusted.screenY, 0.001));
    await harness.dispose();
  });

  test('pause, resume, and stop manage one task and replace the run', () async {
    final harness = _Harness();
    await harness.engine.start();
    expect(harness.fakeSensor.startCallCount, 1);

    await harness.engine.pause();
    expect(harness.engine.state.status, RawMotionConsumerStatus.stopped);
    expect(harness.scheduler.activeTaskCount, 0);
    await harness.engine.resume();
    expect(harness.engine.state.status, RawMotionConsumerStatus.running);
    expect(harness.fakeSensor.startCallCount, 2);
    expect(harness.scheduler.activeTaskCount, 1);
    await harness.engine.stop();
    expect(harness.engine.state.status, RawMotionConsumerStatus.stopped);
    expect(harness.scheduler.activeTaskCount, 0);

    await harness.engine.resume();
    expect(
      harness.fakeSensor.startCallCount,
      2,
      reason: 'explicit stop is not paused',
    );
    await harness.dispose();
  });

  test(
    'recoverable stream failure keeps running; interruption is terminal',
    () async {
      final harness = _Harness();
      await harness.engine.start();

      harness.fakeSensor.emitStreamError();
      await _flushAsync();
      expect(harness.engine.state.status, RawMotionConsumerStatus.running);
      expect(harness.scheduler.activeTaskCount, 1);

      harness.fakeSensor.interrupt();
      await _flushAsync();
      expect(harness.engine.state.status, RawMotionConsumerStatus.error);
      expect(harness.scheduler.activeTaskCount, 0);
      expect(harness.debug.events.last, isA<SensorDebugSessionStop>());
      await harness.dispose();
    },
  );

  test('duplicate racing starts suppress stale async completion', () async {
    final sensor = _ControlledSensorDeviceManager();
    final firstAvailability = Completer<SensorAvailability>();
    final secondAvailability = Completer<SensorAvailability>();
    sensor.availabilityResults
      ..add(firstAvailability.future)
      ..add(secondAvailability.future);
    final harness = _Harness(sensor: sensor);

    final firstStart = harness.engine.start();
    await _flushAsync();
    final secondStart = harness.engine.start();
    await _flushAsync();
    secondAvailability.complete(_available);
    await _flushAsync();
    firstAvailability.complete(_available);
    await Future.wait([firstStart, secondStart]);

    expect(harness.engine.state.status, RawMotionConsumerStatus.running);
    expect(sensor.eventsGetterCount, 1);
    expect(sensor.startCallCount, 1);
    expect(sensor.lastStartRequest?.motionUpdateIntervalMs, 30);
    await harness.dispose();
  });

  test(
    'dispose closes states and suppresses queued and future emissions',
    () async {
      final harness = _Harness();
      final states = <RawMotionPdrEngineState>[];
      var isDone = false;
      final subscription = harness.engine.states.listen(
        states.add,
        onDone: () => isDone = true,
      );
      await harness.engine.start();
      harness.fakeSensor.emit(_motion(timestampMs: 1));
      await harness.engine.dispose();
      await _flushAsync();

      expect(isDone, isTrue);
      final countAtDispose = states.length;
      harness.scheduler.advanceByMs(600);
      await _flushAsync();
      expect(states, hasLength(countAtDispose));
      expect(harness.fakeSensor.emit(_motion(timestampMs: 2)), isFalse);
      expect(harness.fakeSensor.disposeCallCount, 1);
      expect(harness.engine.start, throwsStateError);
      expect(harness.engine.reset, throwsStateError);
      await subscription.cancel();
    },
  );
}

const _available = SensorAvailability(
  heading: SensorCapabilityStatus.available,
  motion: SensorCapabilityStatus.available,
);

final class _Harness {
  _Harness({
    FakeSensorDebugSink? debug,
    int initialNowMs = 0,
    RawMotionEstimateCallback? onEstimate,
    RawMotionHeadingCallback? onHeading,
    SensorDeviceManager? sensor,
  }) : clock = FakeClock(initialNowMs: initialNowMs),
       debug = debug ?? FakeSensorDebugSink(),
       sensor = sensor ?? FakeSensorDeviceManager() {
    scheduler = FakePeriodicScheduler(clock: clock);
    engine = RawMotionPdrEngine(
      clock: clock,
      initialRedMarker: _marker,
      initialRoutePosition: _route,
      onEstimate: onEstimate,
      onHeading: onHeading,
      periodicScheduler: scheduler,
      sensorDebugSink: this.debug,
      sensorDeviceManager: this.sensor,
    );
  }

  final FakeClock clock;
  final FakeSensorDebugSink debug;
  late final RawMotionPdrEngine engine;
  late final FakePeriodicScheduler scheduler;
  final SensorDeviceManager sensor;

  FakeSensorDeviceManager get fakeSensor => sensor as FakeSensorDeviceManager;

  Future<void> dispose() async {
    await engine.dispose();
  }
}

HeadingSensorEvent _heading(double degrees) {
  return HeadingSensorEvent(
    headingDegrees: degrees,
    receivedAtMs: 0,
    source: SensorHeadingSource.magnetometer,
  );
}

MotionSensorEvent _motion({
  double? fallbackHeading = 0,
  required int timestampMs,
}) {
  return MotionSensorEvent(
    accelerationMetersPerSecondSquared: const MotionVector(x: 0, y: 0, z: 0),
    fallbackHeadingDegrees: fallbackHeading,
    receivedAtMs: timestampMs,
  );
}

Future<void> _flushAsync() async {
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
}

final class _ControlledSensorDeviceManager implements SensorDeviceManager {
  final Queue<Future<SensorAvailability>> availabilityResults = Queue();
  final StreamController<NormalizedSensorEvent> _events =
      StreamController<NormalizedSensorEvent>(sync: true);

  int eventsGetterCount = 0;
  int startCallCount = 0;
  int stopCallCount = 0;
  SensorSamplingRequest? lastStartRequest;
  bool disposed = false;
  bool running = false;

  @override
  Stream<NormalizedSensorEvent> get events {
    eventsGetterCount += 1;
    return _events.stream;
  }

  @override
  Future<SensorAvailability> checkAvailability() {
    return availabilityResults.removeFirst();
  }

  @override
  Future<SensorPermissionStatus> requestPermissions() async {
    return SensorPermissionStatus.granted;
  }

  @override
  Future<void> start(SensorSamplingRequest request) async {
    startCallCount += 1;
    lastStartRequest = request;
    running = true;
  }

  @override
  Future<void> stop() async {
    stopCallCount += 1;
    running = false;
  }

  @override
  Future<void> dispose() async {
    if (disposed) {
      return;
    }
    disposed = true;
    running = false;
    final closeFuture = _events.close();
    if (_events.hasListener) {
      await closeFuture;
    }
  }
}
