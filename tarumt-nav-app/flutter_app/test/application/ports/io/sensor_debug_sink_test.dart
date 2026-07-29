import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/debug/sensor_debug_sink.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';
import 'package:indoor_navigation/domain/sensor_debug/sensor_debug_models.dart';

import '../../../support/fakes/fake_sensor_debug_sink.dart';

void main() {
  const start = SensorDebugSessionStart(
    configSnapshot: SensorDebugConfigSnapshot(
      pdr: defaultPdrPipelineConfig,
      rawMotion: rawMotionConsumerConfig,
    ),
    sessionId: 'session-1',
    startedAtMs: 1000,
  );
  const batch = SensorDebugBatchLog(
    batchId: 1,
    diagnostics: _diagnostics,
    sessionId: 'session-1',
    timestampMs: 1100,
  );
  const stop = SensorDebugSessionStop(endedAtMs: 1200, sessionId: 'session-1');

  test('accepts typed events synchronously and preserves event order', () {
    final fake = FakeSensorDebugSink();
    final SensorDebugSink sink = fake;

    sink.sendSessionStart(start);
    sink.sendBatchLog(batch);
    sink.sendSessionStop(stop);

    expect(fake.events, <Object>[start, batch, stop]);
    expect(fake.events[0], isA<SensorDebugSessionStart>());
    expect(fake.events[1], isA<SensorDebugBatchLog>());
    expect(fake.events[2], isA<SensorDebugSessionStop>());
    expect(fake.events.whereType<MotionInputSample>(), isEmpty);
  });

  test('scripts invocation success and synchronous adapter failure FIFO', () {
    final failure = StateError('sink closed');
    final fake = FakeSensorDebugSink()
      ..enqueueSuccess()
      ..enqueueFailure(failure);

    fake.sendSessionStart(start);
    expect(() => fake.sendBatchLog(batch), throwsA(same(failure)));
    expect(fake.events, <Object>[start, batch]);
  });

  test('event snapshots are immutable and detached from later clearing', () {
    final fake = FakeSensorDebugSink()..sendSessionStart(start);
    final snapshot = fake.events;

    expect(() => snapshot.add(stop), throwsUnsupportedError);
    fake.clearEvents();
    expect(fake.events, isEmpty);
    expect(snapshot, <Object>[start]);
  });
}

const _diagnostics = PdrPipelineDiagnostics(
  batch: PdrBatchDiagnostic(
    acceptedSampleCount: 1,
    batchWindowMs: 180,
    droppedSampleCount: 0,
    maxBatchAgeMs: 200,
    maxSamplesPerBatch: 32,
    rawSampleCount: 1,
    sampleEndTimestampMs: 1090,
    sampleStartTimestampMs: 1090,
  ),
  configSnapshot: defaultPdrPipelineConfig,
  heading: PdrHeadingDiagnostic(
    desiredHeadingDegrees: 90,
    observedHeadingDegrees: 90,
    previousHeadingDegrees: 90,
    topCandidate: HeadingCandidateScore(
      headingDegrees: 90,
      label: HeadingCandidateLabel.desired,
      score: 1,
    ),
  ),
  latencyMs: 10,
  movement: PdrMovementDiagnostic(
    blockedReason: null,
    direction: RouteMovementDirection.forward,
    distancePixels: 28,
    headingDegrees: 90,
    movedStepCount: 1,
    pixelsPerMeter: 56,
    stepLengthMeters: 0.5,
  ),
  step: StepDetectionDiagnostic(
    averageAcceleration: 1,
    minAcceleration: 0.2,
    peakAcceleration: 2,
    peakTimestampMs: 1090,
    rejectReason: StepRejectReason.accepted,
    rotationHeadingTravelDegrees: 0,
    stepCount: 1,
    timeSinceLastStepMs: 400,
  ),
);
