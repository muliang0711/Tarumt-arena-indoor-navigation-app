import 'package:indoor_navigation/domain/presence/presence_connection.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';

abstract interface class PresenceRepository {
  PresenceConnectionState get connectionState;

  Stream<PresenceConnectionState> get connectionStates;

  bool get isSimulated;

  Stream<PresenceSnapshot> get snapshots;

  Future<void> connect();

  Future<void> start({required String buildingId, required String floorId});

  Future<void> selectFloor({
    required String buildingId,
    required String floorId,
  });

  Future<void> stop();

  Future<void> disconnect();

  Future<void> publishLocation(LocalPresencePosition position);

  Future<void> leave();

  Future<void> dispose();
}
