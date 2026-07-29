import 'dart:convert';

import 'package:indoor_navigation/domain/common/geometry_math.dart';
import 'package:indoor_navigation/domain/common/javascript_number.dart';
import 'package:indoor_navigation/domain/edge_editor/edge_editor_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

const _reservedEdgeKeys = <String>{'id', 'from', 'to', 'distance'};
const _javascriptMaxSafeInteger = 9007199254740991;

RouteGraphEdgeExport createRouteGraphEdge(CreateRouteGraphEdgeInput input) {
  final customFields = <String, RouteGraphEdgeExportValue>{};

  for (final field in input.fields) {
    final key = field.key.trim();
    if (key.isEmpty || _reservedEdgeKeys.contains(key)) {
      continue;
    }
    // Assignment to Object.prototype's legacy setter with a primitive value
    // does not create an own property in the TypeScript implementation.
    if (key == '__proto__') {
      continue;
    }
    customFields[key] = parseEdgeFieldValue(field.value);
  }

  return RouteGraphEdgeExport(
    distance: _roundDistance(input.distance),
    from: input.from,
    id: input.id.trim(),
    to: input.to,
    customFields: customFields,
  );
}

RouteGraphEdgeDocument createRouteGraphEdgeDocument(
  List<RouteGraphEdgeExport> edges,
  String sourceMap,
) {
  return RouteGraphEdgeDocument(edges: edges, sourceMap: sourceMap);
}

String stringifyRouteGraphEdgeDocument(
  List<RouteGraphEdgeExport> edges,
  String sourceMap,
) {
  final document = createRouteGraphEdgeDocument(edges, sourceMap);
  final json = <String, Object?>{
    'edges': document.edges.map(_edgeToJson).toList(growable: false),
    'kind': RouteGraphEdgeDocument.kind,
    'sourceMap': document.sourceMap,
    'version': RouteGraphEdgeDocument.version,
  };
  return '${const JsonEncoder.withIndent('  ').convert(json)}\n';
}

RouteGraphEdgeDocument parseRouteGraphEdgeDocumentJson(String source) {
  final Object? decoded = jsonDecode(source);
  final document = _requiredMap(decoded, r'$');
  final kind = _requiredString(document, 'kind', r'$.kind');
  if (kind != RouteGraphEdgeDocument.kind) {
    throw UnsupportedError('Unsupported EDGE document kind: $kind');
  }
  final version = _requiredInt(document, 'version', r'$.version');
  if (version != RouteGraphEdgeDocument.version) {
    throw UnsupportedError('Unsupported EDGE document version: $version');
  }

  final edgesJson = _requiredList(document, 'edges', r'$.edges');
  final edges = edgesJson.indexed
      .map(
        (entry) => _parseEdge(
          entry.$2,
          r'$.edges['
          '${entry.$1}]',
        ),
      )
      .toList(growable: false);
  return RouteGraphEdgeDocument(
    edges: edges,
    sourceMap: _requiredString(document, 'sourceMap', r'$.sourceMap'),
  );
}

List<OverlayPathSegment> createEdgePathSegments(
  List<RouteGraphEdgeExport> edges,
  List<OverlayRouteNode> nodes,
) {
  final nodesById = <String, OverlayRouteNode>{
    for (final node in nodes) node.nodeId: node,
  };
  final segments = <OverlayPathSegment>[];

  for (final edge in edges) {
    final from = nodesById[edge.from];
    final to = nodesById[edge.to];
    if (from == null || to == null) {
      continue;
    }
    segments.add(_createEdgePathSegment(edge.id, from, to));
  }
  return segments;
}

double createNodeDistance(OverlayRouteNode from, OverlayRouteNode to) {
  return _roundDistance(distanceBetweenPoints(from, to));
}

RouteGraphEdgeExportValue parseEdgeFieldValue(String value) {
  final trimmedValue = value.trim();

  if (trimmedValue == 'true') {
    return true;
  }
  if (trimmedValue == 'false') {
    return false;
  }
  if (trimmedValue.isNotEmpty) {
    final number = _parseJavaScriptNumber(trimmedValue);
    if (number != null && number.isFinite) {
      return _canonicalParsedNumber(number);
    }
  }
  return value;
}

RouteGraphEdgeExport _parseEdge(Object? value, String path) {
  final edge = _requiredMap(value, path);
  final customFields = <String, RouteGraphEdgeExportValue>{};
  for (final entry in edge.entries) {
    if (_reservedEdgeKeys.contains(entry.key)) {
      continue;
    }
    final fieldValue = entry.value;
    if (fieldValue is! bool && fieldValue is! num && fieldValue is! String) {
      throw FormatException(
        '$path.${entry.key} must be a bool, number, or string.',
      );
    }
    customFields[entry.key] = fieldValue as Object;
  }

  return RouteGraphEdgeExport(
    distance: _requiredNumber(edge, 'distance', '$path.distance').toDouble(),
    from: _requiredString(edge, 'from', '$path.from'),
    id: _requiredString(edge, 'id', '$path.id'),
    to: _requiredString(edge, 'to', '$path.to'),
    customFields: customFields,
  );
}

Map<String, Object?> _edgeToJson(RouteGraphEdgeExport edge) {
  final indexedFields =
      edge.customFields.entries
          .where((entry) => _javascriptArrayIndex(entry.key) != null)
          .toList(growable: false)
        ..sort(
          (left, right) => _javascriptArrayIndex(
            left.key,
          )!.compareTo(_javascriptArrayIndex(right.key)!),
        );
  final json = <String, Object?>{
    for (final entry in indexedFields) entry.key: _jsonScalar(entry.value),
    'distance': _jsonNumber(edge.distance),
    'from': edge.from,
    'id': edge.id,
    'to': edge.to,
  };
  for (final entry in edge.customFields.entries) {
    if (_javascriptArrayIndex(entry.key) == null) {
      json[entry.key] = _jsonScalar(entry.value);
    }
  }
  return json;
}

int? _javascriptArrayIndex(String key) {
  final value = int.tryParse(key);
  if (value == null || value < 0 || value >= 0xFFFFFFFF) {
    return null;
  }
  return value.toString() == key ? value : null;
}

Object? _jsonScalar(Object value) {
  return value is num ? _jsonNumber(value) : value;
}

Object? _jsonNumber(num value) {
  final number = value.toDouble();
  if (!number.isFinite) {
    return null;
  }
  return _canonicalJsonNumber(number);
}

num _canonicalJsonNumber(double value) {
  if (value == 0) {
    return 0;
  }
  if (value.isFinite && value == value.truncateToDouble()) {
    if (value.abs() >= 1e21) {
      return value;
    }

    // Dart exposes the exact binary integer through toInt(), while
    // JavaScript serializes the shortest round-trippable decimal spelling.
    // Parsing Dart's shortest double spelling reproduces JSON.stringify for
    // unsafe integers such as 1000000000000000100.
    final shortest = value.toString();
    final integerText = shortest.endsWith('.0')
        ? shortest.substring(0, shortest.length - 2)
        : shortest;
    final integer = int.tryParse(integerText);
    if (integer != null) {
      return integer;
    }
  }
  return value;
}

num _canonicalParsedNumber(double value) {
  if (value == 0 && value.isNegative) {
    return value;
  }
  if (value.isFinite &&
      value.abs() <= _javascriptMaxSafeInteger &&
      value == value.truncateToDouble()) {
    return value.toInt();
  }
  return value;
}

double? _parseJavaScriptNumber(String value) {
  if (value.startsWith('0x') || value.startsWith('0X')) {
    final parsed = int.tryParse(value.substring(2), radix: 16);
    return parsed?.toDouble();
  }
  if (value.startsWith('0b') || value.startsWith('0B')) {
    final parsed = int.tryParse(value.substring(2), radix: 2);
    return parsed?.toDouble();
  }
  if (value.startsWith('0o') || value.startsWith('0O')) {
    final parsed = int.tryParse(value.substring(2), radix: 8);
    return parsed?.toDouble();
  }
  return double.tryParse(value);
}

OverlayPathSegment _createEdgePathSegment(
  String key,
  OverlayRouteNode from,
  OverlayRouteNode to,
) {
  return OverlayPathSegment(
    fromNodeId: from.nodeId,
    key: key,
    length: distanceBetweenPoints(from, to),
    rotationDegrees: headingBetweenPoints(from, to),
    toNodeId: to.nodeId,
    x: from.screenX,
    y: from.screenY,
  );
}

double _roundDistance(double distance) {
  final scaledDistance = distance * 100;
  final roundedDistance = javascriptRound(scaledDistance);
  if (roundedDistance == 0 && scaledDistance.isNegative) {
    return -0.0;
  }
  return roundedDistance / 100;
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

String _requiredString(Map<String, Object?> source, String key, String path) {
  final value = source[key];
  if (value is String) {
    return value;
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

num _requiredNumber(Map<String, Object?> source, String key, String path) {
  final value = source[key];
  if (value is num) {
    return value;
  }
  throw FormatException('$path must be a number.');
}
