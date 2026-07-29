const mainCampusMapId = 'main-campus';
const mainCampusMapRevision =
    'sha256:9ce75cc7224ccc08e343761fb981c1625ca1b58231db1eb9c7270f1cf0a7865b';

class MapGraphBundle {
  MapGraphBundle({
    required this.schemaVersion,
    required this.mapId,
    required this.mapRevision,
    required List<MapGraphFloor> floors,
    required List<MapGraphEdge> interFloorEdges,
  }) : floors = List.unmodifiable(floors),
       interFloorEdges = List.unmodifiable(interFloorEdges),
       _nodesById = Map.unmodifiable({
         for (final floor in floors)
           for (final node in floor.nodes) node.nodeId: node,
       }),
       _edgesById = Map.unmodifiable({
         for (final floor in floors)
           for (final edge in floor.edges) edge.edgeId: edge,
         for (final edge in interFloorEdges) edge.edgeId: edge,
       });

  final int schemaVersion;
  final String mapId;
  final String mapRevision;
  final List<MapGraphFloor> floors;
  final List<MapGraphEdge> interFloorEdges;
  final Map<String, MapGraphNode> _nodesById;
  final Map<String, MapGraphEdge> _edgesById;

  MapGraphFloor floor(String floorId) {
    return floors.singleWhere((floor) => floor.floorId == floorId);
  }

  bool isConnectedRoute({
    required String originNodeId,
    required String destinationNodeId,
    required List<String> plannedEdgeIds,
  }) {
    if (!_nodesById.containsKey(originNodeId) || plannedEdgeIds.isEmpty) {
      return false;
    }
    var current = originNodeId;
    for (final edgeId in plannedEdgeIds) {
      final edge = _edgesById[edgeId];
      if (edge == null) {
        return false;
      }
      if (edge.fromNodeId == current) {
        current = edge.toNodeId;
      } else if (edge.bidirectional && edge.toNodeId == current) {
        current = edge.fromNodeId;
      } else {
        return false;
      }
    }
    return current == destinationNodeId;
  }
}

class MapGraphFloor {
  MapGraphFloor({
    required this.floorId,
    required List<MapGraphNode> nodes,
    required List<MapGraphEdge> edges,
  }) : nodes = List.unmodifiable(nodes),
       edges = List.unmodifiable(edges),
       nodesById = Map.unmodifiable({
         for (final node in nodes) node.nodeId: node,
       }),
       edgesById = Map.unmodifiable({
         for (final edge in edges) edge.edgeId: edge,
       });

  final String floorId;
  final List<MapGraphNode> nodes;
  final List<MapGraphEdge> edges;
  final Map<String, MapGraphNode> nodesById;
  final Map<String, MapGraphEdge> edgesById;

  bool isConnectedRoute({
    required String originNodeId,
    required String destinationNodeId,
    required List<String> plannedEdgeIds,
  }) {
    if (!nodesById.containsKey(originNodeId) || plannedEdgeIds.isEmpty) {
      return false;
    }
    var current = originNodeId;
    for (final edgeId in plannedEdgeIds) {
      final edge = edgesById[edgeId];
      if (edge == null) {
        return false;
      }
      if (edge.fromNodeId == current) {
        current = edge.toNodeId;
      } else if (edge.bidirectional && edge.toNodeId == current) {
        current = edge.fromNodeId;
      } else {
        return false;
      }
    }
    return current == destinationNodeId;
  }
}

class MapGraphNode {
  const MapGraphNode({
    required this.nodeId,
    required this.kind,
    required this.x,
    required this.y,
  });

  final String nodeId;
  final String kind;
  final double x;
  final double y;
}

class MapGraphEdge {
  const MapGraphEdge({
    required this.edgeId,
    required this.fromNodeId,
    required this.toNodeId,
    required this.distance,
    required this.bidirectional,
  });

  final String edgeId;
  final String fromNodeId;
  final String toNodeId;
  final double distance;
  final bool bidirectional;
}
