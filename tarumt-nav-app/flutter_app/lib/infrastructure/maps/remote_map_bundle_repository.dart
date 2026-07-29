import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:indoor_navigation/application/ports/maps/map_bundle_repository.dart';
import 'package:indoor_navigation/domain/map_bundle/map_bundle_manifest_parser.dart';
import 'package:indoor_navigation/domain/map_bundle/map_bundle_models.dart';
import 'package:indoor_navigation/infrastructure/maps/file_map_bundle_cache.dart';
import 'package:indoor_navigation/infrastructure/maps/map_bundle_http_transport.dart';

final class RemoteMapBundleRepository implements MapBundleRepository {
  RemoteMapBundleRepository({
    required this.baseUrl,
    required Directory cacheRoot,
    required this.transport,
    this.requestTimeout = const Duration(seconds: 10),
  }) : _cache = FileMapBundleCache(cacheRoot);

  static const _maxManifestBytes = 256 * 1024;
  static final _mapIdPattern = RegExp(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$');

  final Uri baseUrl;
  final Duration requestTimeout;
  final MapBundleHttpTransport transport;
  final FileMapBundleCache _cache;
  final Map<String, Future<ResolvedMapBundle>> _inFlight =
      <String, Future<ResolvedMapBundle>>{};

  @override
  Future<ResolvedMapBundle> resolveCurrent(String mapId) {
    if (!_mapIdPattern.hasMatch(mapId)) {
      return Future<ResolvedMapBundle>.error(
        ArgumentError.value(mapId, 'mapId', 'must be a valid map identifier'),
      );
    }
    final existing = _inFlight[mapId];
    if (existing != null) {
      return existing;
    }
    late final Future<ResolvedMapBundle> operation;
    operation = _runAndRelease(mapId);
    _inFlight[mapId] = operation;
    return operation;
  }

  Future<ResolvedMapBundle> _runAndRelease(String mapId) async {
    try {
      return await _resolveCurrent(mapId);
    } finally {
      _inFlight.remove(mapId);
    }
  }

  Future<ResolvedMapBundle> _resolveCurrent(String mapId) async {
    ResolvedMapBundle? active;
    try {
      active = await _cache.loadActive(
        mapId,
        source: MapBundleResolutionSource.revalidatedCache,
      );
    } on MapBundleIntegrityException {
      active = null;
    } on MapBundleFormatException {
      active = null;
    }
    try {
      final response = await transport.get(
        MapBundleHttpRequest(
          headers: <String, String>{
            if (active != null) 'If-None-Match': '"${active.bundleRevision}"',
          },
          maxResponseBytes: _maxManifestBytes,
          timeout: requestTimeout,
          uri: _uri(<String>['v1', 'maps', mapId, 'current']),
        ),
      );
      if (response.statusCode == HttpStatus.notModified) {
        if (active == null) {
          throw const MapBundleUnavailableException(
            'Gateway returned 304 without an active Map Bundle.',
          );
        }
        return active;
      }
      if (response.statusCode != HttpStatus.ok) {
        throw MapBundleUnavailableException(
          'Current Map Bundle request returned ${response.statusCode}.',
        );
      }
      final manifest = parseMapBundleManifest(
        utf8.decode(response.body, allowMalformed: false),
      );
      if (manifest.mapId != mapId) {
        throw const MapBundleIntegrityException(
          'Current manifest map_id does not match the request.',
        );
      }
      if (active?.bundleRevision == manifest.bundleRevision) {
        return active!;
      }
      return await _cache.install(
        manifest: manifest,
        download: (asset) => _downloadAsset(manifest, asset),
      );
    } catch (error) {
      if (active != null) {
        return active.withSource(MapBundleResolutionSource.staleCache);
      }
      if (error is MapBundleUnavailableException) {
        rethrow;
      }
      throw MapBundleUnavailableException(
        'No usable Map Bundle is available.',
        error,
      );
    }
  }

  Future<Uint8List> _downloadAsset(
    MapBundleManifest manifest,
    MapBundleAsset asset,
  ) async {
    final response = await transport.get(
      MapBundleHttpRequest(
        headers: const <String, String>{},
        maxResponseBytes: asset.byteSize,
        timeout: requestTimeout,
        uri: _uri(<String>[
          'v1',
          'maps',
          manifest.mapId,
          'revisions',
          manifest.bundleRevision,
          asset.path,
        ]),
      ),
    );
    if (response.statusCode != HttpStatus.ok) {
      throw MapBundleUnavailableException(
        '${asset.assetId} returned ${response.statusCode}.',
      );
    }
    return response.body;
  }

  Uri _uri(List<String> suffix) {
    return baseUrl.replace(
      pathSegments: <String>[
        ...baseUrl.pathSegments.where((segment) => segment.isNotEmpty),
        ...suffix,
      ],
    );
  }
}
