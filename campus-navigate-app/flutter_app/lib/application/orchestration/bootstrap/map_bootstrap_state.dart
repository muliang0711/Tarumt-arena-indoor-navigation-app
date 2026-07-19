import 'package:indoor_navigation/domain/edge_editor/edge_editor_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

enum MapBootstrapStatus { idle, loading, ready, error }

final class MapBootstrapData {
  MapBootstrapData({
    required this.edgeDocumentJson,
    required List<RouteGraphEdgeExport> edges,
    required this.mapModel,
    required this.routeMetrics,
    required this.sourceMap,
    required this.tiledMapJson,
  }) : edges = List.unmodifiable(edges);

  /// Exact repository source used to parse the initial EDGE document.
  final String edgeDocumentJson;
  final List<RouteGraphEdgeExport> edges;
  final PngMapModel mapModel;
  final RouteMetricModel routeMetrics;
  final String sourceMap;

  /// Exact repository source used to parse the Tiled map.
  final String tiledMapJson;
}

final class MapBootstrapState {
  const MapBootstrapState._({
    required this.status,
    this.data,
    this.error,
    this.stackTrace,
  });

  const MapBootstrapState.idle() : this._(status: MapBootstrapStatus.idle);

  const MapBootstrapState.loading()
    : this._(status: MapBootstrapStatus.loading);

  const MapBootstrapState.ready(MapBootstrapData data)
    : this._(status: MapBootstrapStatus.ready, data: data);

  const MapBootstrapState.error(Object error, StackTrace stackTrace)
    : this._(
        status: MapBootstrapStatus.error,
        error: error,
        stackTrace: stackTrace,
      );

  final MapBootstrapData? data;
  final Object? error;
  final StackTrace? stackTrace;
  final MapBootstrapStatus status;

  List<RouteGraphEdgeExport> get edges =>
      data?.edges ?? const <RouteGraphEdgeExport>[];
  PngMapModel? get mapModel => data?.mapModel;
  RouteMetricModel? get routeMetrics => data?.routeMetrics;
  String? get sourceMap => data?.sourceMap;
}
