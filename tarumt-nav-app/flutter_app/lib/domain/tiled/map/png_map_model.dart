import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/tiled/map/marker_model.dart';
import 'package:indoor_navigation/domain/tiled/map/object_overlay_model.dart';
import 'package:indoor_navigation/domain/tiled/map/path_segment_model.dart';
import 'package:indoor_navigation/domain/tiled/map/route_path_model.dart';
import 'package:indoor_navigation/domain/tiled/map/surface_model.dart';
import 'package:indoor_navigation/domain/tiled/map/tiled_map_layers.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

PngMapModel createPngMapModel(TiledMap map) {
  assertSupportedMap(map);

  final bounds = calculateChunkTileBounds(getVisibleTileLayers(map));
  final surface = createSurface(bounds, map);

  if (surface.width != demoPngSize.width ||
      surface.height != demoPngSize.height) {
    throw StateError(
      '${DemoPngSize.name} is ${demoPngSize.width}x${demoPngSize.height}, '
      'but the TMJ bounds are ${_formatDimension(surface.width)}x'
      '${_formatDimension(surface.height)}.',
    );
  }

  final routeNodes = getRouteNodes(map, surface);
  final blueMarker = createBlueMarkerState(routeNodes);
  final redMarker = createRedMarkerState(blueMarker);
  final routePath = createRoutePath(routeNodes);

  return PngMapModel(
    blueMarker: blueMarker,
    bounds: bounds,
    map: map,
    routePath: routePath,
    pathSegments: createPathSegmentsFromPoints(routePath),
    png: DemoPngMetadata(height: demoPngSize.height, width: demoPngSize.width),
    redMarker: redMarker,
    roomLabels: getRoomLabels(map, surface),
    routeNodes: routeNodes,
    surface: surface,
  );
}

PngMapModel createPngMapModelWithRoute(
  PngMapModel source,
  List<String> routeNodeIds,
) {
  final routePath = createRoutePath(source.routeNodes, nodeIds: routeNodeIds);
  final blueMarker = createBlueMarkerState(
    routePath,
    startNodeId: routeNodeIds.first,
  );
  return PngMapModel(
    blueMarker: blueMarker,
    bounds: source.bounds,
    map: source.map,
    routePath: routePath,
    pathSegments: createPathSegmentsFromPoints(routePath),
    png: source.png,
    redMarker: createRedMarkerState(blueMarker),
    roomLabels: source.roomLabels,
    routeNodes: source.routeNodes,
    surface: source.surface,
  );
}

String _formatDimension(double value) {
  return value == value.truncateToDouble()
      ? value.toInt().toString()
      : value.toString();
}
