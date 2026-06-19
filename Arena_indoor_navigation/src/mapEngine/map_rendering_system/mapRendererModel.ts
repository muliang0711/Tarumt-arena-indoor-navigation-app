import {
  extractMapCoordinateSystem,
  tilesToPixels,
  type Bounds,
  type MapCoordinateSystem,
  type MapAsset,
  type NormalizedMapSchema,
  type RouteEdge,
  type RouteNode,
  type VisualLayer,
} from '../shared';

export type { Bounds, MapAsset, NormalizedMapSchema, RouteNode, VisualLayer } from '../shared';


const KIND_ORDER = new Map([
  ['floor', 0],
  ['room', 1],
  ['wall-object', 2],
  ['door', 3],
  ['decoration', 4],
  ['unknown', 5],
]);

export function normalizeMapSchema(
  raw: unknown,
  validatedCoordinateSystem?: MapCoordinateSystem,
): NormalizedMapSchema {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Map schema must be an object.');
  }
  const source = raw as Record<string, unknown>;
  const map = objectValue(source.map);
  const coordinateSystem = validatedCoordinateSystem ?? extractMapCoordinateSystem(raw);
  const tileSize = coordinateSystem.tileSizePixels;
  const width = requiredPositiveNumber(map.width, 'map.width');
  const height = requiredPositiveNumber(map.height, 'map.height');
  const assetsRoot = objectValue(source.assets);
  const display = objectValue(source.display);
  const layers = objectValue(source.layers);
  const movement = objectValue(source.movement);
  const routeGraph = objectValue(movement.routeGraph);

  return {
    metadata: {
      id: stringValue(map.id, 'map.id'),
      name: optionalString(map.name) || stringValue(map.id, 'map.id'),
      floor: optionalString(map.floor),
    },
    coordinateSystem,
    tileSize,
    width,
    height,
    worldWidth: tilesToPixels({ x: width, y: 0 }, coordinateSystem).x,
    worldHeight: tilesToPixels({ x: 0, y: height }, coordinateSystem).y,
    resourceRoot: optionalString(assetsRoot.resourceRoot) || 'resources',
    assets: normalizeAssets(
      arrayValue(assetsRoot.items) || arrayValue(display.assets) || [],
      coordinateSystem,
    ),
    visualLayers: normalizeVisualLayers(arrayValue(objectValue(layers).visual) || arrayValue(display.visualLayers) || []),
    movement: {
      coordinateSystem,
      routeGraph: {
        nodes: normalizeRouteNodes(arrayValue(routeGraph.nodes) || []),
        edges: normalizeRouteEdges(arrayValue(routeGraph.edges) || []),
      },
    },
  };
}

export function orderVisualLayers(visualLayers: VisualLayer[]): VisualLayer[] {
  return [...visualLayers]
    .map((placement, index) => ({ placement, index, kind: classifyAsset(placement.assetId) }))
    .sort((a, b) => {
      const orderDiff = Number(KIND_ORDER.get(a.kind)) - Number(KIND_ORDER.get(b.kind));
      return orderDiff || a.index - b.index;
    })
    .map((item) => item.placement);
}

export function getVisualBounds(mapData: NormalizedMapSchema): Bounds {
  if (mapData.visualLayers.length === 0) {
    return { x: 0, y: 0, width: mapData.worldWidth, height: mapData.worldHeight };
  }

  const manifest = new Map(mapData.assets.map((asset) => [asset.id, asset]));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const placement of mapData.visualLayers) {
    const asset = manifest.get(placement.assetId);
    const placementPixels = tilesToPixels(placement, mapData.coordinateSystem);
    const x = placementPixels.x;
    const y = placementPixels.y;
    const width = asset?.widthPixels || mapData.tileSize;
    const height = asset?.heightPixels || mapData.tileSize;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }

  return {
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.round(maxX - minX),
    height: Math.round(maxY - minY),
  };
}

export function classifyAsset(assetId: string) {
  if (/^(road_|walkable_|unwalkable_|white_?|white_|.*tile)/.test(assetId)) {
    return 'floor';
  }
  if (/^(classroom|examroom|meetingroom|toilet|staris|stairs)/.test(assetId)) {
    return 'room';
  }
  if (/^wall_/.test(assetId)) {
    return 'wall-object';
  }
  if (/^(door|elevator)/.test(assetId)) {
    return 'door';
  }
  if (/(tree|bush|flower|stump|sign|fence)/.test(assetId)) {
    return 'decoration';
  }
  return 'unknown';
}

function normalizeAssets(
  items: unknown[],
  coordinateSystem: MapCoordinateSystem,
): MapAsset[] {
  return items.map((item, index) => {
    const asset = objectValue(item);
    const widthTiles = positiveNumber(asset.widthTiles, 1);
    const heightTiles = positiveNumber(asset.heightTiles, 1);
    const sizePixels = tilesToPixels(
      { x: widthTiles, y: heightTiles },
      coordinateSystem,
    );
    return {
      id: stringValue(asset.id, `assets[${index}].id`),
      src: stringValue(asset.src, `assets[${index}].src`),
      widthTiles,
      heightTiles,
      widthPixels: sizePixels.x,
      heightPixels: sizePixels.y,
      blocksMovement: Boolean(asset.blocksMovement),
    };
  });
}

function normalizeVisualLayers(items: unknown[]): VisualLayer[] {
  return items.map((item, index) => {
    const layer = objectValue(item);
    return {
      id: optionalString(layer.id) || `${optionalString(layer.assetId) || 'asset'}_${index}`,
      assetId: stringValue(layer.assetId, `visualLayers[${index}].assetId`),
      x: finiteNumber(layer.x, `visualLayers[${index}].x`),
      y: finiteNumber(layer.y, `visualLayers[${index}].y`),
      z: Number.isFinite(layer.z) ? Number(layer.z) : index,
    };
  });
}

function normalizeRouteNodes(items: unknown[]): RouteNode[] {
  return items.map((item, index) => {
    const node = objectValue(item);
    const position = objectValue(node.position);
    return {
      node_id: optionalString(node.node_id),
      id: optionalString(node.id),
      position: {
        x: finiteNumber(position.x, `routeGraph.nodes[${index}].position.x`),
        y: finiteNumber(position.y, `routeGraph.nodes[${index}].position.y`),
      },
    };
  });
}

function normalizeRouteEdges(items: unknown[]): RouteEdge[] {
  return items.map((item, index) => {
    const edge = objectValue(item);
    return {
      edge_id: optionalString(edge.edge_id),
      id: optionalString(edge.id),
      from_node: stringValue(edge.from_node, `routeGraph.edges[${index}].from_node`),
      to_node: stringValue(edge.to_node, `routeGraph.edges[${index}].to_node`),
      bidirectional: edge.bidirectional === true,
      weight: optionalFiniteNumber(edge.weight, `routeGraph.edges[${index}].weight`),
      distance_m: optionalFiniteNumber(edge.distance_m, `routeGraph.edges[${index}].distance_m`),
      enabled: edge.enabled !== false,
    };
  });
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function arrayValue(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function positiveNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function requiredPositiveNumber(value: unknown, label: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return number;
}

function finiteNumber(value: unknown, label: string): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return number;
}

function optionalFiniteNumber(value: unknown, label: string): number | undefined {
  return value === undefined || value === null ? undefined : finiteNumber(value, label);
}
