import 'dart:collection';
import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:indoor_navigation/domain/map_bundle/map_bundle_models.dart';

final class MapBundleFormatException implements Exception {
  const MapBundleFormatException(this.message);

  final String message;

  @override
  String toString() => 'MapBundleFormatException: $message';
}

final _identifierPattern = RegExp(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$');
final _revisionPattern = RegExp(r'^sha256:[a-f0-9]{64}$');
final _assetPathPattern = RegExp(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$');

MapBundleManifest parseMapBundleManifest(String source) {
  final Object? decoded;
  try {
    decoded = jsonDecode(source);
  } on FormatException catch (error) {
    throw MapBundleFormatException('invalid JSON: ${error.message}');
  }
  final root = _object(decoded, 'manifest');
  _expectKeys(root, const <String>{
    'schema_version',
    'map_id',
    'bundle_revision',
    'graph_revision',
    'assets',
  }, 'manifest');
  final schemaVersion = _integer(root['schema_version'], 'schema_version');
  final mapId = _identifier(root['map_id'], 'map_id');
  final bundleRevision = _revision(root['bundle_revision'], 'bundle_revision');
  final graphRevision = _revision(root['graph_revision'], 'graph_revision');
  if (schemaVersion != 1) {
    throw const MapBundleFormatException('schema_version must be 1');
  }
  final rawAssets = root['assets'];
  if (rawAssets is! List<Object?> || rawAssets.isEmpty) {
    throw const MapBundleFormatException('assets must be a non-empty array');
  }
  final assets = <MapBundleAsset>[];
  final assetIds = <String>{};
  final paths = <String>{};
  for (var index = 0; index < rawAssets.length; index += 1) {
    final asset = _parseAsset(rawAssets[index], index);
    if (!assetIds.add(asset.assetId)) {
      throw MapBundleFormatException('duplicate asset_id ${asset.assetId}');
    }
    if (!paths.add(asset.path)) {
      throw MapBundleFormatException('duplicate asset path ${asset.path}');
    }
    assets.add(asset);
  }
  final canonicalRoot = Map<String, Object?>.from(root)
    ..remove('bundle_revision');
  final canonical = jsonEncode(_canonicalize(canonicalRoot));
  final actualRevision = 'sha256:${sha256.convert(utf8.encode(canonical))}';
  if (actualRevision != bundleRevision) {
    throw const MapBundleFormatException('bundle_revision mismatch');
  }
  return MapBundleManifest(
    assets: assets,
    bundleRevision: bundleRevision,
    graphRevision: graphRevision,
    mapId: mapId,
    schemaVersion: schemaVersion,
    sourceDocument: source,
  );
}

MapBundleAsset _parseAsset(Object? value, int index) {
  final name = 'assets[$index]';
  final source = _object(value, name);
  _expectKeys(
    source,
    const <String>{
      'asset_id',
      'kind',
      'floor_id',
      'path',
      'sha256',
      'byte_size',
      'content_type',
      'width',
      'height',
    },
    name,
    required: const <String>{
      'asset_id',
      'kind',
      'path',
      'sha256',
      'byte_size',
      'content_type',
    },
  );
  final assetId = _identifier(source['asset_id'], '$name.asset_id');
  final kindName = _string(source['kind'], '$name.kind');
  final kind = MapBundleAssetKind.values
      .where((candidate) => candidate.wireName == kindName)
      .firstOrNull;
  if (kind == null) {
    throw MapBundleFormatException('$name.kind is unsupported');
  }
  final floorId = source.containsKey('floor_id')
      ? _identifier(source['floor_id'], '$name.floor_id')
      : null;
  final floorScoped =
      kind != MapBundleAssetKind.mapGraph && kind != MapBundleAssetKind.rooms;
  if (floorScoped != (floorId != null)) {
    throw MapBundleFormatException(
      '$name.floor_id does not match ${kind.wireName}',
    );
  }
  final path = _string(source['path'], '$name.path');
  if (!_assetPathPattern.hasMatch(path)) {
    throw MapBundleFormatException('$name.path is invalid');
  }
  final byteSize = _integer(source['byte_size'], '$name.byte_size');
  if (byteSize < 1) {
    throw MapBundleFormatException('$name.byte_size must be positive');
  }
  final contentType = _string(source['content_type'], '$name.content_type');
  if (contentType != 'application/json' && contentType != 'image/png') {
    throw MapBundleFormatException('$name.content_type is unsupported');
  }
  final width = source.containsKey('width')
      ? _positiveInteger(source['width'], '$name.width')
      : null;
  final height = source.containsKey('height')
      ? _positiveInteger(source['height'], '$name.height')
      : null;
  final image =
      kind == MapBundleAssetKind.mapRaster ||
      kind == MapBundleAssetKind.thumbnail;
  if (image && (width == null || height == null)) {
    throw MapBundleFormatException('$name image dimensions are required');
  }
  if (!image && (width != null || height != null)) {
    throw MapBundleFormatException('$name dimensions are not allowed');
  }
  return MapBundleAsset(
    assetId: assetId,
    byteSize: byteSize,
    contentType: contentType,
    floorId: floorId,
    height: height,
    kind: kind,
    path: path,
    sha256: _revision(source['sha256'], '$name.sha256'),
    width: width,
  );
}

Map<String, Object?> _object(Object? value, String name) {
  if (value is! Map<String, Object?>) {
    throw MapBundleFormatException('$name must be an object');
  }
  return value;
}

void _expectKeys(
  Map<String, Object?> source,
  Set<String> allowed,
  String name, {
  Set<String>? required,
}) {
  final unexpected = source.keys.where((key) => !allowed.contains(key));
  if (unexpected.isNotEmpty) {
    throw MapBundleFormatException('$name contains ${unexpected.first}');
  }
  for (final key in required ?? allowed) {
    if (!source.containsKey(key)) {
      throw MapBundleFormatException('$name is missing $key');
    }
  }
}

String _identifier(Object? value, String name) {
  final result = _string(value, name);
  if (!_identifierPattern.hasMatch(result)) {
    throw MapBundleFormatException('$name is invalid');
  }
  return result;
}

String _revision(Object? value, String name) {
  final result = _string(value, name);
  if (!_revisionPattern.hasMatch(result)) {
    throw MapBundleFormatException('$name is invalid');
  }
  return result;
}

String _string(Object? value, String name) {
  if (value is! String) {
    throw MapBundleFormatException('$name must be a string');
  }
  return value;
}

int _integer(Object? value, String name) {
  if (value is! int) {
    throw MapBundleFormatException('$name must be an integer');
  }
  return value;
}

int _positiveInteger(Object? value, String name) {
  final result = _integer(value, name);
  if (result < 1) {
    throw MapBundleFormatException('$name must be positive');
  }
  return result;
}

Object? _canonicalize(Object? value) {
  if (value is List<Object?>) {
    return value.map(_canonicalize).toList(growable: false);
  }
  if (value is Map<String, Object?>) {
    return SplayTreeMap<String, Object?>.from(
      value.map((key, item) => MapEntry(key, _canonicalize(item))),
    );
  }
  return value;
}
