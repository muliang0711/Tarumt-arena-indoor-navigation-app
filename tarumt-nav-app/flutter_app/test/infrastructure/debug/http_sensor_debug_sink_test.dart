import 'dart:async';
import 'dart:collection';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/time/clock.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';
import 'package:indoor_navigation/domain/sensor_debug/codec/codec.dart';
import 'package:indoor_navigation/domain/sensor_debug/sensor_debug_models.dart';
import 'package:indoor_navigation/infrastructure/debug/http_sensor_debug_sink.dart';
import 'package:indoor_navigation/infrastructure/debug/sensor_debug_http_transport.dart';

void main() {
  const sessionStart = SensorDebugSessionStart(
    configSnapshot: SensorDebugConfigSnapshot(
      pdr: defaultPdrPipelineConfig,
      rawMotion: RawMotionConsumerConfig(
        flushIntervalMs: 60,
        headingUpdateIntervalMs: 50,
        sensorUpdateIntervalMs: 30,
      ),
    ),
    sessionId: 'session-1',
    startedAtMs: 1000,
  );
  const sessionStop = SensorDebugSessionStop(
    endedAtMs: 2000,
    sessionId: 'session-1',
  );

  test(
    'queues exact endpoints, JSON bodies, headers, and timeout in FIFO order',
    () async {
      final firstDelivery = Completer<void>();
      final transport = _FakeTransport()..enqueueFuture(firstDelivery.future);
      final sink = HttpSensorDebugSink(
        baseUrl: 'http://127.0.0.1:8787/',
        clock: _MutableClock(1000),
        transport: transport,
      );
      final batch = _batchLog();

      sink.sendSessionStart(sessionStart);
      sink.sendBatchLog(batch);
      sink.sendSessionStop(sessionStop);
      await _flushAsyncQueue();

      expect(transport.requests, hasLength(1));
      expect(
        transport.requests.single.uri.toString(),
        'http://127.0.0.1:8787/session-start',
      );

      firstDelivery.complete();
      await sink.pendingDelivery;

      expect(
        transport.requests.map(
          (SensorDebugHttpRequest request) => request.uri.path,
        ),
        <String>['/session-start', '/batch', '/session-stop'],
      );
      expect(
        transport.requests[0].body,
        jsonEncode(encodeSensorDebugSessionStart(sessionStart)),
      );
      expect(
        transport.requests[1].body,
        jsonEncode(encodeSensorDebugBatchLog(batch)),
      );
      expect(
        transport.requests[2].body,
        jsonEncode(encodeSensorDebugSessionStop(sessionStop)),
      );
      for (final request in transport.requests) {
        expect(request.headers, <String, String>{
          'content-type': 'application/json',
        });
        expect(request.timeout, const Duration(milliseconds: 1200));
      }
    },
  );

  test(
    'a failed delivery is logged and does not block the ordered queue',
    () async {
      final transport = _FakeTransport()
        ..enqueueError(StateError('offline'))
        ..enqueueSuccess();
      final logs = <String>[];
      final sink = HttpSensorDebugSink(
        baseUrl: 'http://debug.test',
        clock: _MutableClock(6000),
        failureLogger: logs.add,
        transport: transport,
      );

      sink.sendSessionStart(sessionStart);
      sink.sendSessionStop(sessionStop);
      await sink.pendingDelivery;

      expect(transport.requests, hasLength(2));
      expect(logs, hasLength(1));
      expect(logs.single, contains('/session-start'));
      expect(logs.single, contains('offline'));
    },
  );

  test(
    'passes the whole-request 1200ms timeout and reports timeout failures',
    () async {
      final transport = _FakeTransport()
        ..enqueueError(TimeoutException('request timeout'));
      final logs = <String>[];
      final sink = HttpSensorDebugSink(
        baseUrl: 'http://debug.test',
        clock: _MutableClock(10000),
        failureLogger: logs.add,
        transport: transport,
      );

      sink.sendSessionStop(sessionStop);
      await sink.pendingDelivery;

      expect(transport.requests.single.timeout.inMilliseconds, 1200);
      expect(logs.single, contains('TimeoutException'));
    },
  );

  test(
    'throttles failure logs for 5000ms and logs again at the boundary',
    () async {
      final clock = _MutableClock(1000);
      final transport = _FakeTransport();
      final logs = <String>[];
      final sink = HttpSensorDebugSink(
        baseUrl: 'http://debug.test',
        clock: clock,
        failureLogger: logs.add,
        transport: transport,
      );

      transport.enqueueError(StateError('first'));
      sink.sendSessionStop(sessionStop);
      await sink.pendingDelivery;
      expect(logs, hasLength(1));

      clock.now = 5999;
      transport.enqueueError(StateError('suppressed'));
      sink.sendSessionStop(sessionStop);
      await sink.pendingDelivery;
      expect(logs, hasLength(1));

      clock.now = 6000;
      transport.enqueueError(StateError('boundary'));
      sink.sendSessionStop(sessionStop);
      await sink.pendingDelivery;
      expect(logs, hasLength(2));
      expect(logs.last, contains('boundary'));
    },
  );

  test('is disabled in release mode even with a configured URL', () async {
    final transport = _FakeTransport();
    final sink = HttpSensorDebugSink(
      baseUrl: 'http://debug.test',
      clock: _MutableClock(0),
      releaseMode: true,
      transport: transport,
    );

    sink.sendSessionStart(sessionStart);
    sink.sendBatchLog(_batchLog());
    sink.sendSessionStop(sessionStop);
    await sink.pendingDelivery;

    expect(sink.isEnabled, isFalse);
    expect(transport.requests, isEmpty);
  });

  test('is disabled when SENSOR_DEBUG_LOG_URL is empty', () async {
    final transport = _FakeTransport();
    final sink = HttpSensorDebugSink(
      baseUrl: '   ',
      clock: _MutableClock(0),
      transport: transport,
    );

    sink.sendSessionStart(sessionStart);
    await sink.pendingDelivery;

    expect(sink.isEnabled, isFalse);
    expect(transport.requests, isEmpty);
  });

  test('never places raw sample arrays in transport payloads', () async {
    final transport = _FakeTransport();
    final sink = HttpSensorDebugSink(
      baseUrl: 'http://debug.test',
      clock: _MutableClock(0),
      transport: transport,
    );

    sink.sendBatchLog(_batchLog());
    await sink.pendingDelivery;

    final body = transport.requests.single.body;
    expect(body, isNot(contains('rawSamples')));
    expect(body, isNot(contains('motionSamples')));
    expect(jsonDecode(body), isA<Map<String, Object?>>());
  });
}

Future<void> _flushAsyncQueue() => Future<void>.delayed(Duration.zero);

SensorDebugBatchLog _batchLog() {
  return SensorDebugBatchLog(
    batchId: 2,
    diagnostics: PdrPipelineDiagnostics(
      batch: const PdrBatchDiagnostic(
        acceptedSampleCount: 1,
        batchWindowMs: 180,
        droppedSampleCount: 0,
        maxBatchAgeMs: 200,
        maxSamplesPerBatch: 32,
        rawSampleCount: 1,
        sampleEndTimestampMs: 1100,
        sampleStartTimestampMs: 1000,
      ),
      configSnapshot: defaultPdrPipelineConfig,
      heading: const PdrHeadingDiagnostic(
        desiredHeadingDegrees: 90,
        observedHeadingDegrees: 91,
        previousHeadingDegrees: 89,
        topCandidate: null,
      ),
      latencyMs: 4,
      movement: const PdrMovementDiagnostic(
        blockedReason: null,
        direction: RouteMovementDirection.forward,
        distancePixels: 28,
        headingDegrees: 90,
        movedStepCount: 1,
        pixelsPerMeter: 56,
        stepLengthMeters: 0.5,
      ),
      step: const StepDetectionDiagnostic(
        averageAcceleration: 1.2,
        minAcceleration: 0.1,
        peakAcceleration: 2,
        peakTimestampMs: 1050,
        rejectReason: StepRejectReason.accepted,
        rotationHeadingTravelDegrees: 2,
        stepCount: 1,
        timeSinceLastStepMs: 400,
      ),
    ),
    sessionId: 'session-1',
    timestampMs: 1200,
  );
}

final class _MutableClock implements Clock {
  _MutableClock(this.now);

  int now;

  @override
  int nowMs() => now;
}

final class _FakeTransport implements SensorDebugHttpTransport {
  final List<SensorDebugHttpRequest> requests = <SensorDebugHttpRequest>[];
  final Queue<Future<void> Function()> _outcomes =
      Queue<Future<void> Function()>();

  void enqueueError(Object error) {
    _outcomes.add(() => Future<void>.error(error));
  }

  void enqueueFuture(Future<void> future) {
    _outcomes.add(() => future);
  }

  void enqueueSuccess() {
    _outcomes.add(Future<void>.value);
  }

  @override
  Future<void> post(SensorDebugHttpRequest request) {
    requests.add(request);
    return _outcomes.isEmpty ? Future<void>.value() : _outcomes.removeFirst()();
  }
}
