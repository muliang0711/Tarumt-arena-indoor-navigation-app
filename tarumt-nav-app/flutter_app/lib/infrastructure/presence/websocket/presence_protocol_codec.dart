import 'dart:convert';

import 'package:indoor_navigation/domain/journey/journey.dart';
import 'package:indoor_navigation/domain/presence/presence_connection.dart';
import 'package:indoor_navigation/domain/presence/presence_events.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';

const presenceProtocolVersion = 1;

final class PresenceProtocolException implements Exception {
  const PresenceProtocolException(this.message);

  final String message;

  @override
  String toString() => 'PresenceProtocolException: $message';
}

final class PresenceProtocolCodec {
  const PresenceProtocolCodec();

  PresenceServerEvent decode(Object? data) {
    final decoded = jsonDecode(_text(data));
    final envelope = _map(decoded, 'envelope');
    if (_integer(envelope, 'version') != presenceProtocolVersion) {
      throw const PresenceProtocolException('unsupported protocol version');
    }
    DateTime.parse(_string(envelope, 'timestamp'));
    final type = _string(envelope, 'type');
    final requestId = _optionalString(envelope, 'request_id') ?? '';
    final payload = envelope['payload'] == null
        ? const <String, dynamic>{}
        : _map(envelope['payload'], 'payload');
    return switch (type) {
      'session_ready' => PresenceSessionReady(
        heartbeatSeconds: _integer(payload, 'heartbeat_seconds'),
      ),
      'floor_snapshot' ||
      'occupancy_updated' => PresenceSnapshotReceived(_snapshot(payload)),
      'presence_joined' => PresenceActorChanged(
        actor: _actor(_map(payload['actor'], 'payload.actor'), joined: true),
        joined: true,
      ),
      'presence_updated' => PresenceActorChanged(
        actor: _actor(_map(payload['actor'], 'payload.actor')),
        joined: false,
      ),
      'presence_left' => PresenceActorLeft(_string(payload, 'actor_id')),
      'edge_occupancy_updated' => PresenceEdgeOccupancyChanged(
        buildingId: _string(payload, 'building_id'),
        edgeOccupancies: _edgeOccupancies(payload),
        floorId: _string(payload, 'floor_id'),
        generatedAt: DateTime.parse(_string(payload, 'generated_at')).toUtc(),
      ),
      'ack' => PresenceAcknowledged(
        requestId: requestId,
        journey: payload['journey_id'] == null
            ? null
            : JourneyAcknowledgement(
                journeyId: _string(payload, 'journey_id'),
                lifecycleSequence: _integer(payload, 'lifecycle_sequence'),
                routeRevision: _integer(payload, 'route_revision'),
                deduplicated:
                    _optionalBoolean(payload, 'deduplicated') ?? false,
              ),
      ),
      'pong' => PresenceAcknowledged(requestId: requestId),
      'error' => PresenceProtocolFailure(
        code: _string(payload, 'code'),
        message: _string(payload, 'message'),
        retryable: _boolean(payload, 'retryable'),
        requestId: requestId,
      ),
      _ => throw PresenceProtocolException('unknown server message: $type'),
    };
  }

  String subscribeFloor({
    required String buildingId,
    required String floorId,
    required String requestId,
  }) => _encode(
    type: 'subscribe_floor',
    requestId: requestId,
    payload: <String, Object>{'building_id': buildingId, 'floor_id': floorId},
  );

  String locationUpdate({
    required LocalPresencePosition position,
    required String requestId,
    required int sequence,
  }) => _encode(
    type: 'location_update',
    requestId: requestId,
    sequence: sequence,
    payload: <String, Object>{
      'position': <String, Object>{
        'building_id': position.buildingId,
        'floor_id': position.floorId,
        'from_node_id': position.fromNodeId,
        'to_node_id': position.toNodeId,
        'edge_progress': position.edgeProgress.clamp(0, 1),
        'heading': _normalizeHeading(position.headingDegrees),
        'movement_state': position.movementState.name,
      },
    },
  );

  String heartbeat(String requestId) =>
      _encode(type: 'heartbeat', requestId: requestId);

  String leave(String requestId) =>
      _encode(type: 'leave', requestId: requestId);

  String journeyCommand({
    required JourneyCommand command,
    required String requestId,
  }) => _encode(
    type: command.type,
    requestId: requestId,
    timestamp: command.occurredAt,
    payload: command.toJson()
      ..remove('type')
      ..remove('occurred_at'),
  );

  String _encode({
    required String type,
    required String requestId,
    int sequence = 0,
    Map<String, Object>? payload,
    DateTime? timestamp,
  }) => jsonEncode(<String, Object>{
    'version': presenceProtocolVersion,
    'type': type,
    'request_id': requestId,
    if (sequence > 0) 'sequence': sequence,
    'timestamp': (timestamp ?? DateTime.now()).toUtc().toIso8601String(),
    'payload': ?payload,
  });

  PresenceSnapshot _snapshot(Map<String, dynamic> payload) {
    final representatives = _list(payload, 'representatives')
        .map((value) => _actor(_map(value, 'representative')))
        .take(10)
        .toList(growable: false);
    final floors = _optionalList(payload, 'floor_counts')
        .map((value) {
          final floor = _map(value, 'floor_count');
          return FloorOccupancy(
            activeUsers: _integer(floor, 'count'),
            floorId: _string(floor, 'floor_id'),
          );
        })
        .toList(growable: false);
    return PresenceSnapshot(
      buildingId: _string(payload, 'building_id'),
      buildingUsers: _integer(payload, 'building_active_users'),
      edgeOccupancies: _edgeOccupancies(payload),
      floorId: _string(payload, 'floor_id'),
      floors: floors,
      generatedAt: DateTime.parse(_string(payload, 'generated_at')).toUtc(),
      representatives: representatives,
      totalAppUsers: _integer(payload, 'total_active_users'),
    );
  }

  List<EdgeOccupancy> _edgeOccupancies(Map<String, dynamic> payload) {
    return _optionalList(payload, 'edge_occupancies')
        .map((value) {
          final edge = _map(value, 'edge_occupancy');
          return EdgeOccupancy(
            activeUsers: _integer(edge, 'active_users'),
            fromNodeId: _string(edge, 'from_node_id'),
            toNodeId: _string(edge, 'to_node_id'),
          );
        })
        .toList(growable: false);
  }

  AnonymousPresence _actor(Map<String, dynamic> source, {bool joined = false}) {
    final position = _map(source['position'], 'actor.position');
    final movement = _string(position, 'movement_state');
    return AnonymousPresence(
      activity: joined
          ? PresenceActivity.recentlyJoined
          : movement == 'walking'
          ? PresenceActivity.walking
          : PresenceActivity.idle,
      buildingId: _string(position, 'building_id'),
      edgeProgress: _number(position, 'edge_progress'),
      floorId: _string(position, 'floor_id'),
      fromNodeId: _string(position, 'from_node_id'),
      headingDegrees: _number(position, 'heading'),
      origin: PresenceOrigin.remote,
      presenceId: _string(source, 'actor_id'),
      sequence: _integer(source, 'sequence'),
      toNodeId: _string(position, 'to_node_id'),
      updatedAt: DateTime.parse(_string(source, 'updated_at')).toUtc(),
      visualSeed: _stableVisualSeed(_string(source, 'actor_id')),
    );
  }
}

String _text(Object? value) {
  if (value is String) return value;
  if (value is List<int>) return utf8.decode(value);
  throw const PresenceProtocolException('websocket message is not text');
}

Map<String, dynamic> _map(Object? value, String path) {
  if (value is Map<String, dynamic>) return value;
  throw PresenceProtocolException('$path is not an object');
}

List<dynamic> _list(Map<String, dynamic> source, String key) {
  final value = source[key];
  if (value is List<dynamic>) return value;
  throw PresenceProtocolException('$key is not an array');
}

List<dynamic> _optionalList(Map<String, dynamic> source, String key) {
  final value = source[key];
  if (value == null) return const <dynamic>[];
  if (value is List<dynamic>) return value;
  throw PresenceProtocolException('$key is not an array');
}

String _string(Map<String, dynamic> source, String key) {
  final value = source[key];
  if (value is String && value.isNotEmpty) return value;
  throw PresenceProtocolException('$key is not a string');
}

int _integer(Map<String, dynamic> source, String key) {
  final value = source[key];
  if (value is int) return value;
  throw PresenceProtocolException('$key is not an integer');
}

double _number(Map<String, dynamic> source, String key) {
  final value = source[key];
  if (value is num) return value.toDouble();
  throw PresenceProtocolException('$key is not a number');
}

bool _boolean(Map<String, dynamic> source, String key) {
  final value = source[key];
  if (value is bool) return value;
  throw PresenceProtocolException('$key is not a boolean');
}

String? _optionalString(Map<String, dynamic> source, String key) {
  final value = source[key];
  return value is String && value.isNotEmpty ? value : null;
}

bool? _optionalBoolean(Map<String, dynamic> source, String key) {
  final value = source[key];
  return value is bool ? value : null;
}

double _normalizeHeading(double heading) {
  final normalized = heading % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

int _stableVisualSeed(String actorId) {
  var hash = 0x811c9dc5;
  for (final codeUnit in actorId.codeUnits) {
    hash ^= codeUnit;
    hash = (hash * 0x01000193) & 0x7fffffff;
  }
  return hash;
}
