import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/tiled/map/path_segment_model.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

List<OverlayRouteNode> createRoutePath(
  List<OverlayRouteNode> nodes, {
  List<String> nodeIds = testRouteNodeIds,
}) {
  final nodeById = <String, OverlayRouteNode>{
    for (final node in nodes) node.nodeId: node,
  };
  final path = <OverlayRouteNode>[];

  for (final nodeId in nodeIds) {
    final node = nodeById[nodeId];
    if (node == null) {
      throw StateError('Missing test route node: $nodeId');
    }
    path.add(node);
  }

  return path;
}

List<OverlayPathSegment> createRoutePathSegments(
  List<OverlayRouteNode> nodes, {
  List<String> nodeIds = testRouteNodeIds,
}) {
  return createPathSegmentsFromPoints(createRoutePath(nodes, nodeIds: nodeIds));
}
