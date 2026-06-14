import type { CollisionState, MapDocumentV2 } from "./schema";

const VALID_COLLISION_STATES = new Set<CollisionState>(["walkable", "blocked"]);

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isInsideMap(map: MapDocumentV2, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < map.map.width && y < map.map.height;
}

function collectDuplicateIds(items: Array<{ id: string }>): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of items) {
    if (seen.has(item.id)) {
      duplicates.add(item.id);
    }
    seen.add(item.id);
  }

  return [...duplicates].sort();
}

export function validateMapDocument(map: MapDocumentV2): string[] {
  const errors: string[] = [];

  if (map.schemaVersion !== 2) {
    errors.push("Schema version must be 2.");
  }

  if (!map.map.id.trim()) {
    errors.push("Map id is required.");
  }

  if (!isPositiveInteger(map.map.width)) {
    errors.push("Map width must be a positive integer.");
  }

  if (!isPositiveInteger(map.map.height)) {
    errors.push("Map height must be a positive integer.");
  }

  if (!isPositiveInteger(map.map.tileSize)) {
    errors.push("Tile size must be a positive integer.");
  }

  const assetById = new Map(map.assets.items.map((asset) => [asset.id, asset]));
  for (const id of collectDuplicateIds(map.assets.items)) {
    errors.push(`Duplicate asset id: ${id}.`);
  }

  for (const id of collectDuplicateIds(map.layers.visual)) {
    errors.push(`Duplicate placement id: ${id}.`);
  }

  for (const placement of map.layers.visual) {
    const asset = assetById.get(placement.assetId);
    if (!asset) {
      errors.push(`Placement ${placement.id} uses missing asset ${placement.assetId}.`);
      continue;
    }

    const maxX = placement.x + asset.widthTiles - 1;
    const maxY = placement.y + asset.heightTiles - 1;
    if (!isInsideMap(map, placement.x, placement.y) || !isInsideMap(map, maxX, maxY)) {
      errors.push(`Placement ${placement.id} is outside map bounds.`);
    }
  }

  for (const cell of map.layers.collision) {
    if (!isInsideMap(map, cell.x, cell.y)) {
      errors.push(`Collision cell ${cell.x},${cell.y} is outside map bounds.`);
    }
    if (!VALID_COLLISION_STATES.has(cell.state)) {
      errors.push(`Collision cell ${cell.x},${cell.y} has invalid state ${cell.state}.`);
    }
  }

  const nodeIds = new Set<string>();
  for (const id of collectDuplicateIds(map.navigation.nodes)) {
    errors.push(`Duplicate node id: ${id}.`);
  }

  for (const node of map.navigation.nodes) {
    if (!node.id.trim()) {
      errors.push("Node id is required.");
      continue;
    }
    nodeIds.add(node.id);
    if (!isInsideMap(map, node.x, node.y)) {
      errors.push(`Node ${node.id} is outside map bounds.`);
    }
  }

  for (const id of collectDuplicateIds(map.navigation.links)) {
    errors.push(`Duplicate link id: ${id}.`);
  }

  for (const link of map.navigation.links) {
    if (!nodeIds.has(link.from)) {
      errors.push(`Link ${link.id} points to missing node ${link.from}.`);
    }
    if (!nodeIds.has(link.to)) {
      errors.push(`Link ${link.id} points to missing node ${link.to}.`);
    }
  }

  if (!isInsideMap(map, map.spawn.x, map.spawn.y)) {
    errors.push("Spawn point is outside map bounds.");
  }

  return errors;
}
