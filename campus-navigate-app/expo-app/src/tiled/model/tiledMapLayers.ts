import type {
  TiledMap,
  TiledObjectLayer,
  TiledTileLayer,
} from '../type';

export function assertSupportedMap(map: TiledMap) {
  if (map.type !== 'map') {
    throw new Error(`Unsupported Tiled document type: ${map.type}`);
  }
  if (map.orientation !== 'orthogonal') {
    throw new Error(`Unsupported Tiled orientation: ${map.orientation}`);
  }
  if (!map.infinite) {
    throw new Error('This app expects the demo infinite map export.');
  }
}

export function getVisibleTileLayers(map: TiledMap) {
  return map.layers.filter(
    (layer): layer is TiledTileLayer =>
      layer.type === 'tilelayer' && layer.visible !== false,
  );
}

export function getObjectLayer(map: TiledMap, name: string) {
  return map.layers.find(
    (layer): layer is TiledObjectLayer =>
      layer.type === 'objectgroup' && layer.name === name,
  );
}
