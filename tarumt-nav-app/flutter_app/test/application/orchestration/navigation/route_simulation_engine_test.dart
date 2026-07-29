import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/navigation/route_simulation_engine.dart';
import 'package:indoor_navigation/domain/simulation/simulation_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

import '../../../support/fakes/fake_periodic_scheduler.dart';

void main() {
  test('initial state exposes exact route-derived values', () async {
    final scheduler = FakePeriodicScheduler();
    final engine = RouteSimulationEngine(
      scheduler: scheduler,
      routePath: _route(length: 200),
    );

    expect(engine.state.status, SimulationStatus.ready);
    expect(engine.state.routeProgressPixels, 0);
    expect(engine.state.routeDistancePixels, 200);
    expect(engine.state.distanceRemainingPixels, 200);
    expect(engine.state.routePosition.screenX, 0);
    expect(engine.state.remainingPathSegments, hasLength(1));
    expect(scheduler.scheduledTaskCount, 0);

    await engine.dispose();
  });

  test('ticks every 100ms at 140px/s and arrives with one timer', () async {
    final scheduler = FakePeriodicScheduler();
    final engine = RouteSimulationEngine(
      scheduler: scheduler,
      routePath: _route(length: 28),
    );
    final states = <RouteSimulationState>[];
    final subscription = engine.states.listen(states.add);

    engine.start();
    engine.start();
    expect(scheduler.scheduledTaskCount, 1);
    expect(scheduler.activeTaskCount, 1);
    expect(states.map((state) => state.status), <SimulationStatus>[
      SimulationStatus.moving,
    ]);

    scheduler.advanceByMs(99);
    expect(engine.state.routeProgressPixels, 0);
    scheduler.advanceByMs(1);
    expect(engine.state.routeProgressPixels, 14);
    expect(engine.state.status, SimulationStatus.moving);
    scheduler.advanceByMs(100);

    expect(engine.state.routeProgressPixels, 28);
    expect(engine.state.distanceRemainingPixels, 0);
    expect(engine.state.remainingPathSegments, isEmpty);
    expect(engine.state.status, SimulationStatus.arrived);
    expect(scheduler.activeTaskCount, 0);
    expect(states.map((state) => state.status), <SimulationStatus>[
      SimulationStatus.moving,
      SimulationStatus.moving,
      SimulationStatus.arrived,
    ]);

    await engine.dispose();
    await subscription.cancel();
  });

  test(
    'pause, resume, step, and reset emit the exact state sequence',
    () async {
      final scheduler = FakePeriodicScheduler();
      final engine = RouteSimulationEngine(
        scheduler: scheduler,
        routePath: _route(length: 300),
      );
      final sequence = <({double progress, SimulationStatus status})>[];
      final subscription = engine.states.listen(
        (state) => sequence.add((
          progress: state.routeProgressPixels,
          status: state.status,
        )),
      );

      engine.start();
      scheduler.advanceByMs(100);
      engine.pause();
      scheduler.advanceByMs(500);
      expect(engine.state.routeProgressPixels, 14);
      expect(scheduler.activeTaskCount, 0);

      engine.resume();
      engine.resume();
      expect(scheduler.scheduledTaskCount, 2);
      expect(scheduler.activeTaskCount, 1);
      scheduler.advanceByMs(100);
      engine.stepForward();
      engine.reset();

      expect(sequence, <({double progress, SimulationStatus status})>[
        (progress: 0, status: SimulationStatus.moving),
        (progress: 14, status: SimulationStatus.moving),
        (progress: 14, status: SimulationStatus.paused),
        (progress: 14, status: SimulationStatus.moving),
        (progress: 28, status: SimulationStatus.moving),
        (progress: 124, status: SimulationStatus.paused),
        (progress: 0, status: SimulationStatus.ready),
      ]);

      await engine.dispose();
      await subscription.cancel();
    },
  );

  test(
    'step clamps to arrival and start after arrival restarts at zero',
    () async {
      final scheduler = FakePeriodicScheduler();
      final engine = RouteSimulationEngine(
        scheduler: scheduler,
        routePath: _route(length: 80),
      );

      engine.stepForward();
      expect(engine.state.status, SimulationStatus.arrived);
      expect(engine.state.routeProgressPixels, 80);
      engine.pause();
      expect(engine.state.status, SimulationStatus.arrived);

      engine.start();
      expect(engine.state.status, SimulationStatus.moving);
      expect(engine.state.routeProgressPixels, 0);
      expect(scheduler.activeTaskCount, 1);

      await engine.dispose();
    },
  );

  test(
    'dispose cancels timer, closes states, and suppresses stale ticks',
    () async {
      final scheduler = FakePeriodicScheduler();
      final engine = RouteSimulationEngine(
        scheduler: scheduler,
        routePath: _route(length: 100),
      );
      final states = <RouteSimulationState>[];
      var done = false;
      final subscription = engine.states.listen(
        states.add,
        onDone: () => done = true,
      );
      engine.start();

      await engine.dispose();
      scheduler.advanceByMs(1000);

      expect(done, isTrue);
      expect(scheduler.activeTaskCount, 0);
      expect(states, hasLength(1));
      expect(engine.start, throwsStateError);
      await engine.dispose();
      await subscription.cancel();
    },
  );

  test('rejects an empty route path', () {
    expect(
      () => RouteSimulationEngine(
        scheduler: FakePeriodicScheduler(),
        routePath: const <OverlayPoint>[],
      ),
      throwsArgumentError,
    );
  });
}

List<OverlayPoint> _route({required double length}) {
  return <OverlayPoint>[
    const OverlayPoint(screenX: 0, screenY: 0, tiledX: 10, tiledY: 20),
    OverlayPoint(screenX: length, screenY: 0, tiledX: 10 + length, tiledY: 20),
  ];
}
