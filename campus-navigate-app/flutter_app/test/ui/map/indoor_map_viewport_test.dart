import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/view_models/navigation_ui_state.dart';
import 'package:indoor_navigation/domain/navigation/navigation_models.dart';
import 'package:indoor_navigation/domain/simulation/simulation_models.dart';
import 'package:indoor_navigation/domain/tiled/map/png_map_model.dart';
import 'package:indoor_navigation/domain/tiled/parsing/tiled_map_parser.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/ui/map/actor/user_presence_marker.dart';
import 'package:indoor_navigation/ui/map/effects/route_endpoint_effects.dart';
import 'package:indoor_navigation/ui/map/indoor_map_viewport.dart';
import 'package:indoor_navigation/ui/map/models/destination_beacon_model.dart';
import 'package:indoor_navigation/ui/map/widgets/map_path_segment.dart';
import 'package:indoor_navigation/ui/map/widgets/map_room_label.dart';
import 'package:indoor_navigation/ui/map/widgets/map_route_node.dart';
import 'package:indoor_navigation/ui/map/widgets/marker_primitives.dart';

void main() {
  late PngMapModel mapModel;
  late RoutePosition bluePosition;

  setUpAll(() {
    mapModel = createPngMapModel(
      parseTiledMapJson(File('assets/maps/demo_1.tmj.json').readAsStringSync()),
    );
    final first = mapModel.routePath.first;
    bluePosition = RoutePosition(
      distanceAlongRoute: 0,
      headingDegrees: 0,
      screenX: first.screenX,
      screenY: first.screenY,
      segmentIndex: 0,
      tiledX: first.tiledX,
      tiledY: first.tiledY,
    );
  });

  testWidgets('renders scalable layered map with clamped two-axis scrolling', (
    tester,
  ) async {
    const navigation = NavigationUiState(
      currentSegment: 'A -> B',
      distanceRemainingPixels: 100,
      instruction: NavigationTurn.straight,
      progressPercent: 25,
      status: SimulationStatus.moving,
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: IndoorMapViewport(
            blueMarkerPosition: bluePosition,
            edgeSegments: mapModel.pathSegments.take(1).toList(),
            mapModel: mapModel,
            navigation: navigation,
            navigationOverlayBuilder: (context, value, wrongWay) {
              return Text('Overlay ${value?.currentSegment}');
            },
            observedHeadingDegrees: 90,
            redMarker: mapModel.redMarker,
            remainingPathSegments: mapModel.pathSegments.take(2).toList(),
            selectedRouteNodeIds: <String>[mapModel.routeNodes.first.nodeId],
            showRouteEndpointEffects: true,
            zoom: 0.75,
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.bySemanticsLabel('Indoor map'), findsOneWidget);
    expect(find.byType(MapPathSegment), findsNWidgets(3));
    expect(
      find.byType(MapRoomLabel),
      findsNWidgets(mapModel.roomLabels.length),
    );
    expect(
      find.byType(MapRouteNode),
      findsNWidgets(mapModel.routeNodes.length),
    );
    expect(find.byType(UserPresenceMarker), findsOneWidget);
    expect(find.byType(RedMarker), findsOneWidget);
    final start = tester.widget<RouteStartMarker>(
      find.byType(RouteStartMarker),
    );
    final destination = tester.widget<DestinationBeacon>(
      find.byType(DestinationBeacon),
    );
    expect(start.position, same(mapModel.routePath.first));
    expect(destination.position, same(mapModel.routePath.last));
    expect(destination.phase, DestinationBeaconPhase.near);
    expect(find.text('Overlay A -> B'), findsOneWidget);

    final scrollers = tester.widgetList<SingleChildScrollView>(
      find.byType(SingleChildScrollView),
    );
    expect(scrollers, hasLength(2));
    expect(
      scrollers.every((scroller) => scroller.physics is ClampingScrollPhysics),
      isTrue,
    );
    expect(scrollers.map((scroller) => scroller.scrollDirection), <Axis>[
      Axis.vertical,
      Axis.horizontal,
    ]);
    final hasMapScale = tester
        .widgetList<Transform>(find.byType(Transform))
        .any(
          (transform) =>
              transform.transform.storage[0] == 0.75 &&
              transform.transform.storage[5] == 0.75,
        );
    expect(hasMapScale, isTrue);
    expect(tester.takeException(), isNull);
  });

  testWidgets('navigation overlay switch hides both markers and builder', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: IndoorMapViewport(
          blueMarkerPosition: bluePosition,
          mapModel: mapModel,
          navigationOverlayBuilder: (context, navigation, wrongWay) {
            return const Text('Hidden overlay');
          },
          redMarker: mapModel.redMarker,
          remainingPathSegments: const <OverlayPathSegment>[],
          showNavigationOverlay: false,
          zoom: 1,
        ),
      ),
    );

    expect(find.byType(UserPresenceMarker), findsNothing);
    expect(find.byType(RedMarker), findsNothing);
    expect(find.text('Hidden overlay'), findsNothing);
  });
}
