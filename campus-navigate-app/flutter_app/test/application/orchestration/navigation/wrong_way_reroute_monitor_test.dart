import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/navigation/wrong_way_reroute_monitor.dart';
import 'package:indoor_navigation/domain/reroute/reroute_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

import '../../../support/fakes/fake_clock.dart';
import '../../../support/fakes/fake_periodic_scheduler.dart';

void main() {
  test(
    'start checks immediately then uses the exact 1000ms interval',
    () async {
      final clock = FakeClock();
      final scheduler = FakePeriodicScheduler(clock: clock);
      final monitor = _monitor(clock: clock, scheduler: scheduler);
      final states = <WrongWayRerouteMonitorState>[];
      final subscription = monitor.states.listen(states.add);

      expect(monitor.state.isRunning, isFalse);
      monitor.start();
      monitor.start();

      expect(
        states,
        hasLength(1),
        reason: 'start performs one immediate check',
      );
      expect(states.single.result.oppositeHeadingDurationMs, 0);
      expect(states.single.result.shouldSuggestReroute, isFalse);
      expect(scheduler.scheduledTaskCount, 1);
      expect(scheduler.activeNextDueTimesMs, <int>[1000]);

      scheduler.advanceByMs(999);
      expect(states, hasLength(1));
      scheduler.advanceByMs(1);

      expect(states, hasLength(2));
      expect(monitor.state.result.oppositeHeadingDurationMs, 1000);
      expect(monitor.state.result.shouldSuggestReroute, isTrue);
      expect(
        monitor.state.result.reason,
        WrongWayRerouteReason.oppositeHeading,
      );

      await monitor.dispose();
      await subscription.cancel();
    },
  );

  test(
    'accepted turn headings and latest inputs apply only on next check',
    () async {
      final clock = FakeClock();
      final scheduler = FakePeriodicScheduler(clock: clock);
      final monitor = _monitor(clock: clock, scheduler: scheduler);
      final states = <WrongWayRerouteMonitorState>[];
      final subscription = monitor.states.listen(states.add);
      monitor.start();

      monitor.updateAcceptedExpectedHeadingDegrees(<double>[0, 180]);
      monitor.updateObservedHeadingDegrees(180);
      monitor.updateRoutePosition(_position(x: 50, y: 50, heading: 90));
      monitor.updateRouteNodes(<OverlayRouteNode>[_junction(x: 50, y: 50)]);
      expect(states, hasLength(1));

      scheduler.advanceByMs(1000);

      expect(states, hasLength(2));
      expect(monitor.state.result.isHeadingOpposite, isFalse);
      expect(monitor.state.result.currentNode!.nodeId, 'junction-1');
      expect(monitor.state.result.isAtJunction, isTrue);
      expect(
        monitor.state.result.reason,
        WrongWayRerouteReason.headingNotOpposite,
      );

      await monitor.dispose();
      await subscription.cancel();
    },
  );

  test(
    'pause suppresses ticks and resume immediately checks with one timer',
    () async {
      final clock = FakeClock();
      final scheduler = FakePeriodicScheduler(clock: clock);
      final monitor = _monitor(clock: clock, scheduler: scheduler);
      final states = <WrongWayRerouteMonitorState>[];
      final subscription = monitor.states.listen(states.add);
      monitor.start();
      monitor.pause();
      monitor.pause();

      expect(states.map((state) => state.isRunning), <bool>[true, false]);
      expect(scheduler.activeTaskCount, 0);
      scheduler.advanceByMs(3000);
      expect(states, hasLength(2));

      monitor.updateObservedHeadingDegrees(0);
      monitor.resume();
      monitor.resume();

      expect(states, hasLength(3));
      expect(states.last.isRunning, isTrue);
      expect(states.last.result.isHeadingOpposite, isFalse);
      expect(scheduler.scheduledTaskCount, 2);
      expect(scheduler.activeTaskCount, 1);

      await monitor.dispose();
      await subscription.cancel();
    },
  );

  test(
    'reset clears duration and suggestion without replacing timer',
    () async {
      final clock = FakeClock();
      final scheduler = FakePeriodicScheduler(clock: clock);
      final monitor = _monitor(clock: clock, scheduler: scheduler);
      monitor.start();
      scheduler.advanceByMs(1000);
      expect(monitor.state.result.shouldSuggestReroute, isTrue);
      final scheduledBeforeReset = scheduler.scheduledTaskCount;

      monitor.reset();

      expect(monitor.state.isRunning, isTrue);
      expect(monitor.state.result.oppositeHeadingDurationMs, 0);
      expect(monitor.state.result.shouldSuggestReroute, isFalse);
      expect(monitor.state.result.state.oppositeHeadingStartedAtMs, isNull);
      expect(scheduler.scheduledTaskCount, scheduledBeforeReset);
      expect(scheduler.activeTaskCount, 1);

      scheduler.advanceByMs(1000);
      expect(monitor.state.result.oppositeHeadingDurationMs, 0);
      await monitor.dispose();
    },
  );

  test(
    'dispose cancels timer, closes states, and blocks stale emissions',
    () async {
      final clock = FakeClock();
      final scheduler = FakePeriodicScheduler(clock: clock);
      final monitor = _monitor(clock: clock, scheduler: scheduler);
      final states = <WrongWayRerouteMonitorState>[];
      var done = false;
      final subscription = monitor.states.listen(
        states.add,
        onDone: () => done = true,
      );
      monitor.start();

      await monitor.dispose();
      scheduler.advanceByMs(5000);

      expect(done, isTrue);
      expect(states, hasLength(1));
      expect(scheduler.activeTaskCount, 0);
      expect(monitor.start, throwsStateError);
      expect(() => monitor.updateObservedHeadingDegrees(0), throwsStateError);
      await monitor.dispose();
      await subscription.cancel();
    },
  );
}

WrongWayRerouteMonitor _monitor({
  required FakeClock clock,
  required FakePeriodicScheduler scheduler,
}) {
  return WrongWayRerouteMonitor(
    clock: clock,
    observedHeadingDegrees: 180,
    routeNodes: const <OverlayRouteNode>[],
    routePosition: _position(x: 0, y: 0, heading: 0),
    scheduler: scheduler,
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
    tiledX: x,
    tiledY: y,
  );
}

OverlayRouteNode _junction({required double x, required double y}) {
  return OverlayRouteNode(
    id: 1,
    nodeId: 'junction-1',
    screenX: x,
    screenY: y,
    tiledX: x,
    tiledY: y,
    type: 'junctions',
  );
}
