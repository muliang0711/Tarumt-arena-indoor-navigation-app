import 'dart:math' as math;

import 'package:indoor_navigation/domain/navigation/logic/navigation_instruction.dart';
import 'package:indoor_navigation/domain/navigation/navigation_models.dart';
import 'package:indoor_navigation/domain/simulation/simulation_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

final class NavigationUiState {
  const NavigationUiState({
    required this.currentSegment,
    required this.distanceRemainingPixels,
    required this.instruction,
    required this.progressPercent,
    required this.status,
  });

  final String currentSegment;
  final double distanceRemainingPixels;
  final NavigationTurn instruction;
  final double progressPercent;
  final SimulationStatus status;
}

NavigationUiState createNavigationUiState({
  required double distanceRemainingPixels,
  required double routeDistancePixels,
  required List<OverlayRouteNode> routePath,
  required RoutePosition routePosition,
  required SimulationStatus status,
}) {
  return NavigationUiState(
    currentSegment: getCurrentSegmentLabel(
      routePath: routePath,
      segmentIndex: routePosition.segmentIndex,
    ),
    distanceRemainingPixels: distanceRemainingPixels,
    instruction: getNavigationInstruction(
      routePath: routePath,
      segmentIndex: routePosition.segmentIndex,
      status: status,
    ),
    progressPercent: routeDistancePixels == 0
        ? 0
        : math.min(
            100,
            math.max(
              0,
              routePosition.distanceAlongRoute / routeDistancePixels * 100,
            ),
          ),
    status: status,
  );
}

String getCurrentSegmentLabel({
  required List<OverlayRouteNode> routePath,
  required int segmentIndex,
}) {
  if (segmentIndex < 0) {
    return 'Arrived';
  }
  final from = routePath.elementAtOrNull(segmentIndex);
  final to = routePath.elementAtOrNull(segmentIndex + 1);
  if (from == null || to == null) {
    return 'Arrived';
  }
  return '${from.nodeId} -> ${to.nodeId}';
}

String formatNavigationInstruction(NavigationTurn instruction) {
  return switch (instruction) {
    NavigationTurn.left => 'Turn left',
    NavigationTurn.right => 'Turn right',
    NavigationTurn.arrived => 'Arrived',
    NavigationTurn.straight => 'Continue straight',
  };
}
