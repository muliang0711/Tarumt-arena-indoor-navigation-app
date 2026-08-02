import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/view_models/live_map_view_state.dart';
import 'package:indoor_navigation/domain/campus/campus_catalog.dart';
import 'package:indoor_navigation/domain/presence/presence_connection.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/ui/live_map/widgets/live_map_header.dart';
import 'package:indoor_navigation/ui/live_map/widgets/live_presence_actor_marker.dart';

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
}

AnonymousPresence _presence({
  required PresenceOrigin origin,
  String? displayName,
}) => AnonymousPresence(
  activity: PresenceActivity.walking,
  buildingId: 'main-campus',
  displayName: displayName,
  edgeProgress: 0.5,
  floorId: 'floor-2',
  fromNodeId: 'node-21',
  headingDegrees: 0,
  origin: origin,
  presenceId: 'actor',
  sequence: 1,
  toNodeId: 'node-20',
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
