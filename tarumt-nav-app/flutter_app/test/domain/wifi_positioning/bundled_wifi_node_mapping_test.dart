import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_node_mapping_parser.dart';

void main() {
  test(
    'bundled mapping resolves only IDs present in the local floor graph',
    () async {
    final mappingSource = await File(
      'assets/positioning/floor-2.wifi-node-mapping.json',
    ).readAsString();
    final nodesSource = await File(
      'assets/maps/demo_1.nodes.json',
      ).readAsString();
      final registry = parseWifiNodeMappingRegistryJson(mappingSource);
      final nodesDocument = jsonDecode(nodesSource) as Map<String, Object?>;
      final nodes = nodesDocument['nodes']! as List<Object?>;
      final localNodeIds = nodes
          .map((raw) => (raw! as Map<String, Object?>)['id']! as String)
          .toSet();

      expect(registry.floorId, 'floor-2');
      expect(registry.mappings, hasLength(11));
      expect(registry.unmappedServerNodes, hasLength(2));
      expect(localNodeIds.containsAll(registry.mappings.values), isTrue);
      expect(
        registry.checkedServerNodeIds,
        isNot(contains('center-of-road-north-of-elevwest')),
      );
      expect(
        registry.checkedServerNodeIds,
        isNot(contains('west-of-TA246door-opp-TA254')),
      );
    },
  );
}
