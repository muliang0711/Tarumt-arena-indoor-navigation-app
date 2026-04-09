import type {
  Bounds,
  MapPackageJson,
  ParsedMapFloor,
  ParsedPlacement,
  ParsedResolvedTile,
  SpriteAssetDefinition,
} from '../types';

function resolveTileSprite(
  kind: ParsedResolvedTile['kind'],
  blocked: SpriteAssetDefinition | null,
  walkable: SpriteAssetDefinition | null,
) {
  return kind === 'walkable' ? walkable : blocked;
}

function computeFocusBounds(
  placements: ParsedPlacement[],
  worldWidth: number,
  worldHeight: number,
  tileSize: number,
): Bounds {
  if (placements.length === 0) {
    return { x: 0, y: 0, width: worldWidth, height: worldHeight };
  }

  const minX = Math.min(...placements.map((placement) => placement.x));
  const minY = Math.min(...placements.map((placement) => placement.y));
  const maxX = Math.max(...placements.map((placement) => placement.x + placement.width));
  const maxY = Math.max(...placements.map((placement) => placement.y + placement.height));
  const padding = tileSize * 6;

  return {
    x: Math.max(0, minX - padding),
    y: Math.max(0, minY - padding),
    width: Math.min(worldWidth, maxX - minX + padding * 2),
    height: Math.min(worldHeight, maxY - minY + padding * 2),
  };
}

export function parseIndoorMapPackage(
  rawMap: MapPackageJson,
  assetRegistry: Record<string, SpriteAssetDefinition>,
): ParsedMapFloor {
  const tileSize = rawMap.tileSize;
  const worldWidth = rawMap.mapWidth * tileSize;
  const worldHeight = rawMap.mapHeight * tileSize;
  const blocked = rawMap.background.blockedAssetId
    ? assetRegistry[rawMap.background.blockedAssetId] ?? null
    : null;
  const walkable = rawMap.background.walkableAssetId
    ? assetRegistry[rawMap.background.walkableAssetId] ?? null
    : null;

  const placements: ParsedPlacement[] = rawMap.visual.placements
    .map((placement) => {
      const sprite = assetRegistry[placement.assetId];
      if (!sprite) {
        return null;
      }

      return {
        id: placement.id,
        assetId: placement.assetId,
        tileX: placement.tileX,
        tileY: placement.tileY,
        x: placement.tileX * tileSize,
        y: placement.tileY * tileSize,
        width: sprite.widthPx,
        height: sprite.heightPx,
        tileSpanX: sprite.widthPx / tileSize,
        tileSpanY: sprite.heightPx / tileSize,
        category: sprite.category,
        sprite,
      };
    })
    .filter((placement): placement is ParsedPlacement => placement !== null);

  const rooms = placements.filter((placement) => placement.category === 'room');
  const roads = placements.filter((placement) => placement.category === 'road');
  const resolvedTiles: ParsedResolvedTile[] = (rawMap.metadata?.resolvedTiles ?? []).map((tile) => {
    const sprite = resolveTileSprite(tile.kind, blocked, walkable);
    return {
      key: `${tile.x}-${tile.y}-${tile.kind}`,
      x: tile.x * tileSize,
      y: tile.y * tileSize,
      width: tileSize,
      height: tileSize,
      kind: tile.kind,
      sprite,
    };
  });

  return {
    id: 'student-center-level-3',
    label: 'Level 3',
    buildingName: 'Student Center',
    tileSize,
    mapWidthTiles: rawMap.mapWidth,
    mapHeightTiles: rawMap.mapHeight,
    worldWidth,
    worldHeight,
    focusBounds: computeFocusBounds(placements, worldWidth, worldHeight, tileSize),
    background: {
      mode: rawMap.background.mode,
      blocked,
      walkable,
    },
    placements,
    rooms,
    roads,
    resolvedTiles,
  };
}
