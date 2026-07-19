final class EdgeFieldDraft {
  const EdgeFieldDraft({required this.key, required this.value});

  final String key;
  final String value;
}

/// JSON scalar accepted by the TypeScript `RouteGraphEdgeExportValue` union.
typedef RouteGraphEdgeExportValue = Object;

final class RouteGraphEdgeExport {
  RouteGraphEdgeExport({
    required this.distance,
    required this.from,
    required this.id,
    required this.to,
    Map<String, RouteGraphEdgeExportValue>? customFields,
  }) : assert(
         customFields == null ||
             customFields.values.every(
               (value) => value is bool || value is num || value is String,
             ),
       ),
       customFields = Map.unmodifiable(customFields ?? const {});

  final Map<String, RouteGraphEdgeExportValue> customFields;
  final double distance;
  final String from;
  final String id;
  final String to;
}

final class RouteGraphEdgeDocument {
  RouteGraphEdgeDocument({
    required List<RouteGraphEdgeExport> edges,
    required this.sourceMap,
  }) : edges = List.unmodifiable(edges);

  final List<RouteGraphEdgeExport> edges;
  static const kind = 'route-graph-edges';
  final String sourceMap;
  static const version = 1;
}

final class CreateRouteGraphEdgeInput {
  CreateRouteGraphEdgeInput({
    required this.distance,
    required List<EdgeFieldDraft> fields,
    required this.from,
    required this.id,
    required this.to,
  }) : fields = List.unmodifiable(fields);

  final double distance;
  final List<EdgeFieldDraft> fields;
  final String from;
  final String id;
  final String to;
}

final class RouteMetricSegment {
  const RouteMetricSegment({
    required this.endDistanceMeters,
    required this.endDistancePixels,
    required this.fromNodeId,
    required this.meterLength,
    required this.pixelLength,
    required this.pixelsPerMeter,
    required this.startDistanceMeters,
    required this.startDistancePixels,
    required this.toNodeId,
  });

  final double endDistanceMeters;
  final double endDistancePixels;
  final String fromNodeId;
  final double meterLength;
  final double pixelLength;
  final double pixelsPerMeter;
  final double startDistanceMeters;
  final double startDistancePixels;
  final String toNodeId;
}

final class RouteMetricModel {
  RouteMetricModel({
    required this.averagePixelsPerMeter,
    required List<RouteMetricSegment> segments,
    required this.totalMeters,
    required this.totalPixels,
  }) : segments = List.unmodifiable(segments);

  final double averagePixelsPerMeter;
  final List<RouteMetricSegment> segments;
  final double totalMeters;
  final double totalPixels;
}
