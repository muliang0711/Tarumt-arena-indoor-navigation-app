enum PresenceActivity { idle, walking, recentlyJoined }

enum PresenceOrigin { localSimulation, remote }

const maxPresenceRepresentatives = 10;

final class AnonymousPresence {
  const AnonymousPresence({
    required this.activity,
    required this.buildingId,
    this.displayName,
    required this.edgeProgress,
    required this.floorId,
    required this.fromNodeId,
    required this.headingDegrees,
    required this.origin,
    required this.presenceId,
    required this.sequence,
    required this.toNodeId,
    required this.updatedAt,
    required this.visualSeed,
  });

  final PresenceActivity activity;
  final String buildingId;
  final String? displayName;
  final double edgeProgress;
  final String floorId;
  final String fromNodeId;
  final double headingDegrees;
  final PresenceOrigin origin;
  final String presenceId;
  final int sequence;
  final String toNodeId;
  final DateTime updatedAt;
  final int visualSeed;
}

final class FloorOccupancy {
  const FloorOccupancy({required this.activeUsers, required this.floorId});

  final int activeUsers;
  final String floorId;
}

final class EdgeOccupancy {
  const EdgeOccupancy({
    required this.activeUsers,
    required this.fromNodeId,
    required this.toNodeId,
  });

  final int activeUsers;
  final String fromNodeId;
  final String toNodeId;
}

final class PresenceSnapshot {
  PresenceSnapshot({
    required this.buildingId,
    required this.buildingUsers,
    required this.floorId,
    required List<FloorOccupancy> floors,
    List<EdgeOccupancy> edgeOccupancies = const <EdgeOccupancy>[],
    required this.generatedAt,
    required List<AnonymousPresence> representatives,
    required this.totalAppUsers,
  }) : edgeOccupancies = List.unmodifiable(edgeOccupancies),
       floors = List.unmodifiable(floors),
       representatives = List.unmodifiable(representatives);

  final String buildingId;
  final int buildingUsers;
  final List<EdgeOccupancy> edgeOccupancies;
  final String floorId;
  final List<FloorOccupancy> floors;
  final DateTime generatedAt;
  final List<AnonymousPresence> representatives;
  final int totalAppUsers;

  int activeUsersOnFloor(String floorId) {
    for (final floor in floors) {
      if (floor.floorId == floorId) {
        return floor.activeUsers;
      }
    }
    return 0;
  }
}
