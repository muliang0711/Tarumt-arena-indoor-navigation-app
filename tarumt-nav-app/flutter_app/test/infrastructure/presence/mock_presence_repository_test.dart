import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';
import 'package:indoor_navigation/infrastructure/presence/mock_presence_repository.dart';

import '../../support/fakes/fakes.dart';

void main() {
  test(
    'emits deterministic floor snapshots and advances representatives',
    () async {
      final clock = FakeClock(initialNowMs: 1000);
      final scheduler = FakePeriodicScheduler(clock: clock);
      final repository = MockPresenceRepository(
        clock: clock,
        scheduler: scheduler,
        seed: 7,
      );
      final snapshots = <PresenceSnapshot>[];
      final subscription = repository.snapshots.listen(snapshots.add);

      await repository.start(buildingId: 'campus', floorId: 'floor-2');
      expect(snapshots, hasLength(1));
      final first = snapshots.single;
      expect(first.totalAppUsers, 126);
      expect(first.activeUsersOnFloor('floor-2'), 32);
      expect(first.representatives, hasLength(10));
      expect(
        first.representatives,
        everyElement(
          isA<AnonymousPresence>().having(
            (actor) => actor.origin,
            'origin',
            PresenceOrigin.localSimulation,
          ),
        ),
      );
      final firstActor = first.representatives.first;

      scheduler.advanceByMs(mockPresenceTickIntervalMs);
      final second = snapshots.last;
      expect(second.representatives.first.presenceId, firstActor.presenceId);
      expect(second.representatives.first.visualSeed, firstActor.visualSeed);
      expect(
        second.representatives.first.edgeProgress,
        isNot(firstActor.edgeProgress),
      );

      await repository.selectFloor(buildingId: 'campus', floorId: 'floor-4');
      final fourthFloor = snapshots.last;
      expect(fourthFloor.activeUsersOnFloor('floor-4'), 9);
      expect(fourthFloor.representatives, hasLength(9));

      await repository.stop();
      final countAfterStop = snapshots.length;
      scheduler.advanceByMs(mockPresenceTickIntervalMs);
      expect(snapshots, hasLength(countAfterStop));

      await subscription.cancel();
      await repository.dispose();
    },
  );

  test('supports one deterministic actor for hybrid testing', () async {
    final clock = FakeClock(initialNowMs: 1000);
    final repository = MockPresenceRepository(
      clock: clock,
      representativeLimit: 1,
      scheduler: FakePeriodicScheduler(clock: clock),
    );
    final snapshot = repository.snapshots.first;

    await repository.start(buildingId: 'campus', floorId: 'floor-2');

    expect((await snapshot).representatives, hasLength(1));
    await repository.dispose();
  });
}
