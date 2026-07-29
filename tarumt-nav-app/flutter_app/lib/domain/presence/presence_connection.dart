enum PresenceConnectionPhase {
  simulated,
  disconnected,
  connecting,
  connected,
  reconnecting,
  offline,
}

final class PresenceConnectionState {
  const PresenceConnectionState({
    required this.phase,
    this.attempt = 0,
    this.error,
  });

  const PresenceConnectionState.simulated()
    : this(phase: PresenceConnectionPhase.simulated);

  const PresenceConnectionState.disconnected()
    : this(phase: PresenceConnectionPhase.disconnected);

  final int attempt;
  final Object? error;
  final PresenceConnectionPhase phase;

  bool get isConnected => phase == PresenceConnectionPhase.connected;
}

enum PresenceMovementState { idle, walking }

final class LocalPresencePosition {
  const LocalPresencePosition({
    required this.buildingId,
    required this.edgeProgress,
    required this.floorId,
    required this.fromNodeId,
    required this.headingDegrees,
    required this.movementState,
    required this.toNodeId,
    required this.observedAt,
  });

  final String buildingId;
  final double edgeProgress;
  final String floorId;
  final String fromNodeId;
  final double headingDegrees;
  final PresenceMovementState movementState;
  final DateTime observedAt;
  final String toNodeId;
}
