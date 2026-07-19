import 'package:indoor_navigation/domain/navigation/navigation_models.dart';
import 'package:indoor_navigation/domain/simulation/simulation_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

NavigationTurn getNavigationInstruction({
  required List<OverlayRouteNode> routePath,
  required int segmentIndex,
  required SimulationStatus status,
}) {
  if (status == SimulationStatus.arrived ||
      segmentIndex >= routePath.length - 1) {
    return NavigationTurn.arrived;
  }

  if (segmentIndex < 0 || segmentIndex + 2 >= routePath.length) {
    return NavigationTurn.straight;
  }

  final currentFrom = routePath[segmentIndex];
  final currentTo = routePath[segmentIndex + 1];
  final nextTo = routePath[segmentIndex + 2];
  final currentVectorX = currentTo.screenX - currentFrom.screenX;
  final currentVectorY = currentTo.screenY - currentFrom.screenY;
  final nextVectorX = nextTo.screenX - currentTo.screenX;
  final nextVectorY = nextTo.screenY - currentTo.screenY;
  final cross = currentVectorX * nextVectorY - currentVectorY * nextVectorX;

  if (cross.abs() < 0.001) {
    return NavigationTurn.straight;
  }

  return cross > 0 ? NavigationTurn.right : NavigationTurn.left;
}
