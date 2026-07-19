import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_node_mapping.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_node_mapping_parser.dart';

void main() {
  test('parses mapped and explicitly unmapped server nodes', () {
    final registry = parseWifiNodeMappingRegistryJson(_validSource);

    expect(registry.floorId, 'floor-2');
    expect(registry.checkedServerNodeIds, ['server-a', 'server-b']);
    expect(
      registry.resolve(
        'server-a',
        availableLocalNodeIds: {'local-a', 'local-b'},
      ),
      'local-a',
    );
    expect(
      () => registry.resolve(
        'known-unmapped',
        availableLocalNodeIds: {'local-a'},
      ),
      throwsA(
        isA<WifiNodeMappingException>().having(
          (error) => error.code,
          'code',
          WifiNodeMappingErrorCode.knownUnmappedServerNode,
        ),
      ),
    );
    expect(
      () => registry.resolve('unknown', availableLocalNodeIds: {'local-a'}),
      throwsA(
        isA<WifiNodeMappingException>().having(
          (error) => error.code,
          'code',
          WifiNodeMappingErrorCode.unknownServerNode,
        ),
      ),
    );
  });

  test('rejects a mapped node absent from the loaded local map', () {
    final registry = parseWifiNodeMappingRegistryJson(_validSource);

    expect(
      () => registry.resolve('server-a', availableLocalNodeIds: {'local-b'}),
      throwsA(
        isA<WifiNodeMappingException>().having(
          (error) => error.code,
          'code',
          WifiNodeMappingErrorCode.missingLocalNode,
        ),
      ),
    );
  });

  test('strictly rejects schema, fields, duplicates, and overlap', () {
    for (final source in <String>[
      _validSource.replaceFirst('"schemaVersion": 1', '"schemaVersion": 2'),
      _validSource.replaceFirst('"floorId": "floor-2",', ''),
      _validSource.replaceFirst(
        '"localNodeId": "local-a"',
        '"localNodeId": "local-a", "extra": true',
      ),
      _validSource.replaceFirst(
        '{"serverNodeId": "server-b", "localNodeId": "local-b"}',
        '{"serverNodeId": "server-a", "localNodeId": "local-b"}',
      ),
    ]) {
      expect(
        () => parseWifiNodeMappingRegistryJson(source),
        throwsFormatException,
      );
    }

    expect(
      () => parseWifiNodeMappingRegistryJson(
        _validSource.replaceFirst('known-unmapped', 'server-a'),
      ),
      throwsArgumentError,
    );
  });
}

const String _validSource = '''
{
  "schemaVersion": 1,
  "floorId": "floor-2",
  "mappings": [
    {"serverNodeId": "server-a", "localNodeId": "local-a"},
    {"serverNodeId": "server-b", "localNodeId": "local-b"}
  ],
  "unmappedServerNodes": [
    {"serverNodeId": "known-unmapped", "reason": "No exact route node."}
  ]
}
''';
