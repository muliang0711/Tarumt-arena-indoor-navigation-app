import 'package:indoor_navigation/domain/reroute/reroute_models.dart';

bool isNodeOnRoute({
  required String nodeId,
  required List<String> routeNodeIds,
}) {
  return routeNodeIds.contains(nodeId);
}

bool isLegalGraphMovement({
  required String candidateNodeId,
  required List<RouteGraphEdge> edges,
  required String fromNodeId,
}) {
  return edges.any(
    (edge) =>
        (edge.fromNodeId == fromNodeId && edge.toNodeId == candidateNodeId) ||
        (edge.toNodeId == fromNodeId && edge.fromNodeId == candidateNodeId),
  );
}
