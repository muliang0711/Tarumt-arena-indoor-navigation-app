abstract interface class WifiNodeMappingRepository {
  Future<String> loadMappingJson(String assetPath);
}
