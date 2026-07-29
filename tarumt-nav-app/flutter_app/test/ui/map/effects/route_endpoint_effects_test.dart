import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/ui/map/effects/route_endpoint_effects.dart';
import 'package:indoor_navigation/ui/map/models/destination_beacon_model.dart';

void main() {
  const destination = OverlayRouteNode(
    id: 20,
    nodeId: 'node-20',
    screenX: 180,
    screenY: 200,
    tiledX: 180,
    tiledY: 200,
    type: 'room',
  );

  testWidgets('renders code-native start and destination game effects', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Stack(
          children: [
            RouteStartMarker(position: destination),
            DestinationBeacon(
              phase: DestinationBeaconPhase.far,
              position: destination,
            ),
          ],
        ),
      ),
    );

    expect(find.byKey(RouteEndpointEffectKeys.start), findsOneWidget);
    expect(find.byKey(RouteEndpointEffectKeys.destination), findsOneWidget);
    expect(find.bySemanticsLabel('Route start point'), findsOneWidget);
    expect(find.bySemanticsLabel('Destination beacon'), findsOneWidget);
    expect(
      tester
          .widgetList<CustomPaint>(find.byType(CustomPaint))
          .any((paint) => paint.painter is RouteStartMarkerPainter),
      isTrue,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('accelerates nearby and runs one arrival burst transition', (
    tester,
  ) async {
    await tester.pumpWidget(_beaconHost(DestinationBeaconPhase.far));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pumpWidget(_beaconHost(DestinationBeaconPhase.near));
    await tester.pump(const Duration(milliseconds: 100));
    expect(
      tester.widget<DestinationBeacon>(find.byType(DestinationBeacon)).phase,
      DestinationBeaconPhase.near,
    );

    await tester.pumpWidget(_beaconHost(DestinationBeaconPhase.arrived));
    await tester.pump(const Duration(milliseconds: 450));
    expect(find.bySemanticsLabel('Destination reached'), findsOneWidget);
    final painter = tester
        .widgetList<CustomPaint>(
          find.descendant(
            of: find.byKey(RouteEndpointEffectKeys.destination),
            matching: find.byType(CustomPaint),
          ),
        )
        .map((paint) => paint.painter)
        .whereType<DestinationBeaconPainter>()
        .single;
    expect(painter.arrivalProgress, greaterThan(0));
    expect(painter.arrivalProgress, lessThan(1));
    expect(painter.phase, DestinationBeaconPhase.arrived);
  });
}

Widget _beaconHost(DestinationBeaconPhase phase) {
  return MaterialApp(
    home: Stack(
      children: [
        DestinationBeacon(
          phase: phase,
          position: const OverlayRouteNode(
            id: 20,
            nodeId: 'node-20',
            screenX: 180,
            screenY: 200,
            tiledX: 180,
            tiledY: 200,
            type: 'room',
          ),
        ),
      ],
    ),
  );
}
