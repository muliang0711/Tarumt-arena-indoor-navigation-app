import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/view_models/live_map_view_state.dart';
import 'package:indoor_navigation/domain/campus/campus_catalog.dart';
import 'package:indoor_navigation/domain/presence/presence_connection.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';
import 'package:indoor_navigation/domain/presence/presence_position_resolver.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/ui/live_map/widgets/live_map_header.dart';
import 'package:indoor_navigation/ui/live_map/widgets/live_presence_actor_marker.dart';
import 'package:indoor_navigation/ui/live_map/widgets/live_presence_map.dart';

void main() {
  test('reserves red for the local hybrid sentinel', () {
    expect(
      resolveLivePresenceActorColor(
        _presence(origin: PresenceOrigin.localSimulation),
      ),
      localPresenceActorColor,
    );
    expect(remotePresenceActorColors, isNot(contains(localPresenceActorColor)));
    expect(
      resolveLivePresenceActorColor(_presence(origin: PresenceOrigin.remote)),
      isNot(localPresenceActorColor),
    );
  });

  testWidgets('labels the combined source as a connected hybrid test', (
    tester,
  ) async {
    final state = LiveMapViewState.initial(
      buildingId: 'main-campus',
      buildingName: mainCampusBuildingName,
      floors: mainCampusFloors,
      presenceConnection: const PresenceConnectionState(
        phase: PresenceConnectionPhase.connected,
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: LiveMapHeader(state: state)),
      ),
    );

    expect(find.byKey(LiveMapHeaderKeys.hybrid), findsOneWidget);
    expect(find.text('HYBRID TEST · REMOTE CONNECTED'), findsOneWidget);
  });

  testWidgets('shows a representative username below the actor', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Stack(
            children: [
              LivePresenceActorMarker(
                presence: _presence(
                  origin: PresenceOrigin.remote,
                  displayName: 'IShowSpeed',
                ),
                position: _position(),
              ),
            ],
          ),
        ),
      ),
    );

    expect(find.text('IShowSpeed'), findsOneWidget);
  });

  testWidgets('names an otherwise unnamed ghost Bob', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Stack(
            children: [
              LivePresenceActorMarker(
                presence: _presence(origin: PresenceOrigin.remote),
                position: _position(),
              ),
            ],
          ),
        ),
      ),
    );

    expect(find.text('Ghost Bob'), findsOneWidget);
  });

  testWidgets('uses the current username for the default local ghost Bob', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Stack(
            children: [
              LivePresenceActorMarker(
                displayNameOverride: 'IShowSpeed',
                presence: _presence(
                  origin: PresenceOrigin.localSimulation,
                  displayName: 'Aina',
                ),
                position: _position(),
              ),
            ],
          ),
        ),
      ),
    );

    expect(find.text('IShowSpeed'), findsOneWidget);
    expect(find.text('Aina'), findsNothing);
  });

  test('spreads actors that share a map point in stable ID order', () {
    final spread = spreadOverlappingActorPositions(<String, RoutePosition>{
      'bob-b': _position(),
      'bob-a': _position(),
    });

    expect(spread['bob-a']!.screenX, closeTo(80, 0.001));
    expect(spread['bob-a']!.screenY, closeTo(58, 0.001));
    expect(spread['bob-b']!.screenX, closeTo(80, 0.001));
    expect(spread['bob-b']!.screenY, closeTo(102, 0.001));
    expect(spread['bob-a']!.distanceAlongRoute, 0);
    expect(spread['bob-b']!.distanceAlongRoute, 0);
  });

  test(
    'separates a shared start then follows each actor onto its own edge',
    () {
      const nodes = <OverlayRouteNode>[
        OverlayRouteNode(
          id: 1,
          nodeId: 'origin',
          screenX: 100,
          screenY: 100,
          tiledX: 10,
          tiledY: 10,
          type: 'route',
        ),
        OverlayRouteNode(
          id: 2,
          nodeId: 'east',
          screenX: 200,
          screenY: 100,
          tiledX: 20,
          tiledY: 10,
          type: 'route',
        ),
        OverlayRouteNode(
          id: 3,
          nodeId: 'south',
          screenX: 100,
          screenY: 200,
          tiledX: 10,
          tiledY: 20,
          type: 'route',
        ),
      ];
      final actorEastAtStart = _presence(
        origin: PresenceOrigin.remote,
        edgeProgress: 0,
        fromNodeId: 'origin',
        presenceId: 'actor-east',
        toNodeId: 'east',
      );
      final actorSouthAtStart = _presence(
        origin: PresenceOrigin.remote,
        edgeProgress: 0,
        fromNodeId: 'origin',
        presenceId: 'actor-south',
        toNodeId: 'south',
      );
      final sharedStart = spreadOverlappingActorPositions({
        actorEastAtStart.presenceId: resolvePresenceRoutePosition(
          presence: actorEastAtStart,
          routeNodes: nodes,
        )!,
        actorSouthAtStart.presenceId: resolvePresenceRoutePosition(
          presence: actorSouthAtStart,
          routeNodes: nodes,
        )!,
      });

      expect(sharedStart, hasLength(2));
      expect(
        Offset(
          sharedStart['actor-east']!.screenX,
          sharedStart['actor-east']!.screenY,
        ),
        isNot(
          Offset(
            sharedStart['actor-south']!.screenX,
            sharedStart['actor-south']!.screenY,
          ),
        ),
      );

      final actorEastMoving = resolvePresenceRoutePosition(
        presence: _presence(
          origin: PresenceOrigin.remote,
          edgeProgress: 0.5,
          fromNodeId: 'origin',
          presenceId: 'actor-east',
          toNodeId: 'east',
        ),
        routeNodes: nodes,
      )!;
      final actorSouthMoving = resolvePresenceRoutePosition(
        presence: _presence(
          origin: PresenceOrigin.remote,
          edgeProgress: 0.5,
          fromNodeId: 'origin',
          presenceId: 'actor-south',
          toNodeId: 'south',
        ),
        routeNodes: nodes,
      )!;
      final diverged = spreadOverlappingActorPositions({
        'actor-east': actorEastMoving,
        'actor-south': actorSouthMoving,
      });

      expect(diverged['actor-east']!.screenX, 150);
      expect(diverged['actor-east']!.screenY, 100);
      expect(diverged['actor-east']!.headingDegrees, closeTo(0, 0.001));
      expect(diverged['actor-south']!.screenX, 100);
      expect(diverged['actor-south']!.screenY, 150);
      expect(diverged['actor-south']!.headingDegrees, closeTo(90, 0.001));
    },
  );
}

AnonymousPresence _presence({
  required PresenceOrigin origin,
  String? displayName,
  double edgeProgress = 0.5,
  String fromNodeId = 'node-21',
  String presenceId = 'actor',
  String toNodeId = 'node-20',
}) => AnonymousPresence(
  activity: PresenceActivity.walking,
  buildingId: 'main-campus',
  displayName: displayName,
  edgeProgress: edgeProgress,
  floorId: 'floor-2',
  fromNodeId: fromNodeId,
  headingDegrees: 0,
  origin: origin,
  presenceId: presenceId,
  sequence: 1,
  toNodeId: toNodeId,
  updatedAt: DateTime.utc(2026, 7, 28),
  visualSeed: 0,
);

RoutePosition _position() => const RoutePosition(
  distanceAlongRoute: 0,
  headingDegrees: 0,
  screenX: 80,
  screenY: 80,
  segmentIndex: 0,
  tiledX: 0,
  tiledY: 0,
);
