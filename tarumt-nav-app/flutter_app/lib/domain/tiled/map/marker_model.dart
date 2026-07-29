import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

BlueMarkerState createBlueMarkerState(
  List<OverlayRouteNode> nodes, {
  String startNodeId = defaultNavigationStartNodeId,
}) {
  OverlayRouteNode? startNode;
  for (final node in nodes) {
    if (node.nodeId == startNodeId) {
      startNode = node;
      break;
    }
  }
  if (startNode == null) {
    throw StateError('Missing blue marker route start node: $startNodeId');
  }

  return BlueMarkerState(
    routeNodeId: startNode.nodeId,
    tiledX: startNode.tiledX,
    tiledY: startNode.tiledY,
    screenX: startNode.screenX,
    screenY: startNode.screenY,
  );
}

RedMarkerState createRedMarkerState(BlueMarkerState blueMarker) {
  return RedMarkerState(
    headingDegrees: 0,
    tiledX: blueMarker.tiledX + 34,
    tiledY: blueMarker.tiledY + 28,
    screenX: blueMarker.screenX + 34,
    screenY: blueMarker.screenY + 28,
  );
}
