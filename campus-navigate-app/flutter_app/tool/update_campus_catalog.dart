import 'dart:convert';
import 'dart:io';

import 'package:indoor_navigation/domain/campus/campus_catalog_parser.dart';

const _tmjPath = 'assets/maps/demo_1.tmj.json';
const _nodePath = 'assets/maps/demo_1.nodes.json';
const _edgePath = 'assets/maps/demo_1.edges.json';
const _roomPath = 'assets/campus/main_campus.rooms.json';

void main(List<String> arguments) {
  final shouldWrite = arguments.contains('--write');
  final unknownArguments = arguments
      .where((argument) => argument != '--write' && argument != '--check')
      .toList();
  if (unknownArguments.isNotEmpty) {
    stderr.writeln(
      'Unknown arguments: ${unknownArguments.join(', ')}. '
      'Use --check or --write.',
    );
    exitCode = 64;
    return;
  }

  final tmj = _readObject(_tmjPath);
  final existingNodes = _readObject(_nodePath);
  final rooms = _readObject(_roomPath);
  final generatedNodes = _extractNodes(tmj, existingNodes);
  final mergedRooms = _mergeMissingRooms(rooms, generatedNodes);

  if (shouldWrite) {
    _writeJson(_nodePath, generatedNodes);
    _writeJson(_roomPath, mergedRooms);
  } else {
    _assertNodeCatalogCurrent(existingNodes, generatedNodes);
    if (jsonEncode(rooms) != jsonEncode(mergedRooms)) {
      throw StateError(
        'Room catalog is missing map destinations. '
        'Run: dart run tool/update_campus_catalog.dart --write',
      );
    }
  }

  final catalog = parseCampusCatalogBundle(
    edgeDocumentJson: File(_edgePath).readAsStringSync(),
    nodeCatalogJson: jsonEncode(generatedNodes),
    roomCatalogJson: jsonEncode(mergedRooms),
  );
  final unavailable = catalog.rooms
      .where((room) => !room.navigationAvailable)
      .toList(growable: false);
  stdout.writeln(
    'Campus catalog OK: ${catalog.nodes.length} nodes, '
    '${catalog.rooms.length} rooms, '
    '${unavailable.length} unavailable destination(s).',
  );
  for (final room in unavailable) {
    stdout.writeln(
      '- ${room.id} (${room.navigationNodeId}): ${room.navigationIssue}',
    );
  }
}

Map<String, Object?> _extractNodes(
  Map<String, Object?> tmj,
  Map<String, Object?> existingRoot,
) {
  final layers = tmj['layers']! as List<Object?>;
  final routeLayer = layers.whereType<Map<String, Object?>>().firstWhere(
    (layer) => layer['name'] == 'route-graph-layer',
  );
  final objects = routeLayer['objects']! as List<Object?>;
  final existingEntries = existingRoot['nodes']! as List<Object?>;
  final existingById = <String, Map<String, Object?>>{
    for (final entry in existingEntries.whereType<Map<String, Object?>>())
      entry['id']! as String: entry,
  };
  String? floorId;
  final nodes = <Map<String, Object?>>[];
  for (final object in objects.whereType<Map<String, Object?>>()) {
    if (object['point'] != true || (object['name'] as String).isEmpty) {
      continue;
    }
    final nodeId = object['name']! as String;
    final properties = <String, Object?>{
      for (final property
          in (object['properties']! as List<Object?>)
              .whereType<Map<String, Object?>>())
        property['name']! as String: property['value'],
    };
    final objectFloorId = 'floor-${properties['floor']}';
    floorId ??= objectFloorId;
    if (floorId != objectFloorId) {
      throw StateError('One node catalog cannot mix floors.');
    }
    final previous = existingById[nodeId];
    final roomId = properties['room-id'] ?? previous?['roomId'];
    nodes.add({
      'id': nodeId,
      'sourceObjectId': object['id'],
      'kind': previous?['kind'] ?? (roomId == null ? 'junction' : 'room'),
      'x': object['x'],
      'y': object['y'],
      'roomId': ?roomId,
      if (previous?['label'] != null) 'label': previous!['label'],
    });
  }
  if (nodes.isEmpty || floorId == null) {
    throw StateError('TMJ route-graph-layer contains no route nodes.');
  }
  nodes.sort(
    (left, right) => _nodeNumber(
      left['id']! as String,
    ).compareTo(_nodeNumber(right['id']! as String)),
  );
  final source = existingRoot['source']! as Map<String, Object?>;
  return {
    'schemaVersion': 1,
    'source': {
      'file': _tmjPath.split('/').last,
      'layer': 'route-graph-layer',
      'tiledVersion': tmj['tiledversion'],
    },
    'floorId': floorId,
    'defaultStartNodeId': existingRoot['defaultStartNodeId'],
    'coordinateSystem': existingRoot['coordinateSystem'],
    'nodes': nodes,
    if (source['notes'] != null) 'notes': source['notes'],
  };
}

int _nodeNumber(String nodeId) {
  final match = RegExp(r'^node-(\d+)$').firstMatch(nodeId);
  if (match == null) {
    throw FormatException('Route node id must match node-<number>: $nodeId');
  }
  return int.parse(match.group(1)!);
}

Map<String, Object?> _mergeMissingRooms(
  Map<String, Object?> roomRoot,
  Map<String, Object?> nodeRoot,
) {
  final roomEntries = (roomRoot['rooms']! as List<Object?>)
      .whereType<Map<String, Object?>>()
      .map(Map<String, Object?>.from)
      .toList();
  final existingRoomIds = roomEntries.map((room) => room['id']).toSet();
  final floorId = nodeRoot['floorId']! as String;
  for (final node
      in (nodeRoot['nodes']! as List<Object?>)
          .whereType<Map<String, Object?>>()) {
    final roomId = node['roomId'];
    if (roomId is! String || existingRoomIds.contains(roomId)) {
      continue;
    }
    roomEntries.add({
      'id': roomId,
      'name': node['label'] ?? roomId,
      'roomCode': roomId,
      'floorId': floorId,
      'category': node['kind'] == 'room' ? 'classroom' : 'facility',
      'typeLabel': node['kind'] == 'room' ? 'Classroom' : 'Facility',
      'visual': node['kind'] == 'room' ? 'lectureHall' : 'generic',
      'nodeId': node['id'],
      'walkMinutes': 1,
      'enabled': true,
    });
  }
  return {...roomRoot, 'rooms': roomEntries};
}

void _assertNodeCatalogCurrent(
  Map<String, Object?> existing,
  Map<String, Object?> generated,
) {
  if (jsonEncode(existing) != jsonEncode(generated)) {
    throw StateError(
      'Node catalog is out of date with the TMJ. '
      'Run: dart run tool/update_campus_catalog.dart --write',
    );
  }
}

Map<String, Object?> _readObject(String path) {
  final value = jsonDecode(File(path).readAsStringSync());
  if (value is! Map<String, Object?>) {
    throw FormatException('$path must contain a JSON object.');
  }
  return value;
}

void _writeJson(String path, Map<String, Object?> value) {
  const encoder = JsonEncoder.withIndent('  ');
  File(path).writeAsStringSync('${encoder.convert(value)}\n');
  stdout.writeln('Updated $path');
}
