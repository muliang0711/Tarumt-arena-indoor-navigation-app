import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/infrastructure/wifi_positioning/flutter_wifi_node_mapping_repository.dart';

void main() {
  test('loads and preserves the requested mapping source', () async {
    const source = '{\n  "schemaVersion": 1\n}\n';
    final bundle = _FakeAssetBundle({'mapping.json': source});
    final repository = FlutterWifiNodeMappingRepository(assetBundle: bundle);

    expect(await repository.loadMappingJson('mapping.json'), source);
    expect(bundle.requestedKeys, ['mapping.json']);
  });
}

final class _FakeAssetBundle extends AssetBundle {
  _FakeAssetBundle(this.assets);

  final Map<String, String> assets;
  final List<String> requestedKeys = <String>[];

  @override
  Future<ByteData> load(String key) async {
    requestedKeys.add(key);
    return ByteData.sublistView(Uint8List.fromList(utf8.encode(assets[key]!)));
  }
}
