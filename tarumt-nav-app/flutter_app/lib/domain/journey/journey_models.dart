enum JourneyOutcome { arrived, cancelled }

enum JourneyRerouteReason {
  wrongWay('wrong_way'),
  congestion('congestion'),
  blockedEdge('blocked_edge'),
  localizationCorrection('localization_correction'),
  userRequested('user_requested');

  const JourneyRerouteReason(this.wireValue);

  final String wireValue;
}

final class PlannedJourneyRoute {
  PlannedJourneyRoute({
    required this.originNodeId,
    required this.destinationNodeId,
    required List<String> plannedEdgeIds,
  }) : plannedEdgeIds = List.unmodifiable(plannedEdgeIds);

  final String originNodeId;
  final String destinationNodeId;
  final List<String> plannedEdgeIds;

  Map<String, Object> toJson() => <String, Object>{
    'origin_node_id': originNodeId,
    'destination_node_id': destinationNodeId,
    'planned_edge_ids': plannedEdgeIds,
  };

  factory PlannedJourneyRoute.fromJson(Map<String, dynamic> source) {
    return PlannedJourneyRoute(
      originNodeId: _string(source, 'origin_node_id'),
      destinationNodeId: _string(source, 'destination_node_id'),
      plannedEdgeIds: _strings(source, 'planned_edge_ids'),
    );
  }

  String get signature =>
      '$originNodeId\u0000$destinationNodeId\u0000${plannedEdgeIds.join("\u0000")}';
}

sealed class JourneyCommand {
  const JourneyCommand({
    required this.clientEventId,
    required this.clientJourneyKey,
    required this.occurredAt,
  });

  final String clientEventId;
  final String clientJourneyKey;
  final DateTime occurredAt;

  String get type;
  Map<String, Object> payload();

  Map<String, Object> toJson() => <String, Object>{
    'type': type,
    'client_event_id': clientEventId,
    'client_journey_key': clientJourneyKey,
    'occurred_at': occurredAt.toUtc().toIso8601String(),
    ...payload(),
  };

  static JourneyCommand fromJson(Map<String, dynamic> source) {
    final occurredAt = DateTime.parse(_string(source, 'occurred_at')).toUtc();
    return switch (_string(source, 'type')) {
      'journey_start' => JourneyStartCommand(
        clientEventId: _string(source, 'client_event_id'),
        clientJourneyKey: _string(source, 'client_journey_key'),
        occurredAt: occurredAt,
        mapId: _string(source, 'map_id'),
        mapRevision: _string(source, 'map_revision'),
        route: PlannedJourneyRoute.fromJson(_map(source, 'planned_route')),
      ),
      'route_recalculate' => JourneyRecalculateCommand(
        clientEventId: _string(source, 'client_event_id'),
        clientJourneyKey: _string(source, 'client_journey_key'),
        occurredAt: occurredAt,
        journeyId: _string(source, 'journey_id'),
        mapId: _string(source, 'map_id'),
        mapRevision: _string(source, 'map_revision'),
        reason: JourneyRerouteReason.values.singleWhere(
          (value) => value.wireValue == _string(source, 'reason'),
        ),
        route: PlannedJourneyRoute.fromJson(_map(source, 'planned_route')),
      ),
      'journey_end' => JourneyEndCommand(
        clientEventId: _string(source, 'client_event_id'),
        clientJourneyKey: _string(source, 'client_journey_key'),
        occurredAt: occurredAt,
        journeyId: _string(source, 'journey_id'),
        outcome: JourneyOutcome.values.byName(_string(source, 'outcome')),
      ),
      final type => throw FormatException('Unknown Journey command: $type'),
    };
  }
}

final class JourneyStartCommand extends JourneyCommand {
  const JourneyStartCommand({
    required super.clientEventId,
    required super.clientJourneyKey,
    required super.occurredAt,
    required this.mapId,
    required this.mapRevision,
    required this.route,
  });

  final String mapId;
  final String mapRevision;
  final PlannedJourneyRoute route;

  @override
  String get type => 'journey_start';

  @override
  Map<String, Object> payload() => <String, Object>{
    'map_id': mapId,
    'map_revision': mapRevision,
    'planned_route': route.toJson(),
  };
}

final class JourneyRecalculateCommand extends JourneyCommand {
  const JourneyRecalculateCommand({
    required super.clientEventId,
    required super.clientJourneyKey,
    required super.occurredAt,
    required this.journeyId,
    required this.mapId,
    required this.mapRevision,
    required this.reason,
    required this.route,
  });

  final String journeyId;
  final String mapId;
  final String mapRevision;
  final JourneyRerouteReason reason;
  final PlannedJourneyRoute route;

  @override
  String get type => 'route_recalculate';

  @override
  Map<String, Object> payload() => <String, Object>{
    'journey_id': journeyId,
    'map_id': mapId,
    'map_revision': mapRevision,
    'reason': reason.wireValue,
    'planned_route': route.toJson(),
  };
}

final class JourneyEndCommand extends JourneyCommand {
  const JourneyEndCommand({
    required super.clientEventId,
    required super.clientJourneyKey,
    required super.occurredAt,
    required this.journeyId,
    required this.outcome,
  });

  final String journeyId;
  final JourneyOutcome outcome;

  @override
  String get type => 'journey_end';

  @override
  Map<String, Object> payload() => <String, Object>{
    'journey_id': journeyId,
    'outcome': outcome.name,
  };
}

final class JourneyAcknowledgement {
  const JourneyAcknowledgement({
    required this.journeyId,
    required this.lifecycleSequence,
    required this.routeRevision,
    required this.deduplicated,
  });

  final String journeyId;
  final int lifecycleSequence;
  final int routeRevision;
  final bool deduplicated;
}

final class JourneyClientState {
  const JourneyClientState({
    required this.navigationSessionId,
    required this.clientJourneyKey,
    required this.journeyId,
    required this.mapId,
    required this.mapRevision,
    required this.route,
    required this.routeRevision,
    required this.desiredEndOutcome,
  });

  final int navigationSessionId;
  final String clientJourneyKey;
  final String? journeyId;
  final String mapId;
  final String mapRevision;
  final PlannedJourneyRoute route;
  final int routeRevision;
  final JourneyOutcome? desiredEndOutcome;

  JourneyClientState copyWith({
    String? journeyId,
    bool clearJourneyId = false,
    PlannedJourneyRoute? route,
    int? routeRevision,
    JourneyOutcome? desiredEndOutcome,
    bool clearDesiredEnd = false,
  }) {
    return JourneyClientState(
      navigationSessionId: navigationSessionId,
      clientJourneyKey: clientJourneyKey,
      journeyId: clearJourneyId ? null : journeyId ?? this.journeyId,
      mapId: mapId,
      mapRevision: mapRevision,
      route: route ?? this.route,
      routeRevision: routeRevision ?? this.routeRevision,
      desiredEndOutcome: clearDesiredEnd
          ? null
          : desiredEndOutcome ?? this.desiredEndOutcome,
    );
  }

  Map<String, Object?> toJson() => <String, Object?>{
    'navigation_session_id': navigationSessionId,
    'client_journey_key': clientJourneyKey,
    'journey_id': journeyId,
    'map_id': mapId,
    'map_revision': mapRevision,
    'route': route.toJson(),
    'route_revision': routeRevision,
    'desired_end_outcome': desiredEndOutcome?.name,
  };

  factory JourneyClientState.fromJson(Map<String, dynamic> source) {
    final outcome = source['desired_end_outcome'];
    return JourneyClientState(
      navigationSessionId: _integer(source, 'navigation_session_id'),
      clientJourneyKey: _string(source, 'client_journey_key'),
      journeyId: source['journey_id'] as String?,
      mapId: _string(source, 'map_id'),
      mapRevision: _string(source, 'map_revision'),
      route: PlannedJourneyRoute.fromJson(_map(source, 'route')),
      routeRevision: _integer(source, 'route_revision'),
      desiredEndOutcome: outcome is String
          ? JourneyOutcome.values.byName(outcome)
          : null,
    );
  }
}

final class JourneyOutboxSnapshot {
  JourneyOutboxSnapshot({
    required List<JourneyCommand> pending,
    required this.state,
  }) : pending = List.unmodifiable(pending);

  const JourneyOutboxSnapshot.empty() : pending = const [], state = null;

  final List<JourneyCommand> pending;
  final JourneyClientState? state;
}

Map<String, dynamic> _map(Map<String, dynamic> source, String key) {
  final value = source[key];
  if (value is Map<String, dynamic>) return value;
  throw FormatException('$key must be an object');
}

String _string(Map<String, dynamic> source, String key) {
  final value = source[key];
  if (value is String && value.trim().isNotEmpty) return value;
  throw FormatException('$key must be a non-empty string');
}

int _integer(Map<String, dynamic> source, String key) {
  final value = source[key];
  if (value is int) return value;
  throw FormatException('$key must be an integer');
}

List<String> _strings(Map<String, dynamic> source, String key) {
  final value = source[key];
  if (value is List<dynamic> &&
      value.isNotEmpty &&
      value.every((element) => element is String && element.isNotEmpty)) {
    return value.cast<String>();
  }
  throw FormatException('$key must be a non-empty string array');
}
