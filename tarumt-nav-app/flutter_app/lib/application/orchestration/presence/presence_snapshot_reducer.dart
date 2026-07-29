import 'package:indoor_navigation/domain/presence/presence_events.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';

final class PresenceSnapshotReducer {
  PresenceSnapshot? _snapshot;

  PresenceSnapshot? get snapshot => _snapshot;

  PresenceSnapshot? apply(PresenceServerEvent event) {
    switch (event) {
      case PresenceSnapshotReceived(:final snapshot):
        _snapshot = snapshot;
      case PresenceActorChanged(:final actor):
        final current = _snapshot;
        if (current == null ||
            actor.buildingId != current.buildingId ||
            actor.floorId != current.floorId) {
          return _snapshot;
        }
        final actors = <AnonymousPresence>[...current.representatives];
        final index = actors.indexWhere(
          (candidate) => candidate.presenceId == actor.presenceId,
        );
        if (index >= 0) {
          if (actor.sequence <= actors[index].sequence) return _snapshot;
          actors[index] = actor;
        } else if (actors.length < maxPresenceRepresentatives) {
          actors.add(actor);
        }
        _snapshot = _copy(current, representatives: actors);
      case PresenceActorLeft(:final actorId):
        final current = _snapshot;
        if (current == null) return null;
        final actors = current.representatives
            .where((actor) => actor.presenceId != actorId)
            .toList(growable: false);
        if (actors.length != current.representatives.length) {
          _snapshot = _copy(current, representatives: actors);
        }
      case PresenceEdgeOccupancyChanged(
        :final buildingId,
        :final edgeOccupancies,
        :final floorId,
        :final generatedAt,
      ):
        final current = _snapshot;
        if (current == null ||
            current.buildingId != buildingId ||
            current.floorId != floorId) {
          return current;
        }
        final occupancies = <String, EdgeOccupancy>{
          for (final occupancy in current.edgeOccupancies)
            _edgeKey(occupancy.fromNodeId, occupancy.toNodeId): occupancy,
        };
        for (final occupancy in edgeOccupancies) {
          final key = _edgeKey(occupancy.fromNodeId, occupancy.toNodeId);
          if (occupancy.activeUsers <= 0) {
            occupancies.remove(key);
          } else {
            occupancies[key] = occupancy;
          }
        }
        _snapshot = _copy(
          current,
          edgeOccupancies: occupancies.values.toList(growable: false),
          generatedAt: generatedAt,
          representatives: current.representatives,
        );
      case PresenceSessionReady() ||
          PresenceAcknowledged() ||
          PresenceProtocolFailure():
        break;
    }
    return _snapshot;
  }

  void reset() => _snapshot = null;
}

PresenceSnapshot _copy(
  PresenceSnapshot source, {
  List<EdgeOccupancy>? edgeOccupancies,
  DateTime? generatedAt,
  required List<AnonymousPresence> representatives,
}) => PresenceSnapshot(
  buildingId: source.buildingId,
  buildingUsers: source.buildingUsers,
  edgeOccupancies: edgeOccupancies ?? source.edgeOccupancies,
  floors: source.floors,
  floorId: source.floorId,
  generatedAt: generatedAt ?? DateTime.now().toUtc(),
  representatives: representatives,
  totalAppUsers: source.totalAppUsers,
);

String _edgeKey(String firstNodeId, String secondNodeId) {
  return firstNodeId.compareTo(secondNodeId) <= 0
      ? '$firstNodeId\u0000$secondNodeId'
      : '$secondNodeId\u0000$firstNodeId';
}
