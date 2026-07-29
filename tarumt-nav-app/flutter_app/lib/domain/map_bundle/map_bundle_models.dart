enum MapBundleAssetKind {
  mapGraph('map_graph'),
  rooms('rooms'),
  mapRaster('map_raster'),
  thumbnail('thumbnail'),
  tiledMap('tiled_map'),
  routeEdges('route_edges'),
  nodes('nodes'),
  wifiNodeMapping('wifi_node_mapping');

  const MapBundleAssetKind(this.wireName);

  final String wireName;
}

final class MapBundleAsset {
  const MapBundleAsset({
    required this.assetId,
    required this.byteSize,
    required this.contentType,
    required this.floorId,
    required this.height,
    required this.kind,
    required this.path,
    required this.sha256,
    required this.width,
  });

  final String assetId;
  final int byteSize;
  final String contentType;
  final String? floorId;
  final int? height;
  final MapBundleAssetKind kind;
  final String path;
  final String sha256;
  final int? width;
}

final class MapBundleManifest {
  MapBundleManifest({
    required List<MapBundleAsset> assets,
    required this.bundleRevision,
    required this.graphRevision,
    required this.mapId,
    required this.schemaVersion,
    required this.sourceDocument,
  }) : assets = List.unmodifiable(assets);

  final List<MapBundleAsset> assets;
  final String bundleRevision;
  final String graphRevision;
  final String mapId;
  final int schemaVersion;
  final String sourceDocument;
}
