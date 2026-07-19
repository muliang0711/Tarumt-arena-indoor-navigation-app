import 'package:indoor_navigation/domain/tiled/map/surface_model.dart';
import 'package:indoor_navigation/domain/tiled/map/tiled_map_layers.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

List<OverlayRoomLabel> getRoomLabels(TiledMap map, SurfaceRect surface) {
  final labelLayer = getObjectLayer(map, 'room-label-layer');

  return (labelLayer?.objects ?? const <TiledObject>[])
      .map((object) {
        final point = worldToScreenPoint(
          x: object.x,
          y: object.y,
          surface: surface,
        );
        return OverlayRoomLabel(
          screenX: point.screenX,
          screenY: point.screenY,
          tiledX: point.tiledX,
          tiledY: point.tiledY,
          height: object.height ?? 0,
          id: object.id,
          name: object.name,
          width: object.width ?? 0,
        );
      })
      .toList(growable: false);
}

List<OverlayRouteNode> getRouteNodes(TiledMap map, SurfaceRect surface) {
  final routeLayer = getObjectLayer(map, 'route-graph-layer');

  return (routeLayer?.objects ?? const <TiledObject>[])
      .where(_isRouteNodeObject)
      .map((object) {
        final point = worldToScreenPoint(
          x: object.x,
          y: object.y,
          surface: surface,
        );
        return OverlayRouteNode(
          screenX: point.screenX,
          screenY: point.screenY,
          tiledX: point.tiledX,
          tiledY: point.tiledY,
          id: object.id,
          nodeId: object.name,
          type: _readRouteNodeType(object),
        );
      })
      .toList(growable: false);
}

bool _isRouteNodeObject(TiledObject object) {
  return object.point == true && object.name.isNotEmpty;
}

String _readRouteNodeType(TiledObject object) {
  Object? propertyType;
  for (final property in object.properties ?? const <TiledProperty>[]) {
    if (property.name == 'type' && property.value is String) {
      propertyType = property.value;
      break;
    }
  }

  if (propertyType is String) {
    final objectType = object.type;
    return (objectType != null && objectType.isNotEmpty
            ? objectType
            : propertyType)
        .trim();
  }
  return (object.type ?? '').trim();
}
