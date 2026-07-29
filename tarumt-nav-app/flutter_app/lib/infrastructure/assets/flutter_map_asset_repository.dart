import 'package:flutter/services.dart';
import 'package:indoor_navigation/application/ports/assets/map_asset_repository.dart';
import 'package:indoor_navigation/application/ports/maps/map_runtime_resource_repository.dart';

final class FlutterMapAssetRepository
    implements MapAssetRepository, MapRuntimeResourceRepository {
  FlutterMapAssetRepository({AssetBundle? assetBundle})
    : _assetBundle = assetBundle ?? rootBundle;

  final AssetBundle _assetBundle;

  @override
  Future<String> loadRouteGraphEdgesJson(String assetPath) {
    return _assetBundle.loadString(assetPath);
  }

  @override
  Future<String> loadTiledMapJson(String assetPath) {
    return _assetBundle.loadString(assetPath);
  }

  @override
  Future<MapRuntimeResources> loadCurrent({
    required String floorId,
    required String mapId,
  }) async {
    final sources = await Future.wait(<Future<String>>[
      loadTiledMapJson(defaultTiledMapAssetPath),
      loadRouteGraphEdgesJson(defaultRouteGraphEdgesAssetPath),
    ]);
    return MapRuntimeResources(
      bundleRevision: null,
      edgeDocumentJson: sources[1],
      floorId: floorId,
      graphRevision: null,
      image: const MapImageLocation.bundledAsset(defaultMapImageAssetPath),
      mapId: mapId,
      tiledMapJson: sources[0],
    );
  }
}
