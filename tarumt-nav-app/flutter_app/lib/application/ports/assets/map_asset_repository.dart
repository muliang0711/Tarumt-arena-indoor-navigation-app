/// Supplies the two JSON documents used to construct an indoor map.
///
/// Implementations return the source text unchanged. JSON decoding and domain
/// validation deliberately remain outside this infrastructure boundary.
abstract interface class MapAssetRepository {
  Future<String> loadTiledMapJson(String assetPath);

  Future<String> loadRouteGraphEdgesJson(String assetPath);
}
