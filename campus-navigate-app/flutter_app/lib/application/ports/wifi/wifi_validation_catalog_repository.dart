abstract interface class WifiValidationCatalogRepository {
  Future<String> loadValidationCatalogJson(String assetPath);
}
