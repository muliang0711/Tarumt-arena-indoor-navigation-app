import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/view_models/navigation_ui_state.dart';
import 'package:indoor_navigation/domain/navigation/navigation_models.dart';
import 'package:indoor_navigation/domain/simulation/simulation_models.dart';
import 'package:indoor_navigation/domain/tiled/map/png_map_model.dart';
import 'package:indoor_navigation/domain/tiled/parsing/tiled_map_parser.dart';
import 'package:indoor_navigation/domain/tiled/route/route_progress.dart';

void main() {
  late final model = createPngMapModel(
    parseTiledMapJson(File('assets/maps/demo_1.tmj.json').readAsStringSync()),
  );

  test('matches the TypeScript navigation UI state at route progress', () {
    final routeDistancePixels = calculateRouteDistance(model.routePath);
    final routePosition = interpolateRoutePosition(model.routePath, 506);

    final state = createNavigationUiState(
      distanceRemainingPixels: routeDistancePixels - 506,
      routeDistancePixels: routeDistancePixels,
      routePath: model.routePath,
      routePosition: routePosition,
      status: SimulationStatus.ready,
    );

    expect(state.currentSegment, 'node-19 -> node-18');
    expect(state.progressPercent.round(), 20);
    expect(state.distanceRemainingPixels.round(), 2036);
    expect(state.status, SimulationStatus.ready);
  });

  test('clamps progress, reports arrival, and formats every instruction', () {
    final beforeStart = createNavigationUiState(
      distanceRemainingPixels: 10,
      routeDistancePixels: 100,
      routePath: model.routePath,
      routePosition: interpolateRoutePosition(model.routePath, -10),
      status: SimulationStatus.ready,
    );
    final arrived = createNavigationUiState(
      distanceRemainingPixels: 0,
      routeDistancePixels: 0,
      routePath: model.routePath,
      routePosition: interpolateRoutePosition(
        model.routePath,
        calculateRouteDistance(model.routePath),
      ),
      status: SimulationStatus.arrived,
    );

    expect(beforeStart.progressPercent, 0);
    expect(arrived.progressPercent, 0);
    expect(arrived.currentSegment, 'node-2 -> node-1');
    expect(arrived.instruction, NavigationTurn.arrived);
    expect(
      formatNavigationInstruction(NavigationTurn.straight),
      'Continue straight',
    );
    expect(formatNavigationInstruction(NavigationTurn.left), 'Turn left');
    expect(formatNavigationInstruction(NavigationTurn.right), 'Turn right');
    expect(formatNavigationInstruction(NavigationTurn.arrived), 'Arrived');
  });

  test('returns Arrived for negative or out-of-range segment indices', () {
    expect(
      getCurrentSegmentLabel(routePath: model.routePath, segmentIndex: -1),
      'Arrived',
    );
    expect(
      getCurrentSegmentLabel(routePath: model.routePath, segmentIndex: 99),
      'Arrived',
    );
  });
}
