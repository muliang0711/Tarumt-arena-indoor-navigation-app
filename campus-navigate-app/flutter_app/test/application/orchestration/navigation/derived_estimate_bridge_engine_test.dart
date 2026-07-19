import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/navigation/derived_estimate_bridge_engine.dart';
import 'package:indoor_navigation/domain/navigation/derived_navigation_estimate.dart';
import 'package:indoor_navigation/domain/navigation_input/navigation_input_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

import '../../../support/fakes/fake_clock.dart';

void main() {
  test(
    'initial state uses the initial marker and an empty size-six buffer',
    () async {
      final engine = _engine(FakeClock(initialNowMs: 100));

      expect(engine.state.buffer.maxSize, 6);
      expect(engine.state.buffer.acceptedEstimates, isEmpty);
      expect(engine.state.lastResult, isNull);
      expect(engine.state.latestEstimate, isNull);
      expect(engine.state.observedHeadingDegrees, isNull);
      expect(engine.state.redMarker.screenX, 1);
      expect(engine.state.redMarker.headingDegrees, 5);
      expect(engine.state.replaySequenceIndex, 0);

      await engine.dispose();
    },
  );

  test('returns ingest result and enforces the exact 15Hz boundary', () async {
    final engine = _engine(FakeClock());
    final states = <DerivedEstimateBridgeState>[];
    final subscription = engine.states.listen(states.add);

    final first = engine.ingestExternalEstimate(
      _estimate(timestampMs: 1000, x: 10),
    );
    final dropped = engine.ingestExternalEstimate(
      _estimate(timestampMs: 1066, x: 20),
    );
    final accepted = engine.ingestExternalEstimate(
      _estimate(timestampMs: 1067, x: 30),
    );

    expect(first.accepted, isTrue);
    expect(dropped.accepted, isFalse);
    expect(dropped.reason, DerivedEstimateIngestReason.rateLimited);
    expect(accepted.accepted, isTrue);
    expect(engine.state.buffer.acceptedEstimates, hasLength(2));
    expect(engine.state.buffer.droppedEstimateCount, 1);
    expect(engine.state.latestEstimate!.x, 30);
    expect(engine.state.redMarker.screenX, 30);
    expect(engine.state.redMarker.tiledX, 130);
    expect(states, hasLength(3));

    await engine.dispose();
    await subscription.cancel();
  });

  test('buffer retains only the newest six accepted estimates', () async {
    final engine = _engine(FakeClock());

    for (var index = 0; index < 7; index += 1) {
      engine.ingestExternalEstimate(
        _estimate(timestampMs: index * 100, x: index.toDouble()),
      );
    }

    expect(
      engine.state.buffer.acceptedEstimates.map((estimate) => estimate.x),
      <double>[1, 2, 3, 4, 5, 6],
    );
    await engine.dispose();
  });

  test(
    'heading-only update directly overrides and restores marker heading',
    () async {
      final engine = _engine(FakeClock());
      engine.ingestExternalEstimate(_estimate(timestampMs: 0, x: 20));

      engine.updateHeadingOnly(270);
      expect(engine.state.headingOnlyDegrees, 270);
      expect(engine.state.observedHeadingDegrees, 270);
      expect(engine.state.redMarker.headingDegrees, 270);
      expect(engine.state.redMarker.screenX, 20);

      engine.updateHeadingOnly(null);
      expect(engine.state.observedHeadingDegrees, 45);
      expect(engine.state.redMarker.headingDegrees, 45);
      await engine.dispose();
    },
  );

  test(
    'replay uses clock, sequence, and the latest route position atomically',
    () async {
      final clock = FakeClock(initialNowMs: 1000);
      final engine = _engine(clock);
      final states = <DerivedEstimateBridgeState>[];
      final subscription = engine.states.listen(states.add);

      final first = engine.runReplayStep();
      expect(first.accepted, isTrue);
      expect(first.acceptedEstimate!.x, 38);
      expect(first.acceptedEstimate!.y, 46);
      expect(first.acceptedEstimate!.timestampMs, 1000);
      expect(engine.state.replaySequenceIndex, 1);

      final dropped = engine.runReplayStep();
      expect(dropped.accepted, isFalse);
      expect(engine.state.replaySequenceIndex, 2);

      engine.updateRoutePosition(_position(x: 100, y: 200, heading: 180));
      clock.advanceByMs(67);
      final third = engine.runReplayStep();
      expect(third.accepted, isTrue);
      expect(third.acceptedEstimate!.x, 168);
      expect(third.acceptedEstimate!.y, 218);
      expect(third.acceptedEstimate!.headingDegrees, 180);
      expect(engine.state.replaySequenceIndex, 3);
      expect(states, hasLength(4));

      await engine.dispose();
      await subscription.cancel();
    },
  );

  test(
    'reset clears bridge-local state but keeps route and surface inputs',
    () async {
      final engine = _engine(FakeClock(initialNowMs: 100));
      final routePosition = _position(x: 99, y: 88, heading: 180);
      engine.updateRoutePosition(routePosition);
      engine.runReplayStep();
      engine.updateHeadingOnly(12);

      engine.reset();

      expect(engine.state.buffer.acceptedEstimates, isEmpty);
      expect(engine.state.buffer.droppedEstimateCount, 0);
      expect(engine.state.headingOnlyDegrees, isNull);
      expect(engine.state.lastResult, isNull);
      expect(engine.state.replaySequenceIndex, 0);
      expect(engine.state.routePosition, same(routePosition));
      expect(engine.state.redMarker.screenX, 1);
      await engine.dispose();
    },
  );

  test('dispose closes state stream and rejects later mutations', () async {
    final engine = _engine(FakeClock());
    var done = false;
    final subscription = engine.states.listen(
      (_) {},
      onDone: () => done = true,
    );

    await engine.dispose();

    expect(done, isTrue);
    expect(
      () => engine.ingestExternalEstimate(_estimate(timestampMs: 0, x: 0)),
      throwsStateError,
    );
    expect(engine.reset, throwsStateError);
    await engine.dispose();
    await subscription.cancel();
  });
}

DerivedEstimateBridgeEngine _engine(FakeClock clock) {
  return DerivedEstimateBridgeEngine(
    clock: clock,
    initialRedMarker: const RedMarkerState(
      headingDegrees: 5,
      screenX: 1,
      screenY: 2,
      tiledX: 101,
      tiledY: 202,
    ),
    routePosition: _position(x: 10, y: 20, heading: 90),
    surface: const SurfaceRect(
      height: 500,
      originX: 100,
      originY: 200,
      width: 400,
    ),
  );
}

DerivedNavigationEstimate _estimate({
  double headingDegrees = 45,
  required int timestampMs,
  required double x,
}) {
  return DerivedNavigationEstimate(
    confidence: 0.8,
    headingDegrees: headingDegrees,
    source: DerivedNavigationEstimateSource.externalDerived,
    timestampMs: timestampMs,
    x: x,
    y: 50,
  );
}

RoutePosition _position({
  required double heading,
  required double x,
  required double y,
}) {
  return RoutePosition(
    distanceAlongRoute: 0,
    headingDegrees: heading,
    screenX: x,
    screenY: y,
    segmentIndex: 0,
    tiledX: x + 100,
    tiledY: y + 200,
  );
}
