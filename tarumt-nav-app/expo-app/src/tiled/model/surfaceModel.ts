import type {
  OverlayPoint,
  SurfaceRect,
  TileBounds,
  TiledMap,
  TiledTileLayer,
} from '../type';

export function calculateChunkTileBounds(layers: TiledTileLayer[]): TileBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const layer of layers) {
    for (const chunk of layer.chunks ?? []) {
      minX = Math.min(minX, chunk.x);
      minY = Math.min(minY, chunk.y);
      maxX = Math.max(maxX, chunk.x + chunk.width);
      maxY = Math.max(maxY, chunk.y + chunk.height);
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    throw new Error('No tile chunks were found for map bounds metadata.');
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function createSurface(bounds: TileBounds, map: TiledMap): SurfaceRect {
  return {
    originX: bounds.minX * map.tilewidth,
    originY: bounds.minY * map.tileheight,
    width: bounds.width * map.tilewidth,
    height: bounds.height * map.tileheight,
  };
}

export function worldToScreenPoint(
  point: { x: number; y: number },
  surface: SurfaceRect,
): OverlayPoint {
  return {
    tiledX: point.x,
    tiledY: point.y,
    screenX: point.x - surface.originX,
    screenY: point.y - surface.originY,
  };
}
