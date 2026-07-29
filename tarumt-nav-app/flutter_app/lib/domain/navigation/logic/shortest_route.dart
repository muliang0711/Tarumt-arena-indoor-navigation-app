import 'package:indoor_navigation/domain/edge_editor/edge_editor_models.dart';

List<String> findShortestRouteNodeIds({
  required String destinationNodeId,
  required List<RouteGraphEdgeExport> edges,
  required String startNodeId,
}) {
  if (startNodeId == destinationNodeId) {
    return [startNodeId];
  }

  final adjacency = <String, List<_RouteNeighbor>>{};
  final connectedPairs = <String>{};
  for (final edge in edges) {
    if (edge.distance <= 0) {
      throw StateError('EDGE distance must be positive for ${edge.id}.');
    }
    final pair = _edgePair(edge.from, edge.to);
    if (!connectedPairs.add(pair)) {
      continue;
    }
    adjacency
        .putIfAbsent(edge.from, () => [])
        .add(_RouteNeighbor(nodeId: edge.to, distance: edge.distance));
    adjacency
        .putIfAbsent(edge.to, () => [])
        .add(_RouteNeighbor(nodeId: edge.from, distance: edge.distance));
  }
  if (!adjacency.containsKey(startNodeId)) {
    throw StateError('Unknown navigation start node: $startNodeId.');
  }
  if (!adjacency.containsKey(destinationNodeId)) {
    throw StateError(
      'Destination $destinationNodeId is not connected to the route graph.',
    );
  }

  final unvisited = adjacency.keys.toSet();
  final distanceByNode = <String, double>{
    for (final nodeId in adjacency.keys) nodeId: double.infinity,
    startNodeId: 0,
  };
  final previousByNode = <String, String>{};

  while (unvisited.isNotEmpty) {
    final current = unvisited.reduce((left, right) {
      final leftDistance = distanceByNode[left]!;
      final rightDistance = distanceByNode[right]!;
      if (leftDistance == rightDistance) {
        return left.compareTo(right) <= 0 ? left : right;
      }
      return leftDistance < rightDistance ? left : right;
    });
    final currentDistance = distanceByNode[current]!;
    if (!currentDistance.isFinite || current == destinationNodeId) {
      break;
    }
    unvisited.remove(current);
    for (final neighbor in adjacency[current]!) {
      if (!unvisited.contains(neighbor.nodeId)) {
        continue;
      }
      final candidateDistance = currentDistance + neighbor.distance;
      final knownDistance = distanceByNode[neighbor.nodeId]!;
      final knownPrevious = previousByNode[neighbor.nodeId];
      if (candidateDistance < knownDistance ||
          (candidateDistance == knownDistance &&
              (knownPrevious == null ||
                  current.compareTo(knownPrevious) < 0))) {
        distanceByNode[neighbor.nodeId] = candidateDistance;
        previousByNode[neighbor.nodeId] = current;
      }
    }
  }

  if (previousByNode[destinationNodeId] == null) {
    throw StateError(
      'Destination $destinationNodeId is not reachable from $startNodeId.',
    );
  }
  final reversedPath = <String>[destinationNodeId];
  var current = destinationNodeId;
  while (current != startNodeId) {
    current = previousByNode[current]!;
    reversedPath.add(current);
  }
  return reversedPath.reversed.toList(growable: false);
}

String _edgePair(String left, String right) {
  return left.compareTo(right) <= 0 ? '$left\u0000$right' : '$right\u0000$left';
}

final class _RouteNeighbor {
  const _RouteNeighbor({required this.distance, required this.nodeId});

  final double distance;
  final String nodeId;
}
