import 'package:flutter/services.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_node_mapping_repository.dart';

final class FlutterWifiNodeMappingRepository
    implements WifiNodeMappingRepository {
  FlutterWifiNodeMappingRepository({AssetBundle? assetBundle})
    : _assetBundle = assetBundle ?? rootBundle;

  final AssetBundle _assetBundle;

  @override
  Future<String> loadMappingJson(String assetPath) {
    return _assetBundle.loadString(assetPath);
  }
}
