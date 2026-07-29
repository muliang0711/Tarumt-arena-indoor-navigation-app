import 'dart:convert';

import 'package:indoor_navigation/domain/wifi_positioning/wifi_node_mapping.dart';

WifiNodeMappingRegistry parseWifiNodeMappingRegistryJson(String source) {
  final decoded = jsonDecode(source);
  if (decoded is! Map<String, Object?>) {
    throw const FormatException('Wi-Fi node mapping must be an object.');
  }
  _expectKeys(decoded, const {
    'schemaVersion',
    'floorId',
    'mappings',
    'unmappedServerNodes',
  });
  if (_requiredInt(decoded, 'schemaVersion') != 1) {
    throw const FormatException('Unsupported Wi-Fi node mapping schema.');
  }

  final mappings = <String, String>{};
  for (final raw in _requiredList(decoded, 'mappings')) {
    final entry = _requiredMap(raw, 'mapping');
    _expectKeys(entry, const {'serverNodeId', 'localNodeId'});
    final serverNodeId = _requiredString(entry, 'serverNodeId');
    if (mappings.containsKey(serverNodeId)) {
      throw FormatException('Duplicate mapped server node: $serverNodeId');
    }
    mappings[serverNodeId] = _requiredString(entry, 'localNodeId');
  }

  final unmapped = <String, String>{};
  for (final raw in _requiredList(decoded, 'unmappedServerNodes')) {
    final entry = _requiredMap(raw, 'unmapped server node');
    _expectKeys(entry, const {'serverNodeId', 'reason'});
    final serverNodeId = _requiredString(entry, 'serverNodeId');
    if (unmapped.containsKey(serverNodeId)) {
      throw FormatException('Duplicate unmapped server node: $serverNodeId');
    }
    unmapped[serverNodeId] = _requiredString(entry, 'reason');
  }

  return WifiNodeMappingRegistry(
    floorId: _requiredString(decoded, 'floorId'),
    mappings: mappings,
    unmappedServerNodes: unmapped,
  );
}

Map<String, Object?> _requiredMap(Object? value, String label) {
  if (value is Map<String, Object?>) return value;
  throw FormatException('$label must be an object.');
}

List<Object?> _requiredList(Map<String, Object?> source, String key) {
  final value = source[key];
  if (value is List<Object?>) return value;
  throw FormatException('$key must be an array.');
}

String _requiredString(Map<String, Object?> source, String key) {
  final value = source[key];
  if (value is String && value.trim().isNotEmpty) return value.trim();
  throw FormatException('$key must be a non-empty string.');
}

int _requiredInt(Map<String, Object?> source, String key) {
  final value = source[key];
  if (value is int) return value;
  throw FormatException('$key must be an integer.');
}

void _expectKeys(Map<String, Object?> map, Set<String> expected) {
  final actual = map.keys.toSet();
  if (actual.length != expected.length || !actual.containsAll(expected)) {
    throw FormatException('Expected fields $expected, got $actual.');
  }
}
