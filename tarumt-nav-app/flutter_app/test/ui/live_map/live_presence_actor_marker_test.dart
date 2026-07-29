import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/view_models/live_map_view_state.dart';
import 'package:indoor_navigation/domain/campus/campus_catalog.dart';
import 'package:indoor_navigation/domain/presence/presence_connection.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';
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
}

AnonymousPresence _presence({required PresenceOrigin origin}) =>
    AnonymousPresence(
      activity: PresenceActivity.walking,
      buildingId: 'main-campus',
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
