import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/maps/map_bundle_repository.dart';
import 'package:indoor_navigation/application/ports/maps/map_runtime_resource_repository.dart';
import 'package:indoor_navigation/infrastructure/maps/map_bundle_http_transport.dart';
import 'package:indoor_navigation/infrastructure/maps/remote_map_bundle_repository.dart';
import 'package:indoor_navigation/infrastructure/maps/resolved_map_bundle_adapters.dart';

void main() {
  final configuredBaseUrl =
      Platform.environment['MAP_BUNDLE_INTEGRATION_BASE_URL'];

  test(
    'downloads and consumes the current bundle from a real Gateway',
    () async {
      final cacheRoot = await Directory.systemTemp.createTemp(
        'gateway-map-bundle-integration-',
      );
      addTearDown(() => cacheRoot.delete(recursive: true));
      final repository = RemoteMapBundleRepository(
        baseUrl: Uri.parse(configuredBaseUrl!),
        cacheRoot: cacheRoot,
        transport: DartIoMapBundleHttpTransport(),
      );

      final downloaded = await repository.resolveCurrent('main-campus');
      final runtime = await ResolvedMapRuntimeResourceRepository(
        downloaded,
      ).loadCurrent(floorId: 'floor-2', mapId: 'main-campus');
      final catalog = await ResolvedMapCampusCatalogRepository(
        downloaded,
        floorId: 'floor-2',
      ).loadCampusCatalog();
      final revalidated = await repository.resolveCurrent('main-campus');

      expect(downloaded.source, MapBundleResolutionSource.downloaded);
      expect(downloaded.manifest.assets, hasLength(8));
      expect(runtime.image.kind, MapImageLocationKind.localFile);
      expect(await File(runtime.image.path).exists(), isTrue);
      expect(catalog.defaultFloorId, 'floor-2');
      expect(revalidated.bundleRevision, downloaded.bundleRevision);
      expect(revalidated.source, MapBundleResolutionSource.revalidatedCache);
    },
    skip: configuredBaseUrl == null
        ? 'Set MAP_BUNDLE_INTEGRATION_BASE_URL to a running Gateway.'
        : false,
  );
}
