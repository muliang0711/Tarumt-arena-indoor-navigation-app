import type { CollisionState, MapDocument, MapDocumentV3 } from "./schema";

const VALID_COLLISION_STATES = new Set<CollisionState>(["walkable", "blocked"]);

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isInsideMap(map: { map: { width: number; height: number } }, x: number, y: number): boolean {
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

function isV3Document(map: MapDocument): map is MapDocumentV3 {
  return map.schemaVersion === 3;
}

function validateV3MovementSection(map: MapDocumentV3): string[] {
  const errors: string[] = [];
  const { movement } = map;

  if (movement.coordinateSystem.unit !== "meter") {
    errors.push("Movement coordinate system unit must be meter.");
  }

  if (movement.coordinateSystem.origin !== "top-left") {
    errors.push("Movement coordinate system origin must be top-left.");
  }

  if (!(movement.coordinateSystem.pixelsPerMeter > 0)) {
    errors.push("Movement pixelsPerMeter must be positive.");
  }

  if (!(movement.coordinateSystem.tilesPerMeter > 0)) {
    errors.push("Movement tilesPerMeter must be positive.");
  }

  if (movement.bounds.width <= 0 || movement.bounds.height <= 0) {
    errors.push("Movement bounds must have positive width and height.");
  }

  for (const room of movement.rooms) {
    if (!room.id.trim()) {
      errors.push("Movement room id is required.");
    }
    if (room.polygon.length < 3) {
      errors.push(`Movement room ${room.id} must have at least 3 polygon points.`);
    }
  }

  for (const corridor of movement.corridors) {
    if (!corridor.id.trim()) {
      errors.push("Movement corridor id is required.");
    }
    if (corridor.polygon.length < 3) {
      errors.push(`Movement corridor ${corridor.id} must have at least 3 polygon points.`);
    }
  }

  for (const area of movement.walkableAreas) {
    if (!area.id.trim()) {
      errors.push("Movement walkable area id is required.");
    }
    if (area.polygon.length < 3) {
      errors.push(`Movement walkable area ${area.id} must have at least 3 polygon points.`);
    }
  }

  for (const wall of movement.walls) {
    if (!wall.id.trim()) {
      errors.push("Movement wall id is required.");
    }
  }

  for (const door of movement.doors) {
    if (!door.id.trim()) {
      errors.push("Movement door id is required.");
    }
  }

  for (const entrance of movement.entrances) {
    if (!entrance.id.trim()) {
      errors.push("Movement entrance id is required.");
    }
    if (!entrance.connectsTo.trim()) {
      errors.push(`Movement entrance ${entrance.id} must connect to a target.`);
    }
  }

  const routeNodeIds = new Set<string>();
  for (const node of movement.routeGraph.nodes) {
    if (!node.node_id.trim()) {
      errors.push("Movement route node id is required.");
      continue;
    }
    routeNodeIds.add(node.node_id);
  }

  for (const edge of movement.routeGraph.edges) {
    if (!routeNodeIds.has(edge.from_node)) {
      errors.push(`Movement edge ${edge.edge_id} points to missing node ${edge.from_node}.`);
    }
    if (!routeNodeIds.has(edge.to_node)) {
      errors.push(`Movement edge ${edge.edge_id} points to missing node ${edge.to_node}.`);
    }
  }

  return errors;
}

export function validateMapDocument(map: MapDocument): string[] {
  const errors: string[] = [];

  if (map.schemaVersion !== 2 && map.schemaVersion !== 3) {
    errors.push("Schema version must be 2 or 3.");
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

  if (isV3Document(map)) {
    errors.push(...validateV3MovementSection(map));
  }

  return errors;
}
