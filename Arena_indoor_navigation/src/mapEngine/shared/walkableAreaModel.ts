import { tilesToWorldMeters } from './coordinateSystem';
import type { MapCoordinateSystem } from './coordinateSystem';
import type { Polygon } from './geometry';
import type { VisualLayer } from './mapContracts';

type WalkableLayer = Pick<VisualLayer, 'assetId' | 'x' | 'y'>;

export function isTemporaryWalkableAssetId(assetId: string): boolean {
  return /^(walkable_|road_)/.test(assetId);
}

export function extractTemporaryWalkableAreas(
  visualLayers: readonly WalkableLayer[],
  coordinateSystem: MapCoordinateSystem,
): Polygon[] {
  return visualLayers
    .filter((layer) => isTemporaryWalkableAssetId(layer.assetId))
    .map((layer) => tileRectToWorldPolygon(layer.x, layer.y, coordinateSystem));
}

function tileRectToWorldPolygon(
  x: number,
  y: number,
  coordinateSystem: MapCoordinateSystem,
): Polygon {
  const topLeft = tilesToWorldMeters({ x, y }, coordinateSystem);
  const bottomRight = tilesToWorldMeters({ x: x + 1, y: y + 1 }, coordinateSystem);

  return [
    topLeft,
    { x: bottomRight.x, y: topLeft.y },
    bottomRight,
    { x: topLeft.x, y: bottomRight.y },
  ];
}
