import 'package:flutter/services.dart';
import 'package:indoor_navigation/application/ports/assets/map_asset_repository.dart';

final class FlutterMapAssetRepository implements MapAssetRepository {
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
}
