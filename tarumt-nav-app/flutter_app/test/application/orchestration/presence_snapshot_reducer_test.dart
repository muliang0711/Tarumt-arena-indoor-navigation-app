import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/presence/presence_snapshot_reducer.dart';
import 'package:indoor_navigation/domain/presence/presence_events.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';

void main() {
  test('replaces snapshots and rejects stale actor sequences', () {
    final reducer = PresenceSnapshotReducer();
    reducer.apply(PresenceSnapshotReceived(_snapshot(_actor('a', 5, 0.2))));

    reducer.apply(
      PresenceActorChanged(actor: _actor('a', 4, 0.8), joined: false),
    );
    expect(reducer.snapshot!.representatives.single.edgeProgress, 0.2);

    reducer.apply(
      PresenceActorChanged(actor: _actor('a', 6, 0.8), joined: false),
    );
    expect(reducer.snapshot!.representatives.single.edgeProgress, 0.8);
  });

  test('ignores another floor and removes only the matching actor', () {
    final reducer = PresenceSnapshotReducer();
    reducer.apply(
      PresenceSnapshotReceived(
        _snapshot(_actor('a', 1, 0.1), extra: _actor('b', 1, 0.2)),
      ),
    );
    reducer.apply(
      PresenceActorChanged(
        actor: _actor('other', 1, 0.5, floorId: 'floor-3'),
        joined: true,
      ),
    );
    expect(reducer.snapshot!.representatives, hasLength(2));

    reducer.apply(const PresenceActorLeft('a'));
    expect(
      reducer.snapshot!.representatives.map((actor) => actor.presenceId),
      <String>['b'],
    );
  });

  test('merges changed edge counts and removes zero-count edges', () {
    final reducer = PresenceSnapshotReducer();
    reducer.apply(
      PresenceSnapshotReceived(
        _snapshot(
          _actor('a', 1, 0.1),
          edgeOccupancies: const <EdgeOccupancy>[
            EdgeOccupancy(
              activeUsers: 2,
              fromNodeId: 'node-20',
              toNodeId: 'node-21',
            ),
          ],
        ),
      ),
    );

    reducer.apply(
      PresenceEdgeOccupancyChanged(
        buildingId: 'main-campus',
        floorId: 'floor-2',
        edgeOccupancies: const <EdgeOccupancy>[
          EdgeOccupancy(
            activeUsers: 0,
            fromNodeId: 'node-21',
            toNodeId: 'node-20',
          ),
          EdgeOccupancy(
            activeUsers: 3,
            fromNodeId: 'node-21',
            toNodeId: 'node-22',
          ),
        ],
        generatedAt: DateTime.utc(2026, 7, 22, 0, 0, 1),
      ),
    );

    expect(reducer.snapshot!.edgeOccupancies, hasLength(1));
    expect(reducer.snapshot!.edgeOccupancies.single.activeUsers, 3);
  });
}

PresenceSnapshot _snapshot(
  AnonymousPresence actor, {
  List<EdgeOccupancy> edgeOccupancies = const <EdgeOccupancy>[],
  AnonymousPresence? extra,
}) => PresenceSnapshot(
  buildingId: 'main-campus',
  buildingUsers: 2,
  edgeOccupancies: edgeOccupancies,
  floorId: 'floor-2',
  floors: const <FloorOccupancy>[
    FloorOccupancy(activeUsers: 2, floorId: 'floor-2'),
  ],
  generatedAt: DateTime.utc(2026, 7, 22),
  representatives: <AnonymousPresence>[actor, ?extra],
  totalAppUsers: 4,
);

AnonymousPresence _actor(
  String id,
  int sequence,
  double progress, {
  String floorId = 'floor-2',
}) => AnonymousPresence(
  activity: PresenceActivity.walking,
  buildingId: 'main-campus',
  edgeProgress: progress,
  floorId: floorId,
  fromNodeId: 'node-21',
  headingDegrees: 0,
  origin: PresenceOrigin.remote,
  presenceId: id,
  sequence: sequence,
  toNodeId: 'node-20',
  updatedAt: DateTime.utc(2026, 7, 22),
  visualSeed: id.hashCode,
);
