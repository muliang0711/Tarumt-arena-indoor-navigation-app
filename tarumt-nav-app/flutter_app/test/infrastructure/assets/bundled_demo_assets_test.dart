import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/infrastructure/assets/flutter_map_asset_repository.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('bundles exact copies of both demo JSON source documents', () async {
    final repository = FlutterMapAssetRepository();
    final published = await _currentPublishedRevisionDirectory();
    final sourceTmj = await File(
      '${published.path}/floor-2.tmj.json',
    ).readAsString();
    final sourceEdges = await File(
      '${published.path}/floor-2.edges.json',
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
    final published = await _currentPublishedRevisionDirectory();
    final source = await File('${published.path}/floor-2.png').readAsBytes();
    final bundledBytes = Uint8List.sublistView(bundled);

    expect(bundledBytes, source);
  });
}

Future<Directory> _currentPublishedRevisionDirectory() async {
  final mapRoot = Directory('../map-data/main-campus');
  final pointer =
      jsonDecode(await File('${mapRoot.path}/current.json').readAsString())
          as Map<String, Object?>;
  final manifestPath = pointer['manifest_path'];
  if (manifestPath is! String) {
    throw const FormatException('Current Map Bundle pointer has no manifest.');
  }
  return File('${mapRoot.path}/$manifestPath').parent;
}
