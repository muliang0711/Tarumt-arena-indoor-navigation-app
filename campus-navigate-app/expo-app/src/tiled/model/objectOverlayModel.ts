import type {
  OverlayRoomLabel,
  OverlayRouteNode,
  SurfaceRect,
  TiledMap,
  TiledObject,
} from '../type';
import { getObjectLayer } from './tiledMapLayers';
import { worldToScreenPoint } from './surfaceModel';

export function getRoomLabels(map: TiledMap, surface: SurfaceRect) {
  const labelLayer = getObjectLayer(map, 'room-label-layer');

  return (labelLayer?.objects ?? []).map((object): OverlayRoomLabel => ({
    ...worldToScreenPoint(object, surface),
    height: object.height ?? 0,
    id: object.id,
    name: object.name,
    width: object.width ?? 0,
  }));
}

export function getRouteNodes(map: TiledMap, surface: SurfaceRect) {
  const routeLayer = getObjectLayer(map, 'route-graph-layer');

  return (routeLayer?.objects ?? [])
    .filter(isRouteNodeObject)
    .map((object): OverlayRouteNode => ({
      ...worldToScreenPoint(object, surface),
      id: object.id,
      nodeId: object.name,
      type: readRouteNodeType(object),
    }));
}

function isRouteNodeObject(object: TiledObject) {
  return object.point === true && object.name.length > 0;
}

function readRouteNodeType(object: TiledObject) {
  const propertyType = object.properties?.find(
    (property) => property.name === 'type' && typeof property.value === 'string',
  )?.value;

  return typeof propertyType === 'string'
    ? (object.type || propertyType).trim()
    : (object.type ?? '').trim();
}
