import 'package:indoor_navigation/domain/journey/journey.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';

sealed class PresenceServerEvent {
  const PresenceServerEvent();
}

final class PresenceSessionReady extends PresenceServerEvent {
  const PresenceSessionReady({required this.heartbeatSeconds});

  final int heartbeatSeconds;
}

final class PresenceSnapshotReceived extends PresenceServerEvent {
  const PresenceSnapshotReceived(this.snapshot);

  final PresenceSnapshot snapshot;
}

final class PresenceActorChanged extends PresenceServerEvent {
  const PresenceActorChanged({required this.actor, required this.joined});

  final AnonymousPresence actor;
  final bool joined;
}

final class PresenceActorLeft extends PresenceServerEvent {
  const PresenceActorLeft(this.actorId);

  final String actorId;
}

final class PresenceEdgeOccupancyChanged extends PresenceServerEvent {
  PresenceEdgeOccupancyChanged({
    required this.buildingId,
    required List<EdgeOccupancy> edgeOccupancies,
    required this.floorId,
    required this.generatedAt,
  }) : edgeOccupancies = List.unmodifiable(edgeOccupancies);

  final String buildingId;
  final List<EdgeOccupancy> edgeOccupancies;
  final String floorId;
  final DateTime generatedAt;
}

final class PresenceAcknowledged extends PresenceServerEvent {
  const PresenceAcknowledged({required this.requestId, this.journey});

  final JourneyAcknowledgement? journey;
  final String requestId;
}

final class PresenceProtocolFailure extends PresenceServerEvent {
  const PresenceProtocolFailure({
    required this.code,
    required this.message,
    required this.retryable,
    required this.requestId,
  });

  final String code;
  final String message;
  final bool retryable;
  final String requestId;
}
