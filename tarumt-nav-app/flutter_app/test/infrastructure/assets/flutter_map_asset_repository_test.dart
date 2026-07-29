import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/infrastructure/assets/flutter_map_asset_repository.dart';

void main() {
  test('loads the requested TMJ path and preserves source text', () async {
    const source = '{\n  "name": "café",\n  "layers": []\n}\n';
    final bundle = _FakeAssetBundle(<String, String>{
      'assets/maps/floor.tmj.json': source,
    });
    final repository = FlutterMapAssetRepository(assetBundle: bundle);

    final result = await repository.loadTiledMapJson(
      'assets/maps/floor.tmj.json',
    );

    expect(result, source);
    expect(bundle.requestedKeys, <String>['assets/maps/floor.tmj.json']);
  });

  test('loads the requested EDGE path without decoding JSON', () async {
    const source = '  [ { "from": "a", "to": "b" } ]  ';
    final bundle = _FakeAssetBundle(<String, String>{
      'assets/maps/floor.edges.json': source,
    });
    final repository = FlutterMapAssetRepository(assetBundle: bundle);

    final result = await repository.loadRouteGraphEdgesJson(
      'assets/maps/floor.edges.json',
    );

    expect(result, source);
    expect(bundle.requestedKeys, <String>['assets/maps/floor.edges.json']);
  });

  test('surfaces AssetBundle loading errors unchanged', () async {
    final error = StateError('missing asset');
    final bundle = _FakeAssetBundle(<String, String>{}, error: error);
    final repository = FlutterMapAssetRepository(assetBundle: bundle);

    await expectLater(
      repository.loadTiledMapJson('missing.json'),
      throwsA(same(error)),
    );
  });
}

final class _FakeAssetBundle extends AssetBundle {
  _FakeAssetBundle(this._assets, {this.error});

  final Map<String, String> _assets;
  final Object? error;
  final List<String> requestedKeys = <String>[];

  @override
  Future<ByteData> load(String key) async {
    requestedKeys.add(key);
    final loadError = error;
    if (loadError != null) {
      throw loadError;
    }
    final source = _assets[key];
    if (source == null) {
      throw StateError('Missing asset: $key');
    }
    return ByteData.sublistView(Uint8List.fromList(utf8.encode(source)));
  }
}
