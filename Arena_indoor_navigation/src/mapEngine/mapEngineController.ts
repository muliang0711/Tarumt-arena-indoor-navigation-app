import type { LineSegment, Point, Polygon } from './mapGeometry';
import type { MovementConstraintMapInput } from './movement_system/constraints';

type RawObject = Record<string, unknown>;

function objectValue(value: unknown): RawObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RawObject) : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizePoint(value: unknown): Point | null {
  const source = objectValue(value);
  const x = finiteNumber(source.x);
  const y = finiteNumber(source.y);

  if (x === null || y === null) {
    return null;
  }

  return { x, y };
}

function normalizePolygon(value: unknown): Polygon | null {
  const points = arrayValue(value).map(normalizePoint).filter((point): point is Point => point !== null);
  return points.length >= 3 ? points : null;
}

function normalizePolygons(value: unknown): Polygon[] {
  return arrayValue(value).map(normalizePolygon).filter((polygon): polygon is Polygon => polygon !== null);
}

function normalizeLineSegment(value: unknown): LineSegment | null {
  const points = arrayValue(value).map(normalizePoint).filter((point): point is Point => point !== null);
  if (points.length >= 2) {
    return { from: points[0], to: points[1] };
  }

  const source = objectValue(value);
  const from = normalizePoint(source.from);
  const to = normalizePoint(source.to);
  return from && to ? { from, to } : null;
}

function normalizeLineSegments(value: unknown): LineSegment[] {
  return arrayValue(value).map(normalizeLineSegment).filter((segment): segment is LineSegment => segment !== null);
}

function polygonFromBounds(value: unknown): Polygon | null {
  const bounds = objectValue(value);
  const x = finiteNumber(bounds.x);
  const y = finiteNumber(bounds.y);
  const width = finiteNumber(bounds.width);
  const height = finiteNumber(bounds.height);

  if (x === null || y === null || width === null || height === null || width <= 0 || height <= 0) {
    return null;
  }

  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

function tilesPerMeter(rawMapData: unknown): number {
  const source = objectValue(rawMapData);
  const movement = objectValue(source.movement);
  const coordinateSystem = objectValue(movement.coordinateSystem);
  const explicitTilesPerMeter = finiteNumber(coordinateSystem.tilesPerMeter);

  if (explicitTilesPerMeter !== null && explicitTilesPerMeter > 0) {
    return explicitTilesPerMeter;
  }

  const map = objectValue(source.map);
  const tileSize = finiteNumber(map.tileSize);
  const pixelsPerMeter = finiteNumber(coordinateSystem.pixelsPerMeter);
  if (tileSize !== null && tileSize > 0 && pixelsPerMeter !== null && pixelsPerMeter > 0) {
    return pixelsPerMeter / tileSize;
  }

  return 1;
}

function polygonFromTileRect(x: number, y: number, width: number, height: number, tileScale: number): Polygon {
  return [
    { x: x / tileScale, y: y / tileScale },
    { x: (x + width) / tileScale, y: y / tileScale },
    { x: (x + width) / tileScale, y: (y + height) / tileScale },
    { x: x / tileScale, y: (y + height) / tileScale },
  ];
}

function extractBlockedAreasFromAssets(rawMapData: unknown): Polygon[] {
  const source = objectValue(rawMapData);
  const assets = objectValue(source.assets);
  const layers = objectValue(source.layers);
  const display = objectValue(source.display);
  const tileScale = tilesPerMeter(rawMapData);
  const assetManifest = new Map(
    arrayValue(assets.items).map((item) => {
      const asset = objectValue(item);
      return [optionalString(asset.id), asset] as const;
    }),
  );
  const visualLayers = arrayValue(objectValue(layers).visual).length > 0
    ? arrayValue(objectValue(layers).visual)
    : arrayValue(display.visualLayers);

  return visualLayers.flatMap((item) => {
    const layer = objectValue(item);
    const assetId = optionalString(layer.assetId);
    const asset = assetId ? assetManifest.get(assetId) : undefined;

    if (!asset || asset.blocksMovement !== true) {
      return [];
    }

    const layerX = finiteNumber(layer.x);
    const layerY = finiteNumber(layer.y);
    if (layerX === null || layerY === null) {
      return [];
    }

    const blockedOffsets = arrayValue(asset.blockedOffsets);
    if (blockedOffsets.length > 0) {
      return blockedOffsets.flatMap((offset) => {
        const point = normalizePoint(offset);
        return point ? [polygonFromTileRect(layerX + point.x, layerY + point.y, 1, 1, tileScale)] : [];
      });
    }

    const widthTiles = finiteNumber(asset.widthTiles) ?? 1;
    const heightTiles = finiteNumber(asset.heightTiles) ?? 1;
    return [polygonFromTileRect(layerX, layerY, widthTiles, heightTiles, tileScale)];
  });
}

export function extractMovementConstraintMapInput(rawMapData: unknown): MovementConstraintMapInput {
  const movement = objectValue(objectValue(rawMapData).movement);
  const boundsPolygon = polygonFromBounds(movement.bounds);
  const walkableAreas = normalizePolygons(movement.walkableAreas);
  const explicitBlockedAreas = normalizePolygons(movement.blockedAreas);
  const assetBlockedAreas = extractBlockedAreasFromAssets(rawMapData);

  return {
    walkableAreas: walkableAreas.length > 0 ? walkableAreas : boundsPolygon ? [boundsPolygon] : [],
    blockedAreas: [...explicitBlockedAreas, ...assetBlockedAreas],
    walls: normalizeLineSegments(movement.walls),
    doors: normalizePolygons(movement.doors),
    corridors: normalizePolygons(movement.corridors),
  };
}
