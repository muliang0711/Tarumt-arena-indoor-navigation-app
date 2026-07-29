const defaultTiledMapAssetPath = 'assets/maps/demo_1.tmj.json';
const defaultRouteGraphEdgesAssetPath = 'assets/maps/demo_1.edges.json';
const defaultMapImageAssetPath = 'assets/maps/demo_1.png';
const defaultMapId = 'main-campus';
const defaultMapFloorId = 'floor-2';

enum MapImageLocationKind { bundledAsset, localFile }

final class MapImageLocation {
  const MapImageLocation.bundledAsset(this.path)
    : kind = MapImageLocationKind.bundledAsset;

  const MapImageLocation.localFile(this.path)
    : kind = MapImageLocationKind.localFile;

  final MapImageLocationKind kind;
  final String path;
}

final class MapRuntimeResources {
  const MapRuntimeResources({
    required this.bundleRevision,
    required this.edgeDocumentJson,
    required this.floorId,
    required this.graphRevision,
    required this.image,
    required this.mapId,
    required this.tiledMapJson,
  });

  final String? bundleRevision;
  final String edgeDocumentJson;
  final String floorId;
  final String? graphRevision;
  final MapImageLocation image;
  final String mapId;
  final String tiledMapJson;
}

/// Supplies one internally consistent map revision to application bootstrap.
abstract interface class MapRuntimeResourceRepository {
  Future<MapRuntimeResources> loadCurrent({
    required String floorId,
    required String mapId,
  });
}
