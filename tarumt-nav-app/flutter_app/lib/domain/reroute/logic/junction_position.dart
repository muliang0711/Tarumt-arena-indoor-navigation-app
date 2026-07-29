import 'package:indoor_navigation/domain/common/geometry_math.dart';
import 'package:indoor_navigation/domain/reroute/reroute_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

OverlayRouteNode? findCurrentJunctionNode({
  required WrongWayRerouteConfig config,
  required RoutePosition position,
  required List<OverlayRouteNode> routeNodes,
}) {
  OverlayRouteNode? nearestJunction;
  double? nearestDistancePixels;

  for (final node in routeNodes) {
    if (!isJunctionNodeType(config: config, nodeType: node.type)) {
      continue;
    }

    final distancePixels = distanceBetweenPoints(node, position);
    if (nearestDistancePixels == null ||
        distancePixels < nearestDistancePixels) {
      nearestJunction = node;
      nearestDistancePixels = distancePixels;
    }
  }

  if (nearestJunction == null ||
      nearestDistancePixels == null ||
      nearestDistancePixels > config.junctionCaptureRadiusPixels) {
    return null;
  }

  return nearestJunction;
}

bool isJunctionNodeType({
  required WrongWayRerouteConfig config,
  required String nodeType,
}) {
  return nodeType.trim().toLowerCase() ==
      config.junctionNodeType.trim().toLowerCase();
}
