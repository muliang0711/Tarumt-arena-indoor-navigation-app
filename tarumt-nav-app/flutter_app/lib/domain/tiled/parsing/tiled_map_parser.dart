import 'dart:convert';

import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

/// Decodes a Tiled JSON document into the immutable domain representation.
///
/// Unknown document and layer fields are intentionally ignored, matching the
/// structural TypeScript types used by the Expo app.
TiledMap parseTiledMapJson(String source) {
  final Object? decoded = jsonDecode(source);
  return parseTiledMap(decoded);
}

TiledMap parseTiledMap(Object? value) {
  final map = _requiredMap(value, r'$');
  final documentType = _requiredString(map, 'type', r'$.type');
  if (documentType != TiledMap.type) {
    throw UnsupportedError('Unsupported Tiled document type: $documentType');
  }

  return TiledMap(
    height: _requiredInt(map, 'height', r'$.height'),
    infinite: _optionalBool(map, 'infinite', r'$.infinite'),
    layers: _requiredList(map, 'layers', r'$.layers').indexed
        .map(
          (entry) => _parseLayer(
            entry.$2,
            r'$.layers['
            '${entry.$1}]',
          ),
        )
        .toList(growable: false),
    orientation: _requiredString(map, 'orientation', r'$.orientation'),
    renderOrder: _optionalString(map, 'renderorder', r'$.renderorder'),
    tileHeight: _requiredInt(map, 'tileheight', r'$.tileheight'),
    tilesets: _requiredList(map, 'tilesets', r'$.tilesets').indexed
        .map(
          (entry) => _parseTileset(
            entry.$2,
            r'$.tilesets['
            '${entry.$1}]',
          ),
        )
        .toList(growable: false),
    tileWidth: _requiredInt(map, 'tilewidth', r'$.tilewidth'),
    version: _requiredString(map, 'version', r'$.version'),
    width: _requiredInt(map, 'width', r'$.width'),
  );
}

TiledLayer _parseLayer(Object? value, String path) {
  final layer = _requiredMap(value, path);
  final layerType = _requiredString(layer, 'type', '$path.type');
  final id = _requiredInt(layer, 'id', '$path.id');
  final name = _requiredString(layer, 'name', '$path.name');
  final opacity = _optionalDouble(layer, 'opacity', '$path.opacity');
  final visible = _optionalBool(layer, 'visible', '$path.visible');
  final x = _optionalInt(layer, 'x', '$path.x');
  final y = _optionalInt(layer, 'y', '$path.y');

  return switch (layerType) {
    'imagelayer' => TiledImageLayer(
      id: id,
      name: name,
      opacity: opacity,
      visible: visible,
      x: x,
      y: y,
      image: _optionalString(layer, 'image', '$path.image'),
    ),
    'objectgroup' => TiledObjectLayer(
      id: id,
      name: name,
      opacity: opacity,
      visible: visible,
      x: x,
      y: y,
      objects: _optionalList(layer, 'objects', '$path.objects')?.indexed
          .map((entry) => _parseObject(entry.$2, '$path.objects[${entry.$1}]'))
          .toList(growable: false),
    ),
    'tilelayer' => TiledTileLayer(
      id: id,
      name: name,
      opacity: opacity,
      visible: visible,
      x: x,
      y: y,
      chunks: _optionalList(layer, 'chunks', '$path.chunks')?.indexed
          .map((entry) => _parseChunk(entry.$2, '$path.chunks[${entry.$1}]'))
          .toList(growable: false),
      data: _optionalIntList(layer, 'data', '$path.data'),
      height: _optionalInt(layer, 'height', '$path.height'),
      startX: _optionalInt(layer, 'startx', '$path.startx'),
      startY: _optionalInt(layer, 'starty', '$path.starty'),
      width: _optionalInt(layer, 'width', '$path.width'),
    ),
    _ => throw UnsupportedError('Unsupported Tiled layer type: $layerType'),
  };
}

TiledChunk _parseChunk(Object? value, String path) {
  final chunk = _requiredMap(value, path);
  return TiledChunk(
    data: _requiredIntList(chunk, 'data', '$path.data'),
    height: _requiredInt(chunk, 'height', '$path.height'),
    width: _requiredInt(chunk, 'width', '$path.width'),
    x: _requiredInt(chunk, 'x', '$path.x'),
    y: _requiredInt(chunk, 'y', '$path.y'),
  );
}

TiledObject _parseObject(Object? value, String path) {
  final object = _requiredMap(value, path);
  final textValue = object['text'];
  return TiledObject(
    id: _requiredInt(object, 'id', '$path.id'),
    name: _requiredString(object, 'name', '$path.name'),
    x: _requiredDouble(object, 'x', '$path.x'),
    y: _requiredDouble(object, 'y', '$path.y'),
    height: _optionalDouble(object, 'height', '$path.height'),
    point: _optionalBool(object, 'point', '$path.point'),
    properties: _optionalList(object, 'properties', '$path.properties')?.indexed
        .map(
          (entry) => _parseProperty(entry.$2, '$path.properties[${entry.$1}]'),
        )
        .toList(growable: false),
    text: textValue == null ? null : _parseObjectText(textValue, '$path.text'),
    type: _optionalString(object, 'type', '$path.type'),
    width: _optionalDouble(object, 'width', '$path.width'),
  );
}

TiledObjectText _parseObjectText(Object? value, String path) {
  final text = _requiredMap(value, path);
  return TiledObjectText(
    text: _optionalString(text, 'text', '$path.text'),
    wrap: _optionalBool(text, 'wrap', '$path.wrap'),
  );
}

TiledProperty _parseProperty(Object? value, String path) {
  final property = _requiredMap(value, path);
  final propertyValue = property['value'];
  if (propertyValue is! bool &&
      propertyValue is! num &&
      propertyValue is! String) {
    throw FormatException('$path.value must be a bool, number, or string.');
  }

  return TiledProperty(
    name: _requiredString(property, 'name', '$path.name'),
    type: _requiredString(property, 'type', '$path.type'),
    value: propertyValue as Object,
  );
}

TiledTileset _parseTileset(Object? value, String path) {
  final tileset = _requiredMap(value, path);
  return TiledTileset(
    columns: _requiredInt(tileset, 'columns', '$path.columns'),
    firstGid: _requiredInt(tileset, 'firstgid', '$path.firstgid'),
    image: _requiredString(tileset, 'image', '$path.image'),
    imageHeight: _requiredInt(tileset, 'imageheight', '$path.imageheight'),
    imageWidth: _requiredInt(tileset, 'imagewidth', '$path.imagewidth'),
    name: _requiredString(tileset, 'name', '$path.name'),
    tileCount: _requiredInt(tileset, 'tilecount', '$path.tilecount'),
    tileHeight: _requiredInt(tileset, 'tileheight', '$path.tileheight'),
    tileWidth: _requiredInt(tileset, 'tilewidth', '$path.tilewidth'),
    margin: _optionalInt(tileset, 'margin', '$path.margin'),
    spacing: _optionalInt(tileset, 'spacing', '$path.spacing'),
  );
}

Map<String, Object?> _requiredMap(Object? value, String path) {
  if (value is Map<String, Object?>) {
    return value;
  }
  throw FormatException('$path must be an object.');
}

List<Object?> _requiredList(
  Map<String, Object?> source,
  String key,
  String path,
) {
  final value = source[key];
  if (value is List<Object?>) {
    return value;
  }
  throw FormatException('$path must be an array.');
}

List<Object?>? _optionalList(
  Map<String, Object?> source,
  String key,
  String path,
) {
  final value = source[key];
  if (value == null) {
    return null;
  }
  if (value is List<Object?>) {
    return value;
  }
  throw FormatException('$path must be an array.');
}

List<int> _requiredIntList(
  Map<String, Object?> source,
  String key,
  String path,
) {
  final values = _requiredList(source, key, path);
  return values.indexed
      .map((entry) {
        final value = entry.$2;
        if (value is int) {
          return value;
        }
        throw FormatException('$path[${entry.$1}] must be an integer.');
      })
      .toList(growable: false);
}

List<int>? _optionalIntList(
  Map<String, Object?> source,
  String key,
  String path,
) {
  final values = _optionalList(source, key, path);
  return values?.indexed
      .map((entry) {
        final value = entry.$2;
        if (value is int) {
          return value;
        }
        throw FormatException('$path[${entry.$1}] must be an integer.');
      })
      .toList(growable: false);
}

String _requiredString(Map<String, Object?> source, String key, String path) {
  final value = source[key];
  if (value is String) {
    return value;
  }
  throw FormatException('$path must be a string.');
}

String? _optionalString(Map<String, Object?> source, String key, String path) {
  final value = source[key];
  if (value == null || value is String) {
    return value as String?;
  }
  throw FormatException('$path must be a string.');
}

int _requiredInt(Map<String, Object?> source, String key, String path) {
  final value = source[key];
  if (value is int) {
    return value;
  }
  throw FormatException('$path must be an integer.');
}

int? _optionalInt(Map<String, Object?> source, String key, String path) {
  final value = source[key];
  if (value == null || value is int) {
    return value as int?;
  }
  throw FormatException('$path must be an integer.');
}

double _requiredDouble(Map<String, Object?> source, String key, String path) {
  final value = source[key];
  if (value is num) {
    return value.toDouble();
  }
  throw FormatException('$path must be a number.');
}

double? _optionalDouble(Map<String, Object?> source, String key, String path) {
  final value = source[key];
  if (value == null) {
    return null;
  }
  if (value is num) {
    return value.toDouble();
  }
  throw FormatException('$path must be a number.');
}

bool? _optionalBool(Map<String, Object?> source, String key, String path) {
  final value = source[key];
  if (value == null || value is bool) {
    return value as bool?;
  }
  throw FormatException('$path must be a boolean.');
}
