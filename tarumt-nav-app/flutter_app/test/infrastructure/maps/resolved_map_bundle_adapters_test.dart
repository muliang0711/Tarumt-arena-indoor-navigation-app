import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/maps/map_bundle_repository.dart';
import 'package:indoor_navigation/application/ports/maps/map_runtime_resource_repository.dart';
import 'package:indoor_navigation/domain/map_bundle/map_bundle_manifest_parser.dart';
import 'package:indoor_navigation/infrastructure/maps/resolved_map_bundle_adapters.dart';

const _revision =
    'sha256:a0554887cce7a1249f46d5d819fc851513f137128a4eba6446e54f84202f4493';

void main() {
  late Directory revisionDirectory;
  late ResolvedMapBundle bundle;

  setUpAll(() async {
    revisionDirectory = Directory(
      '../map-data/main-campus/revisions/$_revision',
    );
    final manifest = parseMapBundleManifest(
      await File('${revisionDirectory.path}/manifest.json').readAsString(),
    );
    bundle = ResolvedMapBundle(
      directoryPath: revisionDirectory.path,
      localAssetPaths: <String, String>{
        for (final asset in manifest.assets)
          asset.assetId: '${revisionDirectory.path}/${asset.path}',
      },
      manifest: manifest,
      source: MapBundleResolutionSource.downloaded,
    );
  });

  test('supplies one floor runtime from the pinned bundle', () async {
    final repository = ResolvedMapRuntimeResourceRepository(bundle);

    final resources = await repository.loadCurrent(
      floorId: 'floor-2',
      mapId: 'main-campus',
    );

    expect(resources.bundleRevision, _revision);
    expect(resources.graphRevision, bundle.manifest.graphRevision);
    expect(resources.image.kind, MapImageLocationKind.localFile);
    expect(resources.image.path, endsWith('/floor-2.png'));
    expect(resources.tiledMapJson, contains('"type":"map"'));
    expect(resources.edgeDocumentJson, contains('"kind": "route-graph-edges"'));
  });

  test('builds the campus catalog from the same pinned bundle', () async {
    final catalog = await ResolvedMapCampusCatalogRepository(
      bundle,
      floorId: 'floor-2',
    ).loadCampusCatalog();

    expect(catalog.buildingName, 'Main Campus Building');
    expect(catalog.defaultFloorId, 'floor-2');
    expect(catalog.nodes, hasLength(22));
    expect(catalog.rooms, isNotEmpty);
  });

  test('supplies Wi-Fi node mapping from the same pinned bundle', () async {
    final source = await ResolvedMapWifiNodeMappingRepository(
      bundle,
      floorId: 'floor-2',
    ).loadMappingJson('ignored-for-pinned-bundle');

    expect(source, contains('"floorId": "floor-2"'));
    expect(source, contains('"serverNodeId"'));
  });

  test('rejects a floor absent from the pinned bundle', () async {
    await expectLater(
      ResolvedMapRuntimeResourceRepository(
        bundle,
      ).loadCurrent(floorId: 'floor-9', mapId: 'main-campus'),
      throwsA(isA<StateError>()),
    );
  });
}
