import 'package:flutter/services.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_validation_catalog_repository.dart';

final class FlutterWifiValidationCatalogRepository
    implements WifiValidationCatalogRepository {
  FlutterWifiValidationCatalogRepository({AssetBundle? assetBundle})
    : _assetBundle = assetBundle ?? rootBundle;

  final AssetBundle _assetBundle;

  @override
  Future<String> loadValidationCatalogJson(String assetPath) {
    return _assetBundle.loadString(assetPath);
  }
}
