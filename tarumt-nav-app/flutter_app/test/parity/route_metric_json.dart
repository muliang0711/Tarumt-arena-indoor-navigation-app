import 'package:indoor_navigation/domain/edge_editor/edge_editor_models.dart';

Map<String, Object?> routeMetricModelToJson(RouteMetricModel metrics) {
  return <String, Object?>{
    'averagePixelsPerMeter': metrics.averagePixelsPerMeter,
    'segments': metrics.segments
        .map(
          (segment) => <String, Object?>{
            'endDistanceMeters': segment.endDistanceMeters,
            'endDistancePixels': segment.endDistancePixels,
            'fromNodeId': segment.fromNodeId,
            'meterLength': segment.meterLength,
            'pixelLength': segment.pixelLength,
            'pixelsPerMeter': segment.pixelsPerMeter,
            'startDistanceMeters': segment.startDistanceMeters,
            'startDistancePixels': segment.startDistancePixels,
            'toNodeId': segment.toNodeId,
          },
        )
        .toList(growable: false),
    'totalMeters': metrics.totalMeters,
    'totalPixels': metrics.totalPixels,
  };
}
