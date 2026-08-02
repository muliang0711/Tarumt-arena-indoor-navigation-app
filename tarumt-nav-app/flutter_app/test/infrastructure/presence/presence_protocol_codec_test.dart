import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/journey/journey.dart';
import 'package:indoor_navigation/domain/presence/presence_connection.dart';
import 'package:indoor_navigation/domain/presence/presence_events.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';
import 'package:indoor_navigation/infrastructure/presence/websocket/presence_protocol_codec.dart';

void main() {
  const codec = PresenceProtocolCodec();

  test('decodes an authoritative floor snapshot into domain models', () {
    final event = codec.decode(
      jsonEncode(<String, Object>{
        'version': 1,
        'type': 'floor_snapshot',
        'timestamp': '2026-07-22T12:00:00Z',
        'payload': <String, Object>{
          'total_active_users': 120,
          'building_active_users': 42,
          'building_id': 'main-campus',
          'floor_id': 'floor-2',
          'floor_counts': <Object>[
            <String, Object>{'floor_id': 'floor-2', 'count': 9},
          ],
          'edge_occupancies': <Object>[
            <String, Object>{
              'from_node_id': 'node-20',
              'to_node_id': 'node-21',
              'active_users': 6,
            },
          ],
          'representatives': <Object>[
            <String, Object>{
              'actor_id': 'anonymous-actor',
              'display_name': 'IShowSpeed',
              'sequence': 7,
              'updated_at': '2026-07-22T12:00:00Z',
              'position': <String, Object>{
                'building_id': 'main-campus',
                'floor_id': 'floor-2',
                'from_node_id': 'node-21',
                'to_node_id': 'node-20',
                'edge_progress': 0.4,
                'heading': 90,
                'movement_state': 'walking',
              },
            },
          ],
          'generated_at': '2026-07-22T12:00:00Z',
        },
      }),
    );

    expect(event, isA<PresenceSnapshotReceived>());
    final snapshot = (event as PresenceSnapshotReceived).snapshot;
    expect(snapshot.floorId, 'floor-2');
    expect(snapshot.totalAppUsers, 120);
    expect(snapshot.edgeOccupancies.single.activeUsers, 6);
    expect(snapshot.representatives.single.sequence, 7);
    expect(snapshot.representatives.single.displayName, 'IShowSpeed');
    expect(snapshot.representatives.single.origin, PresenceOrigin.remote);
    expect(snapshot.representatives.single.visualSeed, isNonNegative);
  });

  test('treats null Redis snapshot collections as empty', () {
    final event = codec.decode(
      jsonEncode(<String, Object?>{
        'version': 1,
        'type': 'floor_snapshot',
        'timestamp': '2026-07-28T05:40:09Z',
        'payload': <String, Object?>{
          'total_active_users': 2,
          'building_active_users': 0,
          'building_id': 'main-campus',
          'floor_id': 'floor-2',
          'floor_counts': null,
          'representatives': <Object>[],
          'edge_occupancies': null,
          'generated_at': '2026-07-28T05:40:09Z',
        },
      }),
    );

    final snapshot = (event as PresenceSnapshotReceived).snapshot;
    expect(snapshot.floors, isEmpty);
    expect(snapshot.representatives, isEmpty);
    expect(snapshot.edgeOccupancies, isEmpty);
  });

  test('decodes a changed-edge occupancy update', () {
    final event = codec.decode(
      jsonEncode(<String, Object>{
        'version': 1,
        'type': 'edge_occupancy_updated',
        'timestamp': '2026-07-22T12:00:01Z',
        'payload': <String, Object>{
          'building_id': 'main-campus',
          'floor_id': 'floor-2',
          'edge_occupancies': <Object>[
            <String, Object>{
              'from_node_id': 'node-20',
              'to_node_id': 'node-21',
              'active_users': 7,
            },
          ],
          'generated_at': '2026-07-22T12:00:01Z',
        },
      }),
    );

    expect(event, isA<PresenceEdgeOccupancyChanged>());
    expect(
      (event as PresenceEdgeOccupancyChanged)
          .edgeOccupancies
          .single
          .activeUsers,
      7,
    );
  });

  test('encodes route-relative location without device identity', () {
    final encoded = codec.locationUpdate(
      position: LocalPresencePosition(
        buildingId: 'main-campus',
        edgeProgress: 0.25,
        floorId: 'floor-2',
        fromNodeId: 'node-21',
        headingDegrees: -90,
        movementState: PresenceMovementState.walking,
        observedAt: DateTime.utc(2026, 7, 22),
        toNodeId: 'node-20',
      ),
      requestId: 'location-1',
      sequence: 3,
    );
    final envelope = jsonDecode(encoded) as Map<String, dynamic>;
    final payload = envelope['payload'] as Map<String, dynamic>;
    final position = payload['position'] as Map<String, dynamic>;

    expect(envelope['type'], 'location_update');
    expect(envelope['sequence'], 3);
    expect(position['heading'], 270);
    expect(encoded, isNot(contains('installation')));
    expect(encoded, isNot(contains('access_token')));
  });

  test('encodes Journey command and decodes canonical ACK', () {
    final encoded = codec.journeyCommand(
      command: JourneyStartCommand(
        clientEventId: 'client-event-1',
        clientJourneyKey: 'local-journey-1',
        occurredAt: DateTime.utc(2026, 7, 26, 2),
        mapId: 'main-campus',
        mapRevision: 'revision-1',
        route: PlannedJourneyRoute(
          originNodeId: 'node-1',
          destinationNodeId: 'node-2',
          plannedEdgeIds: const ['edge-1'],
        ),
      ),
      requestId: 'journey-client-event-1',
    );
    final envelope = jsonDecode(encoded) as Map<String, dynamic>;
    expect(envelope['type'], 'journey_start');
    expect(envelope['timestamp'], '2026-07-26T02:00:00.000Z');
    expect(
      (envelope['payload'] as Map<String, dynamic>)['planned_route'],
      <String, Object>{
        'origin_node_id': 'node-1',
        'destination_node_id': 'node-2',
        'planned_edge_ids': ['edge-1'],
      },
    );

    final event = codec.decode(
      jsonEncode(<String, Object>{
        'version': 1,
        'type': 'ack',
        'request_id': 'journey-client-event-1',
        'timestamp': '2026-07-26T02:00:00Z',
        'payload': <String, Object>{
          'journey_id': 'server-journey-1',
          'lifecycle_sequence': 1,
          'route_revision': 1,
        },
      }),
    );
    final acknowledged = event as PresenceAcknowledged;
    expect(acknowledged.requestId, 'journey-client-event-1');
    expect(acknowledged.journey?.journeyId, 'server-journey-1');
    expect(acknowledged.journey?.deduplicated, isFalse);
  });

  test('rejects unsupported versions and unknown server messages', () {
    expect(
      () => codec.decode(
        '{"version":2,"type":"pong","timestamp":"2026-07-22T12:00:00Z"}',
      ),
      throwsA(isA<PresenceProtocolException>()),
    );
    expect(
      () => codec.decode(
        '{"version":1,"type":"future_event","timestamp":"2026-07-22T12:00:00Z"}',
      ),
      throwsA(isA<PresenceProtocolException>()),
    );
  });
}
