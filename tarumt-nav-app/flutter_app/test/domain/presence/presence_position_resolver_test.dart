import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';
import 'package:indoor_navigation/domain/presence/presence_position_resolver.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

void main() {
  const nodes = <OverlayRouteNode>[
    OverlayRouteNode(
      id: 1,
      nodeId: 'a',
      screenX: 10,
      screenY: 20,
      tiledX: 1,
      tiledY: 2,
      type: 'route',
    ),
    OverlayRouteNode(
      id: 2,
      nodeId: 'b',
      screenX: 110,
      screenY: 70,
      tiledX: 11,
      tiledY: 7,
      type: 'route',
    ),
  ];

  test('interpolates a presence along its route edge', () {
    final position = resolvePresenceRoutePosition(
      presence: _presence(progress: 0.5),
      routeNodes: nodes,
    );

    expect(position, isNotNull);
    expect(position!.screenX, 60);
    expect(position.screenY, 45);
    expect(position.tiledX, 6);
    expect(position.tiledY, 4.5);
  });

  test('clamps progress and ignores an unknown edge endpoint', () {
    final clamped = resolvePresenceRoutePosition(
      presence: _presence(progress: 2),
      routeNodes: nodes,
    );
    final missing = resolvePresenceRoutePosition(
      presence: _presence(progress: 0.5, toNodeId: 'missing'),
      routeNodes: nodes,
    );

    expect(clamped!.screenX, 110);
    expect(clamped.screenY, 70);
    expect(missing, isNull);
  });
}

AnonymousPresence _presence({
  required double progress,
  String toNodeId = 'b',
}) => AnonymousPresence(
  activity: PresenceActivity.walking,
  buildingId: 'campus',
  edgeProgress: progress,
  floorId: 'floor-2',
  fromNodeId: 'a',
  headingDegrees: 0,
  origin: PresenceOrigin.remote,
  presenceId: 'anonymous',
  sequence: 1,
  toNodeId: toNodeId,
  updatedAt: DateTime.fromMillisecondsSinceEpoch(1000),
  visualSeed: 1,
);
