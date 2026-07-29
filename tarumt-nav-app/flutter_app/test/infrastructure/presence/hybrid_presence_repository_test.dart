import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/presence/presence_repository.dart';
import 'package:indoor_navigation/domain/presence/presence_connection.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';
import 'package:indoor_navigation/infrastructure/presence/hybrid_presence_repository.dart';

void main() {
  test(
    'combines one local sentinel with one remote actor by default',
    () async {
      final local = _ControlledPresenceRepository(
        connectionState: const PresenceConnectionState.simulated(),
        isSimulated: true,
      );
      final remote = _ControlledPresenceRepository(
        connectionState: const PresenceConnectionState(
          phase: PresenceConnectionPhase.connected,
        ),
        isSimulated: false,
      );
      final repository = HybridPresenceRepository(
        localRepository: local,
        remoteRepository: remote,
      );
      addTearDown(repository.dispose);
      final snapshots = <PresenceSnapshot>[];
      final subscription = repository.snapshots.listen(snapshots.add);
      addTearDown(subscription.cancel);

      await repository.start(buildingId: 'main-campus', floorId: 'floor-2');
      local.emitSnapshot(
        _snapshot(
          representatives: [
            _actor('local-1', PresenceOrigin.localSimulation),
            _actor('local-2', PresenceOrigin.localSimulation),
          ],
        ),
      );
      remote.emitSnapshot(
        _snapshot(
          buildingUsers: 7,
          representatives: [
            _actor('remote-1', PresenceOrigin.remote),
            _actor('remote-2', PresenceOrigin.remote),
          ],
          totalAppUsers: 11,
        ),
      );

      expect(snapshots.last.buildingUsers, 7);
      expect(snapshots.last.totalAppUsers, 11);
      expect(
        snapshots.last.representatives.map((actor) => actor.presenceId),
        <String>['local-1', 'remote-1'],
      );
      expect(
        snapshots.last.representatives.map((actor) => actor.origin),
        <PresenceOrigin>[PresenceOrigin.localSimulation, PresenceOrigin.remote],
      );

      final published = LocalPresencePosition(
        buildingId: 'main-campus',
        edgeProgress: 0.5,
        floorId: 'floor-2',
        fromNodeId: 'node-21',
        headingDegrees: 0,
        movementState: PresenceMovementState.walking,
        observedAt: DateTime.utc(2026, 7, 28),
        toNodeId: 'node-20',
      );
      await repository.publishLocation(published);
      expect(local.publishedPositions, isEmpty);
      expect(remote.publishedPositions, <LocalPresencePosition>[published]);
    },
  );

  test('clears stale remote actors when the server disconnects', () async {
    final local = _ControlledPresenceRepository(
      connectionState: const PresenceConnectionState.simulated(),
      isSimulated: true,
    );
    final remote = _ControlledPresenceRepository(
      connectionState: const PresenceConnectionState(
        phase: PresenceConnectionPhase.connected,
      ),
      isSimulated: false,
    );
    final repository = HybridPresenceRepository(
      localRepository: local,
      remoteRepository: remote,
    );
    addTearDown(repository.dispose);
    final snapshots = <PresenceSnapshot>[];
    final subscription = repository.snapshots.listen(snapshots.add);
    addTearDown(subscription.cancel);

    await repository.start(buildingId: 'main-campus', floorId: 'floor-2');
    local.emitSnapshot(
      _snapshot(
        representatives: [_actor('local-1', PresenceOrigin.localSimulation)],
      ),
    );
    remote.emitSnapshot(
      _snapshot(representatives: [_actor('remote-1', PresenceOrigin.remote)]),
    );
    expect(snapshots.last.representatives, hasLength(2));

    remote.emitConnection(
      const PresenceConnectionState(
        phase: PresenceConnectionPhase.reconnecting,
        attempt: 1,
      ),
    );

    expect(
      snapshots.last.representatives.map((actor) => actor.presenceId),
      <String>['local-1'],
    );
    expect(
      repository.connectionState.phase,
      PresenceConnectionPhase.reconnecting,
    );
  });

  test('never exposes more than ten combined representatives', () async {
    final local = _ControlledPresenceRepository(
      connectionState: const PresenceConnectionState.simulated(),
      isSimulated: true,
    );
    final remote = _ControlledPresenceRepository(
      connectionState: const PresenceConnectionState(
        phase: PresenceConnectionPhase.connected,
      ),
      isSimulated: false,
    );
    final repository = HybridPresenceRepository(
      localRepository: local,
      remoteRepresentativeLimit: 9,
      remoteRepository: remote,
    );
    addTearDown(repository.dispose);
    final snapshots = <PresenceSnapshot>[];
    final subscription = repository.snapshots.listen(snapshots.add);
    addTearDown(subscription.cancel);

    await repository.start(buildingId: 'main-campus', floorId: 'floor-2');
    local.emitSnapshot(
      _snapshot(
        representatives: [_actor('local-1', PresenceOrigin.localSimulation)],
      ),
    );
    remote.emitSnapshot(
      _snapshot(
        representatives: [
          for (var index = 0; index < 10; index += 1)
            _actor('remote-$index', PresenceOrigin.remote),
        ],
      ),
    );

    expect(snapshots.last.representatives, hasLength(10));
    expect(
      snapshots.last.representatives.first.origin,
      PresenceOrigin.localSimulation,
    );
    expect(
      snapshots.last.representatives.skip(1),
      everyElement(
        isA<AnonymousPresence>().having(
          (actor) => actor.origin,
          'origin',
          PresenceOrigin.remote,
        ),
      ),
    );
  });
}

final class _ControlledPresenceRepository implements PresenceRepository {
  _ControlledPresenceRepository({
    required this._connectionState,
    required this.isSimulated,
  });

  final StreamController<PresenceConnectionState> _connections =
      StreamController<PresenceConnectionState>.broadcast(sync: true);
  final StreamController<PresenceSnapshot> _snapshots =
      StreamController<PresenceSnapshot>.broadcast(sync: true);
  final List<LocalPresencePosition> publishedPositions =
      <LocalPresencePosition>[];
  PresenceConnectionState _connectionState;

  @override
  PresenceConnectionState get connectionState => _connectionState;

  @override
  Stream<PresenceConnectionState> get connectionStates => _connections.stream;

  @override
  final bool isSimulated;

  @override
  Stream<PresenceSnapshot> get snapshots => _snapshots.stream;

  void emitConnection(PresenceConnectionState value) {
    _connectionState = value;
    _connections.add(value);
  }

  void emitSnapshot(PresenceSnapshot value) => _snapshots.add(value);

  @override
  Future<void> connect() async {}

  @override
  Future<void> disconnect() async {}

  @override
  Future<void> dispose() async {
    await _connections.close();
    await _snapshots.close();
  }

  @override
  Future<void> leave() async {}

  @override
  Future<void> publishLocation(LocalPresencePosition position) async {
    publishedPositions.add(position);
  }

  @override
  Future<void> selectFloor({
    required String buildingId,
    required String floorId,
  }) async {}

  @override
  Future<void> start({
    required String buildingId,
    required String floorId,
  }) async {}

  @override
  Future<void> stop() async {}
}

PresenceSnapshot _snapshot({
  int buildingUsers = 1,
  required List<AnonymousPresence> representatives,
  int totalAppUsers = 1,
}) => PresenceSnapshot(
  buildingId: 'main-campus',
  buildingUsers: buildingUsers,
  floorId: 'floor-2',
  floors: const [FloorOccupancy(activeUsers: 1, floorId: 'floor-2')],
  generatedAt: DateTime.utc(2026, 7, 28),
  representatives: representatives,
  totalAppUsers: totalAppUsers,
);

AnonymousPresence _actor(String id, PresenceOrigin origin) => AnonymousPresence(
  activity: PresenceActivity.walking,
  buildingId: 'main-campus',
  edgeProgress: 0.5,
  floorId: 'floor-2',
  fromNodeId: 'node-21',
  headingDegrees: 0,
  origin: origin,
  presenceId: id,
  sequence: 1,
  toNodeId: 'node-20',
  updatedAt: DateTime.utc(2026, 7, 28),
  visualSeed: id.hashCode,
);
