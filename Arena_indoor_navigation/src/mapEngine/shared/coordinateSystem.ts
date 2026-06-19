import { assertFinitePoint, type Point } from './geometry';

export type MapCoordinateSystem = {
  worldUnit: 'meter';
  origin: 'top-left';
  pixelsPerMeter: number;
  tileSizePixels: number;
  tilesPerMeter: number;
  metersPerTile: number;
  fallbacks: readonly CoordinateFallback[];
};

export type CoordinateFallback =
  | 'worldUnit'
  | 'origin'
  | 'tileSizePixels'
  | 'pixelsPerMeter'
  | 'tilesPerMeter'
  | 'metersPerTile';

const DEFAULT_PIXELS_PER_METER = 40;
const DEFAULT_TILE_SIZE_PIXELS = 16;
const FLOAT_TOLERANCE = 0.000001;

type RawObject = Record<string, unknown>;

export function extractMapCoordinateSystem(rawMapData: unknown): MapCoordinateSystem {
  const source = objectValue(rawMapData);
  const map = objectValue(source.map);
  const movement = objectValue(source.movement);
  const rawCoordinateSystem = objectValue(movement.coordinateSystem);
  const fallbacks: CoordinateFallback[] = [];

  const rawUnit = rawCoordinateSystem.worldUnit ?? rawCoordinateSystem.unit;
  const worldUnit = rawUnit === undefined ? fallback('meter', 'worldUnit', fallbacks) : rawUnit;
  if (worldUnit !== 'meter') {
    throw new Error(`movement.coordinateSystem.worldUnit must equal "meter"; received "${String(worldUnit)}".`);
  }

  const rawOrigin = rawCoordinateSystem.origin;
  const origin = rawOrigin === undefined ? fallback('top-left', 'origin', fallbacks) : rawOrigin;
  if (origin !== 'top-left') {
    throw new Error(`movement.coordinateSystem.origin must equal "top-left"; received "${String(origin)}".`);
  }

  const mapTileSize = optionalPositiveNumber(map.tileSize, 'map.tileSize');
  const coordinateTileSize = optionalPositiveNumber(
    rawCoordinateSystem.tileSizePixels,
    'movement.coordinateSystem.tileSizePixels',
  );
  if (
    mapTileSize !== undefined &&
    coordinateTileSize !== undefined
  ) {
    assertApproximatelyEqual(
      mapTileSize,
      coordinateTileSize,
      'map.tileSize must equal movement.coordinateSystem.tileSizePixels',
    );
  }
  const tileSizePixels =
    mapTileSize ??
    coordinateTileSize ??
    fallback(DEFAULT_TILE_SIZE_PIXELS, 'tileSizePixels', fallbacks);
  const explicitPixelsPerMeter = optionalPositiveNumber(
    rawCoordinateSystem.pixelsPerMeter,
    'movement.coordinateSystem.pixelsPerMeter',
  );
  const explicitTilesPerMeter = optionalPositiveNumber(
    rawCoordinateSystem.tilesPerMeter,
    'movement.coordinateSystem.tilesPerMeter',
  );
  const explicitMetersPerTile = optionalPositiveNumber(
    rawCoordinateSystem.metersPerTile ?? rawCoordinateSystem.scale,
    'movement.coordinateSystem.metersPerTile',
  );

  let pixelsPerMeter = explicitPixelsPerMeter;
  let tilesPerMeter = explicitTilesPerMeter;
  let metersPerTile = explicitMetersPerTile;

  if (tilesPerMeter === undefined && metersPerTile !== undefined) {
    tilesPerMeter = 1 / metersPerTile;
    fallbacks.push('tilesPerMeter');
  }
  if (metersPerTile === undefined && tilesPerMeter !== undefined) {
    metersPerTile = 1 / tilesPerMeter;
    fallbacks.push('metersPerTile');
  }
  if (tilesPerMeter === undefined && pixelsPerMeter !== undefined) {
    tilesPerMeter = pixelsPerMeter / tileSizePixels;
    fallbacks.push('tilesPerMeter');
  }
  if (pixelsPerMeter === undefined && tilesPerMeter !== undefined) {
    pixelsPerMeter = tileSizePixels * tilesPerMeter;
    fallbacks.push('pixelsPerMeter');
  }

  if (pixelsPerMeter === undefined) {
    pixelsPerMeter = fallback(DEFAULT_PIXELS_PER_METER, 'pixelsPerMeter', fallbacks);
  }
  if (tilesPerMeter === undefined) {
    tilesPerMeter = fallback(pixelsPerMeter / tileSizePixels, 'tilesPerMeter', fallbacks);
  }
  if (metersPerTile === undefined) {
    metersPerTile = fallback(1 / tilesPerMeter, 'metersPerTile', fallbacks);
  }

  assertApproximatelyEqual(
    pixelsPerMeter,
    tileSizePixels * tilesPerMeter,
    'pixelsPerMeter must equal tileSizePixels × tilesPerMeter',
  );
  assertApproximatelyEqual(
    metersPerTile,
    1 / tilesPerMeter,
    'metersPerTile must equal 1 / tilesPerMeter',
  );

  return {
    worldUnit: 'meter',
    origin: 'top-left',
    pixelsPerMeter,
    tileSizePixels,
    tilesPerMeter,
    metersPerTile,
    fallbacks,
  };
}

export function worldMetersToPixels(point: Point, coordinateSystem: MapCoordinateSystem): Point {
  assertFinitePoint(point, 'world meter point');
  return {
    x: point.x * coordinateSystem.pixelsPerMeter,
    y: point.y * coordinateSystem.pixelsPerMeter,
  };
}

export function pixelsToWorldMeters(point: Point, coordinateSystem: MapCoordinateSystem): Point {
  assertFinitePoint(point, 'pixel point');
  return {
    x: point.x / coordinateSystem.pixelsPerMeter,
    y: point.y / coordinateSystem.pixelsPerMeter,
  };
}

export function tilesToWorldMeters(point: Point, coordinateSystem: MapCoordinateSystem): Point {
  assertFinitePoint(point, 'tile point');
  return {
    x: point.x * coordinateSystem.metersPerTile,
    y: point.y * coordinateSystem.metersPerTile,
  };
}

export function tilesToPixels(point: Point, coordinateSystem: MapCoordinateSystem): Point {
  return worldMetersToPixels(tilesToWorldMeters(point, coordinateSystem), coordinateSystem);
}

function objectValue(value: unknown): RawObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RawObject) : {};
}

function optionalPositiveNumber(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${label} must be finite and greater than zero.`);
  }
  return number;
}

function fallback<T>(value: T, name: CoordinateFallback, fallbacks: CoordinateFallback[]): T {
  fallbacks.push(name);
  return value;
}

function assertApproximatelyEqual(actual: number, expected: number, message: string): void {
  const scale = Math.max(1, Math.abs(actual), Math.abs(expected));
  if (Math.abs(actual - expected) > FLOAT_TOLERANCE * scale) {
    throw new Error(`${message}; received ${actual} and ${expected}.`);
  }
}
