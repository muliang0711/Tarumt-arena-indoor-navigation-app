import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/navigation/derived_navigation_estimate.dart';
import 'package:indoor_navigation/domain/navigation_input/logic/logic.dart';
import 'package:indoor_navigation/domain/navigation_input/navigation_input_models.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

void main() {
  group('navigation input policy', () {
    test('permits only bounded transient raw sensor batching', () {
      expect(navigationInputPolicy.rawSensorRecordingEnabled, isFalse);
      expect(navigationInputPolicy.transientRawSensorBatchingEnabled, isTrue);
      expect(navigationInputPolicy.maxDerivedUpdatesPerSecond, 15);
      expect(navigationInputPolicy.maxRawSamplesInMemory, 32);
      expect(assertRawSensorRecordingDisabled, returnsNormally);
      expect(assertTransientRawSensorBatchingAllowed, returnsNormally);
      expect(rawMotionConsumerConfig.flushIntervalMs, 60);
      expect(rawMotionConsumerConfig.sensorUpdateIntervalMs, 30);
      expect(
        rawMotionConsumerConfig.flushIntervalMs,
        lessThanOrEqualTo(
          1000 / navigationInputPolicy.maxDerivedUpdatesPerSecond,
        ),
      );
    });

    test('accepts first estimate and enforces the exact 15 Hz boundary', () {
      final previous = _estimate(timestampMs: 1000, x: 236);

      expect(
        shouldAcceptDerivedEstimate(
          nextEstimate: previous,
          previousEstimate: null,
        ),
        isTrue,
      );
      expect(
        shouldAcceptDerivedEstimate(
          nextEstimate: _estimate(timestampMs: 1066, x: 260),
          previousEstimate: previous,
        ),
        isFalse,
      );
      expect(
        shouldAcceptDerivedEstimate(
          nextEstimate: _estimate(timestampMs: 1067, x: 260),
          previousEstimate: previous,
        ),
        isTrue,
      );
      expect(
        shouldAcceptDerivedEstimate(
          nextEstimate: _estimate(timestampMs: 900, x: 260),
          previousEstimate: previous,
        ),
        isFalse,
      );
    });
  });

  group('derived estimate buffer', () {
    test('rate-limits, counts drops, and retains only newest estimates', () {
      final initial = createDerivedEstimateBuffer(maxSize: 2);
      final first = ingestDerivedEstimate(
        buffer: initial,
        estimate: _estimate(timestampMs: 1000, x: 236),
      );
      final rateLimited = ingestDerivedEstimate(
        buffer: first.buffer,
        estimate: _estimate(timestampMs: 1050, x: 260),
      );
      final second = ingestDerivedEstimate(
        buffer: rateLimited.buffer,
        estimate: _estimate(timestampMs: 1100, x: 280),
      );
      final third = ingestDerivedEstimate(
        buffer: second.buffer,
        estimate: _estimate(timestampMs: 1200, x: 320),
      );

      expect(first.accepted, isTrue);
      expect(rateLimited.accepted, isFalse);
      expect(rateLimited.acceptedEstimate, isNull);
      expect(rateLimited.reason, DerivedEstimateIngestReason.rateLimited);
      expect(third.buffer.droppedEstimateCount, 1);
      expect(
        third.buffer.acceptedEstimates.map((estimate) => estimate.x),
        <double>[280, 320],
      );
      expect(getLatestDerivedEstimate(third.buffer)?.x, 320);
      expect(
        () => third.buffer.acceptedEstimates.add(
          _estimate(timestampMs: 1300, x: 400),
        ),
        throwsUnsupportedError,
      );
    });

    test('matches JavaScript slice behavior for maxSize zero', () {
      var buffer = createDerivedEstimateBuffer(maxSize: 0);
      buffer = ingestDerivedEstimate(
        buffer: buffer,
        estimate: _estimate(timestampMs: 1000, x: 1),
      ).buffer;
      buffer = ingestDerivedEstimate(
        buffer: buffer,
        estimate: _estimate(timestampMs: 1100, x: 2),
      ).buffer;

      expect(buffer.acceptedEstimates, hasLength(2));
    });
  });

  test('creates replay estimate near route progress with cyclic offsets', () {
    const routePosition = RoutePosition(
      distanceAlongRoute: 0,
      headingDegrees: 0,
      screenX: 236,
      screenY: 648,
      segmentIndex: 0,
      tiledX: -20,
      tiledY: 904,
    );
    final estimate = createDebugReplayEstimate(
      nowMs: 1000,
      routePosition: routePosition,
      sequenceIndex: 2,
    );
    final wrapped = createDebugReplayEstimate(
      nowMs: 1000,
      routePosition: routePosition,
      sequenceIndex: 7,
    );
    final negativeFallback = createDebugReplayEstimate(
      nowMs: 1000,
      routePosition: routePosition,
      sequenceIndex: -1,
    );

    expect(estimate.confidence, 0.76);
    expect(estimate.headingDegrees, 0);
    expect(estimate.source, DerivedNavigationEstimateSource.debugReplay);
    expect(estimate.x, 304);
    expect(estimate.y, 666);
    expect(wrapped.x, estimate.x);
    expect(negativeFallback.x, 264);
    expect(debugReplaySource.kind, DerivedEstimateSourceKind.debugReplay);
    expect(debugReplaySource.name, 'Debug replay derived estimate');
  });

  test('converts derived estimate to red marker with Tiled origin offset', () {
    final marker = redMarkerFromDerivedEstimate(
      _estimate(timestampMs: 1200, x: 300, y: 700),
      const SurfaceRect(height: 2048, originX: -256, originY: 256, width: 1536),
    );

    expect(marker.headingDegrees, 0);
    expect(RedMarkerState.kind, 'redMarker');
    expect(marker.screenX, 300);
    expect(marker.screenY, 700);
    expect(marker.tiledX, 44);
    expect(marker.tiledY, 956);
  });

  test('replaces live heading without changing the source sample', () {
    const sample = MotionInputSample(
      acceleration: MotionVector(x: 1, y: 0, z: 0),
      headingDegrees: 0,
      timestampMs: 1000,
    );
    final replaced = applyLiveHeadingToMotionSample(
      liveHeadingDegrees: 180,
      sample: sample,
    );
    final unchanged = applyLiveHeadingToMotionSample(
      liveHeadingDegrees: null,
      sample: sample,
    );

    expect(replaced.headingDegrees, 180);
    expect(replaced.acceleration, same(sample.acceleration));
    expect(sample.headingDegrees, 0);
    expect(unchanged, same(sample));
  });

  test('tracks transient sample, heading, and flush statistics', () {
    final firstEvent = updateRawMotionStatsAfterSensorEvent(
      currentStats: createRawMotionBatchStats(),
      rawSamplesInMemory: 1,
    );
    final secondEvent = updateRawMotionStatsAfterSensorEvent(
      currentStats: firstEvent,
      rawSamplesInMemory: 2,
    );
    final withHeading = updateRawMotionStatsAfterHeading(
      currentStats: secondEvent,
      headingDegrees: 135,
    );
    final flushed = updateRawMotionStatsAfterFlush(
      currentStats: withHeading,
      acceptedSampleCount: 2,
      droppedSampleCount: 1,
      latencyMs: 25,
      rawSamplesInMemory: 2,
    );
    final flushedWithDefaultCount = updateRawMotionStatsAfterFlush(
      currentStats: flushed,
      acceptedSampleCount: 0,
      droppedSampleCount: 0,
      latencyMs: 0,
    );

    expect(flushed.totalRawSamplesSeen, 2);
    expect(flushed.totalBatches, 1);
    expect(flushed.lastAcceptedSampleCount, 2);
    expect(flushed.lastDroppedSampleCount, 1);
    expect(flushed.lastLatencyMs, 25);
    expect(flushed.lastHeadingDegrees, 135);
    expect(flushed.rawSamplesInMemory, 2);
    expect(flushedWithDefaultCount.rawSamplesInMemory, 0);
  });
}

DerivedNavigationEstimate _estimate({
  required int timestampMs,
  required double x,
  double y = 648,
}) {
  return DerivedNavigationEstimate(
    confidence: 0.8,
    headingDegrees: 0,
    source: DerivedNavigationEstimateSource.externalDerived,
    timestampMs: timestampMs,
    x: x,
    y: y,
  );
}
