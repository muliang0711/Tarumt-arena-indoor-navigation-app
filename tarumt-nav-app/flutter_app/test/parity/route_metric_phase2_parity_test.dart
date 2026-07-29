import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/edge_editor/logic/route_graph_edge_model.dart';
import 'package:indoor_navigation/domain/edge_editor/logic/route_metric_model.dart';
import 'package:indoor_navigation/domain/tiled/map/png_map_model.dart';
import 'package:indoor_navigation/domain/tiled/parsing/tiled_map_parser.dart';

import '../support/json_parity.dart';
import 'phase2_fixture.dart';
import 'route_metric_json.dart';

void main() {
  test('reproduces the authoritative Phase 2 route-metric golden', () {
    final fixture = loadPhase2Fixture();
    final golden = loadPhase2Golden();
    final map = createPngMapModel(
      parseTiledMapJson(
        File('../expo-app/assets/maps/demo_1.tmj.json').readAsStringSync(),
      ),
    );
    final edgeDocument = parseRouteGraphEdgeDocumentJson(
      File('../expo-app/assets/maps/demo_1.edges.json').readAsStringSync(),
    );
    final metrics = createRouteMetricModel(map.routePath, edgeDocument.edges);
    final actual = routeMetricModelToJson(metrics);
    final mismatches = compareParityJson(
      actual,
      golden['routeMetrics'],
      tolerance: ParityTolerance(
        absolute: fixture.tolerance.absolute,
        relative: fixture.tolerance.relative,
      ),
    );

    expect(metrics.totalMeters, 46);
    expect(metrics.totalPixels, 2542);
    expect(mismatches, isEmpty, reason: mismatches.take(20).join('\n'));
  });
}
