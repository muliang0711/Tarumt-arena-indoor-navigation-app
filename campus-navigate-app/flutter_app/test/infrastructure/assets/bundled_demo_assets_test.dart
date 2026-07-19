import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/infrastructure/assets/flutter_map_asset_repository.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('bundles exact copies of both demo JSON source documents', () async {
    final repository = FlutterMapAssetRepository();
    final sourceTmj = await File(
      '../expo-app/assets/maps/demo_1.tmj.json',
    ).readAsString();
    final sourceEdges = await File(
      '../expo-app/assets/maps/demo_1.edges.json',
    ).readAsString();

    expect(
      await repository.loadTiledMapJson('assets/maps/demo_1.tmj.json'),
      sourceTmj,
    );
    expect(
      await repository.loadRouteGraphEdgesJson('assets/maps/demo_1.edges.json'),
      sourceEdges,
    );
  });

  test('bundles an exact byte copy of the demo PNG', () async {
    final bundled = await rootBundle.load('assets/maps/demo_1.png');
    final source = await File(
      '../expo-app/assets/maps/demo_1.png',
    ).readAsBytes();
    final bundledBytes = Uint8List.sublistView(bundled);

    expect(bundledBytes, source);
  });
}
