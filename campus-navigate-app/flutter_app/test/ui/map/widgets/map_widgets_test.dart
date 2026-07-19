import 'dart:ui' show Tristate;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/ui/map/widgets/map_path_segment.dart';
import 'package:indoor_navigation/ui/map/widgets/map_route_node.dart';
import 'package:indoor_navigation/ui/map/widgets/marker_primitives.dart';

void main() {
  testWidgets('route node exposes selection, button semantics, and callback', (
    tester,
  ) async {
    OverlayRouteNode? pressed;
    const node = OverlayRouteNode(
      id: 1,
      nodeId: 'node-A',
      screenX: 50,
      screenY: 60,
      tiledX: 1,
      tiledY: 2,
      type: 'route-node',
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Stack(
          children: [
            MapRouteNode(
              node: node,
              onPressed: (value) => pressed = value,
              selected: true,
            ),
          ],
        ),
      ),
    );

    final semantics = tester
        .getSemantics(find.byType(MapRouteNode))
        .getSemanticsData();
    expect(semantics.label, 'Route node node-A');
    expect(semantics.flagsCollection.isButton, isTrue);
    expect(semantics.flagsCollection.isEnabled, Tristate.isTrue);
    expect(semantics.flagsCollection.isSelected, Tristate.isTrue);
    await tester.tap(find.text('node-A'));
    expect(pressed, same(node));
  });

  testWidgets('path segment is exactly four pixels and rotates from left', (
    tester,
  ) async {
    const segment = OverlayPathSegment(
      fromNodeId: 'A',
      key: 'A->B',
      length: 100,
      rotationDegrees: 90,
      toNodeId: 'B',
      x: 10,
      y: 20,
    );
    await tester.pumpWidget(
      const MaterialApp(
        home: Stack(children: [MapPathSegment(segment: segment)]),
      ),
    );

    final box = tester.widget<SizedBox>(
      find.descendant(
        of: find.byType(MapPathSegment),
        matching: find.byType(SizedBox),
      ),
    );
    expect(box.height, 4);
    expect(box.width, 100);
    final transform = tester.widget<Transform>(find.byType(Transform));
    expect(transform.alignment, Alignment.centerLeft);
  });

  testWidgets('marker movement compensates linearly with the 520ms cap', (
    tester,
  ) async {
    await tester.pumpWidget(_redMarkerHost(100));
    final paintFinder = find.descendant(
      of: find.byType(RedMarker),
      matching: find.byType(CustomPaint),
    );
    expect(tester.getTopLeft(paintFinder).dx, closeTo(89, 0.01));

    await tester.pumpWidget(_redMarkerHost(360));
    await tester.pump(const Duration(milliseconds: 260));
    expect(tester.getTopLeft(paintFinder).dx, closeTo(219, 0.5));
    await tester.pump(const Duration(milliseconds: 260));
    expect(tester.getTopLeft(paintFinder).dx, closeTo(349, 0.01));
  });
}

Widget _redMarkerHost(double screenX) {
  return MaterialApp(
    home: Stack(
      children: [
        RedMarker(
          marker: RedMarkerState(
            headingDegrees: 0,
            screenX: screenX,
            screenY: 100,
            tiledX: screenX,
            tiledY: 100,
          ),
        ),
      ],
    ),
  );
}
