import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/presence/installation_identity_store.dart';
import 'package:indoor_navigation/domain/presence/presence_connection.dart';
import 'package:indoor_navigation/infrastructure/presence/http/anonymous_session_api.dart';
import 'package:indoor_navigation/infrastructure/presence/websocket/realtime_presence_repository.dart';

void main() {
  final configuredUrl = Platform.environment['PRESENCE_INTEGRATION_BASE_URL'];

  test(
    'observed floor is independent from the published location floor',
    () async {
      final baseUrl = Uri.parse(configuredUrl!);
      final publisher = _repository(baseUrl, 'publisher-installation-id-0001');
      final observer = _repository(baseUrl, 'observer-installation-id-0002');
      addTearDown(publisher.dispose);
      addTearDown(observer.dispose);

      final publisherConnected = publisher.connectionStates.firstWhere(
        (state) => state.phase == PresenceConnectionPhase.connected,
      );
      final observerConnected = observer.connectionStates.firstWhere(
        (state) => state.phase == PresenceConnectionPhase.connected,
      );
      final observerSnapshot = observer.snapshots.first;
      await Future.wait<void>([
        publisher.connect(),
        observer.start(buildingId: 'main-campus', floorId: 'floor-2'),
      ]);
      await Future.wait([publisherConnected, observerConnected]);
      expect(
        publisher.connectionState.phase,
        PresenceConnectionPhase.connected,
      );
      expect(observer.connectionState.phase, PresenceConnectionPhase.connected);
      expect((await observerSnapshot).floorId, 'floor-2');

      final actorVisible = observer.snapshots.firstWhere(
        (snapshot) => snapshot.representatives.isNotEmpty,
      );
      await publisher.publishLocation(
        LocalPresencePosition(
          buildingId: 'main-campus',
          edgeProgress: 0.35,
          floorId: 'floor-2',
          fromNodeId: 'node-21',
          headingDegrees: 90,
          movementState: PresenceMovementState.walking,
          observedAt: DateTime.now().toUtc(),
          toNodeId: 'node-20',
        ),
      );

      final snapshot = await actorVisible.timeout(const Duration(seconds: 5));
      expect(snapshot.floorId, 'floor-2');
      expect(snapshot.representatives.single.edgeProgress, 0.35);

      final actorRemoved = observer.snapshots.firstWhere(
        (snapshot) => snapshot.representatives.isEmpty,
      );
      await publisher.leave();
      expect(
        (await actorRemoved.timeout(
          const Duration(seconds: 5),
        )).representatives,
        isEmpty,
      );
      expect(
        publisher.connectionState.phase,
        PresenceConnectionPhase.connected,
      );

      final publisherSnapshot = publisher.snapshots.first;
      await publisher.start(buildingId: 'main-campus', floorId: 'floor-3');
      expect((await publisherSnapshot).floorId, 'floor-3');
    },
    skip: configuredUrl == null
        ? 'Set PRESENCE_INTEGRATION_BASE_URL to run the real gateway test.'
        : false,
  );
}

RealtimePresenceRepository _repository(Uri baseUrl, String installationId) =>
    RealtimePresenceRepository(
      baseUrl: baseUrl,
      identityStore: _MemoryIdentityStore(installationId),
      sessionApi: AnonymousSessionApi(baseUrl: baseUrl),
    );

final class _MemoryIdentityStore implements InstallationIdentityStore {
  _MemoryIdentityStore(this._value);

  String? _value;

  @override
  Future<String?> read() async => _value;

  @override
  Future<void> write(String installationId) async => _value = installationId;
}
