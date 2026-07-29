import 'package:indoor_navigation/application/ports/presence/presence_repository.dart';
import 'package:indoor_navigation/domain/presence/presence_connection.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';

final class DisabledPresenceRepository implements PresenceRepository {
  const DisabledPresenceRepository();

  @override
  PresenceConnectionState get connectionState =>
      const PresenceConnectionState(phase: PresenceConnectionPhase.offline);

  @override
  Stream<PresenceConnectionState> get connectionStates =>
      Stream<PresenceConnectionState>.value(
        const PresenceConnectionState(phase: PresenceConnectionPhase.offline),
      );

  @override
  bool get isSimulated => false;

  @override
  Stream<PresenceSnapshot> get snapshots =>
      const Stream<PresenceSnapshot>.empty();

  @override
  Future<void> connect() async {}

  @override
  Future<void> disconnect() async {}

  @override
  Future<void> dispose() async {}

  @override
  Future<void> leave() async {}

  @override
  Future<void> publishLocation(LocalPresencePosition position) async {}

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
