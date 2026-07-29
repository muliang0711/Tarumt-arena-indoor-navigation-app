import 'dart:convert';

import 'map_graph_models.dart';

class MapGraphParser {
  const MapGraphParser();

  MapGraphBundle parse(String source) {
    final root = _object(jsonDecode(source), 'bundle');
    final schemaVersion = _integer(root['schema_version'], 'schema_version');
    if (schemaVersion != 1) {
      throw const FormatException('Unsupported map graph schema version');
    }
    final mapId = _text(root['map_id'], 'map_id');
    final mapRevision = _text(root['map_revision'], 'map_revision');
    if (!RegExp(r'^sha256:[a-f0-9]{64}$').hasMatch(mapRevision)) {
      throw const FormatException('Invalid map_revision');
    }
    final floorValues = _array(root['floors'], 'floors');
    if (floorValues.isEmpty) {
      throw const FormatException('A map graph needs at least one floor');
    }
    final floors = floorValues.map(_parseFloor).toList(growable: false);
    if (floors.map((floor) => floor.floorId).toSet().length != floors.length) {
      throw const FormatException('Duplicate floor_id');
    }
    final interFloorEdges = _array(
      root['inter_floor_edges'],
      'inter_floor_edges',
    ).map(_parseEdge).toList(growable: false);
    _validateGraphEdges(floors, interFloorEdges);
    return MapGraphBundle(
      schemaVersion: schemaVersion,
      mapId: mapId,
      mapRevision: mapRevision,
      floors: floors,
      interFloorEdges: interFloorEdges,
    );
  }

  MapGraphFloor _parseFloor(Object? value) {
    final source = _object(value, 'floor');
    final floorId = _text(source['floor_id'], 'floor_id');
    final nodes = _array(
      source['nodes'],
      'nodes',
    ).map(_parseNode).toList(growable: false);
    final edges = _array(
      source['edges'],
      'edges',
    ).map(_parseEdge).toList(growable: false);
    if (nodes.isEmpty) {
      throw const FormatException('A floor needs at least one node');
    }
    if (nodes.map((node) => node.nodeId).toSet().length != nodes.length) {
      throw const FormatException('Duplicate node_id');
    }
    if (edges.map((edge) => edge.edgeId).toSet().length != edges.length) {
      throw const FormatException('Duplicate edge_id');
    }
    final nodeIds = nodes.map((node) => node.nodeId).toSet();
    for (final edge in edges) {
      if (!nodeIds.contains(edge.fromNodeId) ||
          !nodeIds.contains(edge.toNodeId)) {
        throw const FormatException('Edge references an unknown node');
      }
    }
    return MapGraphFloor(floorId: floorId, nodes: nodes, edges: edges);
  }

  void _validateGraphEdges(
    List<MapGraphFloor> floors,
    List<MapGraphEdge> interFloorEdges,
  ) {
    final nodeFloors = <String, String>{};
    final edgeIds = <String>{};
    for (final floor in floors) {
      for (final node in floor.nodes) {
        if (nodeFloors.putIfAbsent(node.nodeId, () => floor.floorId) !=
            floor.floorId) {
          throw const FormatException('Duplicate node_id across floors');
        }
      }
      for (final edge in floor.edges) {
        if (!edgeIds.add(edge.edgeId)) {
          throw const FormatException('Duplicate edge_id across floors');
        }
      }
    }
    for (final edge in interFloorEdges) {
      if (!edgeIds.add(edge.edgeId)) {
        throw const FormatException('Duplicate edge_id across floors');
      }
      final fromFloor = nodeFloors[edge.fromNodeId];
      final toFloor = nodeFloors[edge.toNodeId];
      if (fromFloor == null || toFloor == null || fromFloor == toFloor) {
        throw const FormatException(
          'Inter-floor edge must connect nodes on different floors',
        );
      }
    }
  }

  MapGraphNode _parseNode(Object? value) {
    final source = _object(value, 'node');
    final kind = _text(source['kind'], 'kind');
    if (!const {'junction', 'room', 'connector'}.contains(kind)) {
      throw const FormatException('Invalid node kind');
    }
    return MapGraphNode(
      nodeId: _text(source['node_id'], 'node_id'),
      kind: kind,
      x: _number(source['x'], 'x'),
      y: _number(source['y'], 'y'),
    );
  }

  MapGraphEdge _parseEdge(Object? value) {
    final source = _object(value, 'edge');
    final distance = _number(source['distance'], 'distance');
    if (distance <= 0) {
      throw const FormatException('Edge distance must be positive');
    }
    final bidirectional = source['bidirectional'];
    if (bidirectional is! bool) {
      throw const FormatException('bidirectional must be a boolean');
    }
    return MapGraphEdge(
      edgeId: _text(source['edge_id'], 'edge_id'),
      fromNodeId: _text(source['from_node_id'], 'from_node_id'),
      toNodeId: _text(source['to_node_id'], 'to_node_id'),
      distance: distance,
      bidirectional: bidirectional,
    );
  }

  Map<String, Object?> _object(Object? value, String field) {
    if (value is! Map<String, Object?>) {
      throw FormatException('$field must be an object');
    }
    return value;
  }

  List<Object?> _array(Object? value, String field) {
    if (value is! List<Object?>) {
      throw FormatException('$field must be an array');
    }
    return value;
  }

  String _text(Object? value, String field) {
    if (value is! String || value.trim().isEmpty) {
      throw FormatException('$field must be a non-empty string');
    }
    return value.trim();
  }

  int _integer(Object? value, String field) {
    if (value is! int) {
      throw FormatException('$field must be an integer');
    }
    return value;
  }

  double _number(Object? value, String field) {
    if (value is! num) {
      throw FormatException('$field must be a number');
    }
    return value.toDouble();
  }
}
