import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:indoor_navigation/application/ports/maps/map_bundle_repository.dart';
import 'package:indoor_navigation/domain/map_bundle/map_bundle_manifest_parser.dart';
import 'package:indoor_navigation/domain/map_bundle/map_bundle_models.dart';

typedef MapBundleAssetDownloader =
    Future<Uint8List> Function(MapBundleAsset asset);

final class FileMapBundleCache {
  FileMapBundleCache(this._root);

  final Directory _root;

  Future<ResolvedMapBundle?> loadActive(
    String mapId, {
    required MapBundleResolutionSource source,
  }) async {
    final mapRoot = Directory.fromUri(_root.uri.resolve('map-bundles/$mapId/'));
    final activeFile = File.fromUri(mapRoot.uri.resolve('active.json'));
    if (!await activeFile.exists()) {
      return null;
    }
    final Object? decoded;
    try {
      decoded = jsonDecode(await activeFile.readAsString());
    } on FormatException catch (error) {
      throw MapBundleIntegrityException(
        'Active Map Bundle pointer is invalid: ${error.message}',
      );
    }
    if (decoded is! Map<String, Object?> ||
        decoded.length != 3 ||
        decoded['schema_version'] != 1 ||
        decoded['map_id'] != mapId ||
        decoded['bundle_revision'] is! String) {
      throw const MapBundleIntegrityException(
        'Active Map Bundle pointer is invalid.',
      );
    }
    final revision = decoded['bundle_revision']! as String;
    if (!RegExp(r'^sha256:[a-f0-9]{64}$').hasMatch(revision)) {
      throw const MapBundleIntegrityException(
        'Active Map Bundle revision is invalid.',
      );
    }
    final directory = Directory.fromUri(
      mapRoot.uri.resolve('revisions/${revision.substring('sha256:'.length)}/'),
    );
    final manifestFile = File.fromUri(directory.uri.resolve('manifest.json'));
    if (!await manifestFile.exists()) {
      throw const MapBundleIntegrityException(
        'Active Map Bundle manifest is missing.',
      );
    }
    final manifest = parseMapBundleManifest(await manifestFile.readAsString());
    if (manifest.mapId != mapId || manifest.bundleRevision != revision) {
      throw const MapBundleIntegrityException(
        'Active Map Bundle manifest does not match its pointer.',
      );
    }
    for (final asset in manifest.assets) {
      final file = File.fromUri(directory.uri.resolve(asset.path));
      if (!await file.exists()) {
        throw MapBundleIntegrityException(
          'Active asset ${asset.assetId} is missing.',
        );
      }
      _verifyAsset(asset, await file.readAsBytes());
    }
    return _resolved(directory: directory, manifest: manifest, source: source);
  }

  Future<ResolvedMapBundle> install({
    required MapBundleAssetDownloader download,
    required MapBundleManifest manifest,
  }) async {
    final mapRoot = Directory.fromUri(
      _root.uri.resolve('map-bundles/${manifest.mapId}/'),
    );
    final revisionsRoot = Directory.fromUri(mapRoot.uri.resolve('revisions/'));
    final stagingRoot = Directory.fromUri(mapRoot.uri.resolve('staging/'));
    await revisionsRoot.create(recursive: true);
    await stagingRoot.create(recursive: true);
    final staging = Directory.fromUri(
      stagingRoot.uri.resolve(
        '${DateTime.now().microsecondsSinceEpoch}-'
        '${Random.secure().nextInt(1 << 32)}/',
      ),
    );
    await staging.create();
    final previousRevision = await _readActiveRevision(mapRoot);
    try {
      for (final asset in manifest.assets) {
        final bytes = await download(asset);
        _verifyAsset(asset, bytes);
        await File.fromUri(
          staging.uri.resolve(asset.path),
        ).writeAsBytes(bytes, flush: true);
      }
      await File.fromUri(
        staging.uri.resolve('manifest.json'),
      ).writeAsString(manifest.sourceDocument, flush: true);

      final revisionName = manifest.bundleRevision.substring('sha256:'.length);
      final destination = Directory.fromUri(
        revisionsRoot.uri.resolve('$revisionName/'),
      );
      if (await destination.exists()) {
        await destination.delete(recursive: true);
      }
      await staging.rename(destination.path);
      await _writeActivePointer(mapRoot, manifest);
      await _pruneRevisions(
        revisionsRoot,
        keep: <String>{
          revisionName,
          if (previousRevision != null)
            previousRevision.substring('sha256:'.length),
        },
      );
      return _resolved(
        directory: destination,
        manifest: manifest,
        source: MapBundleResolutionSource.downloaded,
      );
    } catch (_) {
      if (await staging.exists()) {
        await staging.delete(recursive: true);
      }
      rethrow;
    }
  }

  Future<String?> _readActiveRevision(Directory mapRoot) async {
    final active = File.fromUri(mapRoot.uri.resolve('active.json'));
    if (!await active.exists()) {
      return null;
    }
    try {
      final decoded = jsonDecode(await active.readAsString());
      if (decoded is Map<String, Object?>) {
        final revision = decoded['bundle_revision'];
        if (revision is String &&
            RegExp(r'^sha256:[a-f0-9]{64}$').hasMatch(revision)) {
          return revision;
        }
      }
    } on FormatException {
      return null;
    }
    return null;
  }

  Future<void> _pruneRevisions(
    Directory revisionsRoot, {
    required Set<String> keep,
  }) async {
    await for (final entry in revisionsRoot.list(followLinks: false)) {
      if (entry is Directory &&
          !keep.contains(
            entry.uri.pathSegments.where((segment) => segment.isNotEmpty).last,
          )) {
        await entry.delete(recursive: true);
      }
    }
  }

  void _verifyAsset(MapBundleAsset asset, Uint8List bytes) {
    if (bytes.length != asset.byteSize) {
      throw MapBundleIntegrityException(
        '${asset.assetId} expected ${asset.byteSize} bytes, '
        'received ${bytes.length}.',
      );
    }
    final digest = 'sha256:${sha256.convert(bytes)}';
    if (digest != asset.sha256) {
      throw MapBundleIntegrityException(
        '${asset.assetId} SHA-256 does not match the manifest.',
      );
    }
  }

  Future<void> _writeActivePointer(
    Directory mapRoot,
    MapBundleManifest manifest,
  ) async {
    final next = File.fromUri(mapRoot.uri.resolve('active.next.json'));
    await next.writeAsString(
      jsonEncode(<String, Object>{
        'schema_version': 1,
        'map_id': manifest.mapId,
        'bundle_revision': manifest.bundleRevision,
      }),
      flush: true,
    );
    await next.rename(File.fromUri(mapRoot.uri.resolve('active.json')).path);
  }

  ResolvedMapBundle _resolved({
    required Directory directory,
    required MapBundleManifest manifest,
    required MapBundleResolutionSource source,
  }) {
    return ResolvedMapBundle(
      directoryPath: directory.path,
      localAssetPaths: <String, String>{
        for (final asset in manifest.assets)
          asset.assetId: File.fromUri(directory.uri.resolve(asset.path)).path,
      },
      manifest: manifest,
      source: source,
    );
  }
}
