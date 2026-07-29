import 'dart:io';

import 'package:indoor_navigation/application/ports/assets/campus_catalog_repository.dart';
import 'package:indoor_navigation/application/ports/maps/map_bundle_repository.dart';
import 'package:indoor_navigation/application/ports/maps/map_runtime_resource_repository.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_node_mapping_repository.dart';
import 'package:indoor_navigation/domain/campus/campus_catalog_models.dart';
import 'package:indoor_navigation/domain/campus/campus_catalog_parser.dart';
import 'package:indoor_navigation/domain/map_bundle/map_bundle_models.dart';

final class ResolvedMapRuntimeResourceRepository
    implements MapRuntimeResourceRepository {
  const ResolvedMapRuntimeResourceRepository(this._bundle);

  final ResolvedMapBundle _bundle;

  @override
  Future<MapRuntimeResources> loadCurrent({
    required String floorId,
    required String mapId,
  }) async {
    if (_bundle.manifest.mapId != mapId) {
      throw StateError(
        'Pinned Map Bundle ${_bundle.manifest.mapId} cannot supply $mapId.',
      );
    }
    final tiledMap = _asset(MapBundleAssetKind.tiledMap, floorId: floorId);
    final routeEdges = _asset(MapBundleAssetKind.routeEdges, floorId: floorId);
    final raster = _asset(MapBundleAssetKind.mapRaster, floorId: floorId);
    return MapRuntimeResources(
      bundleRevision: _bundle.bundleRevision,
      edgeDocumentJson: await _read(routeEdges),
      floorId: floorId,
      graphRevision: _bundle.manifest.graphRevision,
      image: MapImageLocation.localFile(
        _bundle.requireLocalPath(raster.assetId),
      ),
      mapId: mapId,
      tiledMapJson: await _read(tiledMap),
    );
  }

  MapBundleAsset _asset(MapBundleAssetKind kind, {required String floorId}) =>
      _requireAsset(_bundle, kind: kind, floorId: floorId);

  Future<String> _read(MapBundleAsset asset) =>
      File(_bundle.requireLocalPath(asset.assetId)).readAsString();
}

final class ResolvedMapCampusCatalogRepository
    implements CampusCatalogRepository {
  const ResolvedMapCampusCatalogRepository(
    this._bundle, {
    required this.floorId,
  });

  final ResolvedMapBundle _bundle;
  final String floorId;

  @override
  Future<CampusCatalog> loadCampusCatalog() async {
    final rooms = _requireAsset(_bundle, kind: MapBundleAssetKind.rooms);
    final nodes = _requireAsset(
      _bundle,
      kind: MapBundleAssetKind.nodes,
      floorId: floorId,
    );
    final edges = _requireAsset(
      _bundle,
      kind: MapBundleAssetKind.routeEdges,
      floorId: floorId,
    );
    return parseCampusCatalogBundle(
      edgeDocumentJson: await _read(edges),
      nodeCatalogJson: await _read(nodes),
      roomCatalogJson: await _read(rooms),
    );
  }

  Future<String> _read(MapBundleAsset asset) =>
      File(_bundle.requireLocalPath(asset.assetId)).readAsString();
}

final class ResolvedMapWifiNodeMappingRepository
    implements WifiNodeMappingRepository {
  const ResolvedMapWifiNodeMappingRepository(
    this._bundle, {
    required this.floorId,
  });

  final ResolvedMapBundle _bundle;
  final String floorId;

  @override
  Future<String> loadMappingJson(String assetPath) {
    final asset = _requireAsset(
      _bundle,
      kind: MapBundleAssetKind.wifiNodeMapping,
      floorId: floorId,
    );
    return File(_bundle.requireLocalPath(asset.assetId)).readAsString();
  }
}

MapBundleAsset _requireAsset(
  ResolvedMapBundle bundle, {
  required MapBundleAssetKind kind,
  String? floorId,
}) {
  final matches = bundle.manifest.assets
      .where((asset) => asset.kind == kind && asset.floorId == floorId)
      .toList(growable: false);
  if (matches.length != 1) {
    throw StateError(
      'Map Bundle ${bundle.bundleRevision} must contain exactly one '
      '${kind.wireName} asset${floorId == null ? '' : ' for $floorId'}.',
    );
  }
  return matches.single;
}
