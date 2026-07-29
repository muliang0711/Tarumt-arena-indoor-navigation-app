import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/maps/map_runtime_resource_repository.dart';
import 'package:indoor_navigation/application/view_models/navigation_ui_state.dart';
import 'package:indoor_navigation/domain/navigation/navigation_models.dart';
import 'package:indoor_navigation/domain/simulation/simulation_models.dart';
import 'package:indoor_navigation/domain/tiled/map/png_map_model.dart';
import 'package:indoor_navigation/domain/tiled/parsing/tiled_map_parser.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/domain/traffic/route_traffic.dart';
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
    final scaledCanvas = tester.widget<FittedBox>(
      find.byKey(IndoorMapViewportKeys.scaledCanvas),
    );
    expect(scaledCanvas.alignment, Alignment.topLeft);
    expect(scaledCanvas.fit, BoxFit.fill);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'two-finger pinch zoom stays bounded and keeps map overlays anchored',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 480);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      final horizontalController = ScrollController();
      final verticalController = ScrollController();
      final zoom = ValueNotifier<double>(1);
      addTearDown(horizontalController.dispose);
      addTearDown(verticalController.dispose);
      addTearDown(zoom.dispose);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ValueListenableBuilder<double>(
              valueListenable: zoom,
              builder: (context, value, child) {
                return IndoorMapViewport(
                  blueMarkerPosition: bluePosition,
                  horizontalScrollController: horizontalController,
                  mapModel: mapModel,
                  mapOverlays: const <Widget>[
                    Positioned(
                      left: 160,
                      top: 160,
                      child: SizedBox.square(
                        key: ValueKey<String>('test-map-overlay-anchor'),
                        dimension: 1,
                      ),
                    ),
                  ],
                  onZoomChanged: (value) => zoom.value = value,
                  redMarker: mapModel.redMarker,
                  remainingPathSegments: const <OverlayPathSegment>[],
                  showNavigationOverlay: false,
                  verticalScrollController: verticalController,
                  zoom: value,
                );
              },
            ),
          ),
        ),
      );
      await tester.pump();

      final surface = find.byKey(IndoorMapViewportKeys.pinchSurface);
      final surfaceOrigin = tester.getTopLeft(surface);
      final firstFinger = await tester.createGesture(pointer: 1);
      final secondFinger = await tester.createGesture(pointer: 2);
      await firstFinger.down(surfaceOrigin + const Offset(80, 160));
      await secondFinger.down(surfaceOrigin + const Offset(240, 160));
      await tester.pump();

      await firstFinger.moveTo(surfaceOrigin + const Offset(40, 160));
      await secondFinger.moveTo(surfaceOrigin + const Offset(280, 160));
      await tester.pump();

      expect(zoom.value, closeTo(1.5, 0.001));
      expect(horizontalController.offset, closeTo(80, 0.01));
      expect(verticalController.offset, closeTo(80, 0.01));

      final image = find.bySemanticsLabel('Indoor map');
      final imageBox = tester.renderObject<RenderBox>(image);
      final mapPointOnImage = imageBox.localToGlobal(const Offset(160, 160));
      final mapOverlayPoint = tester.getTopLeft(
        find.byKey(const ValueKey<String>('test-map-overlay-anchor')),
      );
      expect(mapPointOnImage.dx, closeTo(mapOverlayPoint.dx, 0.01));
      expect(mapPointOnImage.dy, closeTo(mapOverlayPoint.dy, 0.01));
      expect(mapOverlayPoint.dx, closeTo(surfaceOrigin.dx + 160, 0.01));
      expect(mapOverlayPoint.dy, closeTo(surfaceOrigin.dy + 160, 0.01));

      await firstFinger.moveTo(surfaceOrigin + const Offset(-80, 160));
      await secondFinger.moveTo(surfaceOrigin + const Offset(400, 160));
      await tester.pump();
      expect(zoom.value, 2);

      await firstFinger.moveTo(surfaceOrigin + const Offset(150, 160));
      await secondFinger.moveTo(surfaceOrigin + const Offset(170, 160));
      await tester.pump();
      expect(zoom.value, 0.5);

      await firstFinger.up();
      await secondFinger.up();
    },
  );

  testWidgets(
    'room labels, Bob, and route use the same single-scale map coordinates',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(600, 1000);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      const zoom = 0.5;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: IndoorMapViewport(
              blueMarkerPosition: bluePosition,
              mapModel: mapModel,
              observedHeadingDegrees: 90,
              redMarker: mapModel.redMarker,
              remainingPathSegments: mapModel.pathSegments.take(1).toList(),
              zoom: zoom,
            ),
          ),
        ),
      );
      await tester.pump();

      final imageBox = tester.renderObject<RenderBox>(
        find.bySemanticsLabel('Indoor map'),
      );
      final imageTopLeft = imageBox.localToGlobal(Offset.zero);
      final imageBottomRight = imageBox.localToGlobal(
        imageBox.size.bottomRight(Offset.zero),
      );
      expect(
        imageBottomRight.dx - imageTopLeft.dx,
        closeTo(mapModel.surface.width * zoom, 0.01),
      );
      expect(
        imageBottomRight.dy - imageTopLeft.dy,
        closeTo(mapModel.surface.height * zoom, 0.01),
      );

      final label = mapModel.roomLabels.singleWhere(
        (candidate) => candidate.name == 'TA242',
      );
      final labelPosition = tester.getTopLeft(
        find.widgetWithText(MapRoomLabel, 'TA242'),
      );
      expect(
        labelPosition.dx,
        closeTo(imageTopLeft.dx + label.screenX * zoom, 0.01),
      );
      expect(
        labelPosition.dy,
        closeTo(imageTopLeft.dy + label.screenY * zoom, 0.01),
      );

      final bobImage = find.descendant(
        of: find.byType(UserPresenceMarker),
        matching: find.byType(Image),
      );
      final bobBox = tester.renderObject<RenderBox>(bobImage);
      final bobAnchor = bobBox.localToGlobal(
        Offset(bobBox.size.width / 2, bobBox.size.height),
      );
      expect(
        bobAnchor.dx,
        closeTo(imageTopLeft.dx + bluePosition.screenX * zoom, 0.01),
      );
      expect(
        bobAnchor.dy,
        closeTo(imageTopLeft.dy + bluePosition.screenY * zoom, 0.01),
      );

      final segment = mapModel.pathSegments.first;
      final routePaint = find.descendant(
        of: find.byKey(ValueKey<String>(segment.key)),
        matching: find.byType(ColoredBox),
      );
      final routeBox = tester.renderObject<RenderBox>(routePaint);
      final routeStart = routeBox.localToGlobal(
        const Offset(0, MapPathSegment.thickness / 2),
      );
      expect(routeStart.dx, closeTo(imageTopLeft.dx + segment.x * zoom, 0.01));
      expect(routeStart.dy, closeTo(imageTopLeft.dy + segment.y * zoom, 0.01));
    },
  );

  testWidgets('one-finger movement does not change map zoom', (tester) async {
    final zoom = ValueNotifier<double>(1);
    addTearDown(zoom.dispose);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ValueListenableBuilder<double>(
            valueListenable: zoom,
            builder: (context, value, child) {
              return IndoorMapViewport(
                blueMarkerPosition: bluePosition,
                mapModel: mapModel,
                onZoomChanged: (value) => zoom.value = value,
                redMarker: mapModel.redMarker,
                remainingPathSegments: const <OverlayPathSegment>[],
                zoom: value,
              );
            },
          ),
        ),
      ),
    );

    await tester.drag(
      find.byKey(IndoorMapViewportKeys.pinchSurface),
      const Offset(-80, -80),
    );
    await tester.pump();

    expect(zoom.value, 1);
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

  testWidgets('renders a pinned Map Bundle raster from local storage', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: IndoorMapViewport(
          blueMarkerPosition: bluePosition,
          mapImage: MapImageLocation.localFile(
            File('assets/maps/demo_1.png').absolute.path,
          ),
          mapModel: mapModel,
          redMarker: mapModel.redMarker,
          remainingPathSegments: const <OverlayPathSegment>[],
          zoom: 1,
        ),
      ),
    );
    await tester.pump();

    final image = tester.widget<Image>(
      find.byWidgetPredicate(
        (widget) => widget is Image && widget.semanticLabel == 'Indoor map',
      ),
    );
    expect(image.image, isA<FileImage>());
    expect(tester.takeException(), isNull);
  });

  testWidgets('colors route segments by their resolved traffic level', (
    tester,
  ) async {
    final segments = mapModel.pathSegments.take(4).toList(growable: false);
    await tester.pumpWidget(
      MaterialApp(
        home: IndoorMapViewport(
          blueMarkerPosition: bluePosition,
          mapModel: mapModel,
          redMarker: mapModel.redMarker,
          remainingPathSegments: segments,
          routeTrafficBySegmentKey: <String, RouteTrafficLevel>{
            segments[0].key: RouteTrafficLevel.clear,
            segments[1].key: RouteTrafficLevel.moderate,
            segments[2].key: RouteTrafficLevel.busy,
            segments[3].key: RouteTrafficLevel.congested,
          },
          zoom: 1,
        ),
      ),
    );

    final colors = tester
        .widgetList<MapPathSegment>(find.byType(MapPathSegment))
        .map((widget) => widget.color)
        .toList(growable: false);
    expect(colors, <Color>[
      RouteTrafficColors.clear,
      RouteTrafficColors.moderate,
      RouteTrafficColors.busy,
      RouteTrafficColors.congested,
    ]);
  });
}
