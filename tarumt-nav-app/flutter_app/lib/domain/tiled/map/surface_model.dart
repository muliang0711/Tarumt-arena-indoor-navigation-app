import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

TileBounds calculateChunkTileBounds(List<TiledTileLayer> layers) {
  int? minX;
  int? minY;
  int? maxX;
  int? maxY;

  for (final layer in layers) {
    for (final chunk in layer.chunks ?? const <TiledChunk>[]) {
      minX = minX == null || chunk.x < minX ? chunk.x : minX;
      minY = minY == null || chunk.y < minY ? chunk.y : minY;
      final chunkMaxX = chunk.x + chunk.width;
      final chunkMaxY = chunk.y + chunk.height;
      maxX = maxX == null || chunkMaxX > maxX ? chunkMaxX : maxX;
      maxY = maxY == null || chunkMaxY > maxY ? chunkMaxY : maxY;
    }
  }

  if (minX == null || minY == null || maxX == null || maxY == null) {
    throw StateError('No tile chunks were found for map bounds metadata.');
  }

  return TileBounds(
    minX: minX,
    minY: minY,
    maxX: maxX,
    maxY: maxY,
    width: maxX - minX,
    height: maxY - minY,
  );
}

SurfaceRect createSurface(TileBounds bounds, TiledMap map) {
  return SurfaceRect(
    originX: (bounds.minX * map.tileWidth).toDouble(),
    originY: (bounds.minY * map.tileHeight).toDouble(),
    width: (bounds.width * map.tileWidth).toDouble(),
    height: (bounds.height * map.tileHeight).toDouble(),
  );
}

OverlayPoint worldToScreenPoint({
  required double x,
  required double y,
  required SurfaceRect surface,
}) {
  return OverlayPoint(
    tiledX: x,
    tiledY: y,
    screenX: x - surface.originX,
    screenY: y - surface.originY,
  );
}
