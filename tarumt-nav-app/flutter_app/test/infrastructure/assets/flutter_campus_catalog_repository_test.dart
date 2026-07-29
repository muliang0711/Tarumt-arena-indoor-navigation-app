import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/infrastructure/assets/flutter_campus_catalog_repository.dart';

void main() {
  test('loads and validates the three bundled campus data sources', () async {
    final bundle = _FakeAssetBundle({
      defaultCampusRoomCatalogAssetPath: File(
        defaultCampusRoomCatalogAssetPath,
      ).readAsStringSync(),
      defaultCampusNodeCatalogAssetPath: File(
        defaultCampusNodeCatalogAssetPath,
      ).readAsStringSync(),
      defaultCampusEdgeCatalogAssetPath: File(
        defaultCampusEdgeCatalogAssetPath,
      ).readAsStringSync(),
    });
    final repository = FlutterCampusCatalogRepository(assetBundle: bundle);

    final catalog = await repository.loadCampusCatalog();

    expect(catalog.rooms, hasLength(14));
    expect(bundle.requestedKeys, [
      defaultCampusRoomCatalogAssetPath,
      defaultCampusNodeCatalogAssetPath,
      defaultCampusEdgeCatalogAssetPath,
    ]);
  });

  test('surfaces asset loading failures', () async {
    final repository = FlutterCampusCatalogRepository(
      assetBundle: _FakeAssetBundle(const {}),
    );

    await expectLater(repository.loadCampusCatalog(), throwsStateError);
  });
}

final class _FakeAssetBundle extends AssetBundle {
  _FakeAssetBundle(this.assets);

  final Map<String, String> assets;
  final List<String> requestedKeys = [];

  @override
  Future<ByteData> load(String key) async {
    requestedKeys.add(key);
    final source = assets[key];
    if (source == null) {
      throw StateError('Missing asset: $key');
    }
    return ByteData.sublistView(Uint8List.fromList(utf8.encode(source)));
  }
}
