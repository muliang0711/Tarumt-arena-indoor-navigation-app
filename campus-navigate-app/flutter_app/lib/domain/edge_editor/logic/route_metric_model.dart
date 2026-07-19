import 'package:indoor_navigation/domain/common/geometry_math.dart';
import 'package:indoor_navigation/domain/edge_editor/edge_editor_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

RouteMetricModel createRouteMetricModel(
  List<OverlayRouteNode> routePath,
  List<RouteGraphEdgeExport> edges,
) {
  final segments = <RouteMetricSegment>[];
  var startDistanceMeters = 0.0;
  var startDistancePixels = 0.0;

  for (var index = 0; index < routePath.length - 1; index += 1) {
    final from = routePath[index];
    final to = routePath[index + 1];
    final edge = _findEdgeBetweenNodes(edges, from.nodeId, to.nodeId);
    if (edge == null) {
      throw StateError(
        'Missing EDGE distance for ${from.nodeId} -> ${to.nodeId}.',
      );
    }

    final pixelLength = distanceBetweenPoints(from, to);
    final meterLength = edge.distance;
    if (meterLength <= 0) {
      throw StateError('EDGE distance must be positive for ${edge.id}.');
    }

    final endDistanceMeters = startDistanceMeters + meterLength;
    final endDistancePixels = startDistancePixels + pixelLength;
    segments.add(
      RouteMetricSegment(
        endDistanceMeters: endDistanceMeters,
        endDistancePixels: endDistancePixels,
        fromNodeId: from.nodeId,
        meterLength: meterLength,
        pixelLength: pixelLength,
        pixelsPerMeter: pixelLength / meterLength,
        startDistanceMeters: startDistanceMeters,
        startDistancePixels: startDistancePixels,
        toNodeId: to.nodeId,
      ),
    );
    startDistanceMeters = endDistanceMeters;
    startDistancePixels = endDistancePixels;
  }

  return RouteMetricModel(
    averagePixelsPerMeter: startDistanceMeters > 0
        ? startDistancePixels / startDistanceMeters
        : 1,
    segments: segments,
    totalMeters: startDistanceMeters,
    totalPixels: startDistancePixels,
  );
}

double findPixelsPerMeterAtRoutePosition({
  required RouteMetricModel metrics,
  required RoutePosition position,
}) {
  for (final segment in metrics.segments) {
    if (position.distanceAlongRoute >= segment.startDistancePixels &&
        position.distanceAlongRoute <= segment.endDistancePixels) {
      return segment.pixelsPerMeter;
    }
  }
  return metrics.averagePixelsPerMeter;
}

double convertMetersToPixelsAtRoutePosition({
  required double meters,
  required RouteMetricModel metrics,
  required RoutePosition position,
}) {
  return meters *
      findPixelsPerMeterAtRoutePosition(metrics: metrics, position: position);
}

RouteGraphEdgeExport? _findEdgeBetweenNodes(
  List<RouteGraphEdgeExport> edges,
  String fromNodeId,
  String toNodeId,
) {
  for (final edge in edges) {
    if ((edge.from == fromNodeId && edge.to == toNodeId) ||
        (edge.from == toNodeId && edge.to == fromNodeId)) {
      return edge;
    }
  }
  return null;
}
