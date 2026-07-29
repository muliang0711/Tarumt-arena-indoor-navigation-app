import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

void assertSupportedMap(TiledMap map) {
  if (map.orientation != 'orthogonal') {
    throw UnsupportedError('Unsupported Tiled orientation: ${map.orientation}');
  }
  if (map.infinite != true) {
    throw UnsupportedError('This app expects the demo infinite map export.');
  }
}

List<TiledTileLayer> getVisibleTileLayers(TiledMap map) {
  return map.layers
      .whereType<TiledTileLayer>()
      .where((layer) => layer.visible != false)
      .toList(growable: false);
}

TiledObjectLayer? getObjectLayer(TiledMap map, String name) {
  for (final layer in map.layers) {
    if (layer is TiledObjectLayer && layer.name == name) {
      return layer;
    }
  }
  return null;
}
