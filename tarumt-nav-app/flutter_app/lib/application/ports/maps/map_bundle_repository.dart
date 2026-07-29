import 'package:indoor_navigation/domain/map_bundle/map_bundle_models.dart';

enum MapBundleResolutionSource { downloaded, revalidatedCache, staleCache }

final class ResolvedMapBundle {
  ResolvedMapBundle({
    required this.directoryPath,
    required Map<String, String> localAssetPaths,
    required this.manifest,
    required this.source,
  }) : localAssetPaths = Map.unmodifiable(localAssetPaths);

  final String directoryPath;
  final Map<String, String> localAssetPaths;
  final MapBundleManifest manifest;
  final MapBundleResolutionSource source;

  String get bundleRevision => manifest.bundleRevision;

  String requireLocalPath(String assetId) {
    final path = localAssetPaths[assetId];
    if (path == null) {
      throw StateError('Map Bundle does not contain local asset $assetId.');
    }
    return path;
  }

  ResolvedMapBundle withSource(MapBundleResolutionSource nextSource) {
    return ResolvedMapBundle(
      directoryPath: directoryPath,
      localAssetPaths: localAssetPaths,
      manifest: manifest,
      source: nextSource,
    );
  }
}

abstract interface class MapBundleRepository {
  Future<ResolvedMapBundle> resolveCurrent(String mapId);
}

final class MapBundleUnavailableException implements Exception {
  const MapBundleUnavailableException(this.message, [this.cause]);

  final Object? cause;
  final String message;

  @override
  String toString() => 'MapBundleUnavailableException: $message';
}

final class MapBundleIntegrityException implements Exception {
  const MapBundleIntegrityException(this.message);

  final String message;

  @override
  String toString() => 'MapBundleIntegrityException: $message';
}
