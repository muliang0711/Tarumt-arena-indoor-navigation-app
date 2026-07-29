import 'package:indoor_navigation/domain/common/geometry_math.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

RoutePosition? resolvePresenceRoutePosition({
  required AnonymousPresence presence,
  required List<OverlayRouteNode> routeNodes,
}) {
  OverlayRouteNode? from;
  OverlayRouteNode? to;
  for (final node in routeNodes) {
    if (node.nodeId == presence.fromNodeId) {
      from = node;
    }
    if (node.nodeId == presence.toNodeId) {
      to = node;
    }
  }
  if (from == null || to == null) {
    return null;
  }

  final progress = clampDouble(presence.edgeProgress, 0, 1);
  return RoutePosition(
    distanceAlongRoute: 0,
    headingDegrees: headingBetweenPoints(from, to),
    screenX: lerpDouble(from.screenX, to.screenX, progress),
    screenY: lerpDouble(from.screenY, to.screenY, progress),
    segmentIndex: 0,
    tiledX: lerpDouble(from.tiledX, to.tiledX, progress),
    tiledY: lerpDouble(from.tiledY, to.tiledY, progress),
  );
}
