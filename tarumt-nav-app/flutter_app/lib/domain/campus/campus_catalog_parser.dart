import 'dart:convert';

import 'package:indoor_navigation/domain/campus/campus_catalog_models.dart';
import 'package:indoor_navigation/domain/campus/campus_floor.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';
import 'package:indoor_navigation/domain/edge_editor/logic/route_graph_edge_model.dart';

CampusCatalog parseCampusCatalogBundle({
  required String edgeDocumentJson,
  required String nodeCatalogJson,
  required String roomCatalogJson,
}) {
  final roomRoot = _map(jsonDecode(roomCatalogJson), r'$');
  final nodeRoot = _map(jsonDecode(nodeCatalogJson), r'$nodes');
  final roomSchemaVersion = _integer(
    roomRoot['schemaVersion'],
    r'$.schemaVersion',
  );
  final nodeSchemaVersion = _integer(
    nodeRoot['schemaVersion'],
    r'$nodes.schemaVersion',
  );
  if (roomSchemaVersion != 1 || nodeSchemaVersion != 1) {
    throw const FormatException('Campus catalog schemaVersion must be 1.');
  }

  final building = _map(roomRoot['building'], r'$.building');
  final buildingName = _nonEmptyString(building['name'], r'$.building.name');
  final defaultFloorId = _nonEmptyString(
    building['defaultFloorId'],
    r'$.building.defaultFloorId',
  );
  final floorEntries = _list(roomRoot['floors'], r'$.floors');
  if (floorEntries.isEmpty) {
    throw const FormatException(r'$.floors must not be empty.');
  }
  final floors = <CampusFloor>[];
  final floorAssets = <CampusFloorMapAssets>[];
  final floorIds = <String>{};
  for (var index = 0; index < floorEntries.length; index++) {
    final path = '\$.floors[$index]';
    final entry = _map(floorEntries[index], path);
    final floorId = _nonEmptyString(entry['id'], '$path.id');
    if (!floorIds.add(floorId)) {
      throw FormatException('Duplicate floor id: $floorId.');
    }
    floors.add(
      CampusFloor(
        code: _nonEmptyString(entry['code'], '$path.code'),
        id: floorId,
        name: _nonEmptyString(entry['name'], '$path.name'),
        plan: _parseFloorPlan(entry['plan'], '$path.plan'),
        suggested: _boolean(entry['suggested'], '$path.suggested'),
        summary: _nonEmptyString(entry['summary'], '$path.summary'),
        tags: _list(entry['tags'], '$path.tags')
            .asMap()
            .entries
            .map((tag) => _nonEmptyString(tag.value, '$path.tags[${tag.key}]'))
            .toList(growable: false),
      ),
    );
    floorAssets.add(
      CampusFloorMapAssets(
        edgeAsset: _nonEmptyString(entry['edgeAsset'], '$path.edgeAsset'),
        floorId: floorId,
        mapAsset: _nonEmptyString(entry['mapAsset'], '$path.mapAsset'),
        nodeAsset: _nonEmptyString(entry['nodeAsset'], '$path.nodeAsset'),
      ),
    );
  }
  if (!floorIds.contains(defaultFloorId)) {
    throw FormatException('Unknown default floor: $defaultFloorId.');
  }

  final nodeFloorId = _nonEmptyString(nodeRoot['floorId'], r'$nodes.floorId');
  if (!floorIds.contains(nodeFloorId)) {
    throw FormatException('Node catalog uses unknown floor: $nodeFloorId.');
  }
  final startNodeId = _nonEmptyString(
    nodeRoot['defaultStartNodeId'],
    r'$nodes.defaultStartNodeId',
  );
  final nodeEntries = _list(nodeRoot['nodes'], r'$nodes.nodes');
  final nodes = <CampusMapNode>[];
  final nodesById = <String, CampusMapNode>{};
  final nodesByRoomId = <String, CampusMapNode>{};
  for (var index = 0; index < nodeEntries.length; index++) {
    final path = '\$nodes.nodes[$index]';
    final entry = _map(nodeEntries[index], path);
    final nodeId = _nonEmptyString(entry['id'], '$path.id');
    final roomId = _optionalString(entry['roomId'], '$path.roomId');
    final node = CampusMapNode(
      floorId: nodeFloorId,
      id: nodeId,
      kind: _parseNodeKind(entry['kind'], '$path.kind'),
      label: _optionalString(entry['label'], '$path.label'),
      roomId: roomId,
      sourceObjectId: _integer(entry['sourceObjectId'], '$path.sourceObjectId'),
      x: _number(entry['x'], '$path.x'),
      y: _number(entry['y'], '$path.y'),
    );
    if (nodesById[nodeId] != null) {
      throw FormatException('Duplicate node id: $nodeId.');
    }
    if (roomId != null && nodesByRoomId[roomId] != null) {
      throw FormatException('Duplicate node roomId: $roomId.');
    }
    nodes.add(node);
    nodesById[nodeId] = node;
    if (roomId != null) {
      nodesByRoomId[roomId] = node;
    }
  }
  if (nodesById[startNodeId] == null) {
    throw FormatException('Unknown default start node: $startNodeId.');
  }

  final edgeDocument = parseRouteGraphEdgeDocumentJson(edgeDocumentJson);
  final adjacency = <String, Set<String>>{
    for (final nodeId in nodesById.keys) nodeId: <String>{},
  };
  for (final edge in edgeDocument.edges) {
    if (nodesById[edge.from] == null || nodesById[edge.to] == null) {
      throw FormatException(
        'EDGE ${edge.id} references an unknown node: '
        '${edge.from} -> ${edge.to}.',
      );
    }
    adjacency[edge.from]!.add(edge.to);
    adjacency[edge.to]!.add(edge.from);
  }
  final reachableNodeIds = _reachableNodes(adjacency, startNodeId);

  final roomEntries = _list(roomRoot['rooms'], r'$.rooms');
  final rooms = <CampusRoom>[];
  final roomIds = <String>{};
  for (var index = 0; index < roomEntries.length; index++) {
    final path = '\$.rooms[$index]';
    final entry = _map(roomEntries[index], path);
    final roomId = _nonEmptyString(entry['id'], '$path.id');
    final floorId = _nonEmptyString(entry['floorId'], '$path.floorId');
    final nodeId = _nonEmptyString(entry['nodeId'], '$path.nodeId');
    final enabled = _boolean(entry['enabled'], '$path.enabled');
    if (!roomIds.add(roomId)) {
      throw FormatException('Duplicate room id: $roomId.');
    }
    if (!floorIds.contains(floorId)) {
      throw FormatException('Room $roomId uses unknown floor: $floorId.');
    }
    final node = nodesById[nodeId];
    if (node == null) {
      throw FormatException('Room $roomId uses unknown node: $nodeId.');
    }
    if (node.floorId != floorId) {
      throw FormatException(
        'Room $roomId and node $nodeId use different floors.',
      );
    }
    if (node.roomId != roomId) {
      throw FormatException(
        'Room $roomId does not match node $nodeId roomId ${node.roomId}.',
      );
    }
    final reachable = reachableNodeIds.contains(nodeId);
    rooms.add(
      CampusRoom(
        category: _parseRoomCategory(entry['category'], '$path.category'),
        floorId: floorId,
        id: roomId,
        name: _nonEmptyString(entry['name'], '$path.name'),
        navigationAvailable: enabled && reachable,
        navigationIssue: !enabled
            ? 'This destination is disabled in the room catalog.'
            : !reachable
            ? 'This destination is not connected to the route graph.'
            : null,
        navigationNodeId: nodeId,
        roomCode: _nonEmptyString(entry['roomCode'], '$path.roomCode'),
        typeLabel: _nonEmptyString(entry['typeLabel'], '$path.typeLabel'),
        visual: _parseRoomVisual(entry['visual'], '$path.visual'),
        walkMinutes: _integer(entry['walkMinutes'], '$path.walkMinutes'),
      ),
    );
  }
  final missingRoomIds = nodesByRoomId.keys
      .where((roomId) => !roomIds.contains(roomId))
      .toList(growable: false);
  if (missingRoomIds.isNotEmpty) {
    throw FormatException(
      'Node roomIds missing from room catalog: ${missingRoomIds.join(', ')}.',
    );
  }

  return CampusCatalog(
    buildingName: buildingName,
    defaultFloorId: defaultFloorId,
    floorMapAssets: floorAssets,
    floors: floors,
    nodes: nodes,
    rooms: rooms,
    schemaVersion: roomSchemaVersion,
    startNodeId: startNodeId,
  );
}

Set<String> _reachableNodes(Map<String, Set<String>> adjacency, String start) {
  final reachable = <String>{start};
  final queue = <String>[start];
  for (var index = 0; index < queue.length; index++) {
    for (final neighbor in adjacency[queue[index]]!) {
      if (reachable.add(neighbor)) {
        queue.add(neighbor);
      }
    }
  }
  return reachable;
}

CampusFloorPlan _parseFloorPlan(Object? value, String path) {
  final name = _nonEmptyString(value, path);
  return CampusFloorPlan.values
          .where((item) => item.name == name)
          .firstOrNull ??
      (throw FormatException('$path has unsupported floor plan: $name.'));
}

CampusMapNodeKind _parseNodeKind(Object? value, String path) {
  final name = _nonEmptyString(value, path);
  return CampusMapNodeKind.values
          .where((item) => item.name == name)
          .firstOrNull ??
      (throw FormatException('$path has unsupported node kind: $name.'));
}

CampusRoomCategory _parseRoomCategory(Object? value, String path) {
  final name = _nonEmptyString(value, path);
  return CampusRoomCategory.values
          .where((item) => item.name == name)
          .firstOrNull ??
      (throw FormatException('$path has unsupported room category: $name.'));
}

CampusRoomVisual _parseRoomVisual(Object? value, String path) {
  final name = _nonEmptyString(value, path);
  return CampusRoomVisual.values
          .where((item) => item.name == name)
          .firstOrNull ??
      (throw FormatException('$path has unsupported room visual: $name.'));
}

Map<String, Object?> _map(Object? value, String path) {
  if (value is! Map<String, Object?>) {
    throw FormatException('$path must be an object.');
  }
  return value;
}

List<Object?> _list(Object? value, String path) {
  if (value is! List<Object?>) {
    throw FormatException('$path must be an array.');
  }
  return value;
}

String _nonEmptyString(Object? value, String path) {
  if (value is! String || value.trim().isEmpty) {
    throw FormatException('$path must be a non-empty string.');
  }
  return value.trim();
}

String? _optionalString(Object? value, String path) {
  if (value == null) {
    return null;
  }
  return _nonEmptyString(value, path);
}

int _integer(Object? value, String path) {
  if (value is! int) {
    throw FormatException('$path must be an integer.');
  }
  return value;
}

double _number(Object? value, String path) {
  if (value is! num || !value.isFinite) {
    throw FormatException('$path must be a finite number.');
  }
  return value.toDouble();
}

bool _boolean(Object? value, String path) {
  if (value is! bool) {
    throw FormatException('$path must be a boolean.');
  }
  return value;
}
