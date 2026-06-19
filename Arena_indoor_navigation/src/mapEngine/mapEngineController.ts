import {
  extractMapCoordinateSystem,
  extractTemporaryWalkableAreas,
  tilesToWorldMeters,
  type LineSegment,
  type MapCoordinateSystem,
  type MovementConstraintMapInput,
  type MovementRouteGraph,
  type Point,
  type Polygon,
  type RouteEdge,
  type RouteNode,
} from './shared';

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

function normalizePolygon(value: unknown, label: string): Polygon | null {
  const rawPoints = arrayValue(value);
  if (rawPoints.length === 0) {
    return null;
  }
  const points = rawPoints.map((point, index) => requiredPoint(point, `${label}[${index}]`));
  if (points.length < 3) {
    throw new Error(`${label} must contain at least three points.`);
  }
  return points;
}

function normalizePolygons(value: unknown, label: string): Polygon[] {
  return arrayValue(value)
    .map((polygon, index) => normalizePolygon(polygon, `${label}[${index}]`))
    .filter((polygon): polygon is Polygon => polygon !== null);
}

function normalizeLineSegment(value: unknown, label: string): LineSegment | null {
  const rawPoints = arrayValue(value);
  const points = rawPoints.map((point, index) => requiredPoint(point, `${label}[${index}]`));
  if (points.length >= 2) {
    return { from: points[0], to: points[1] };
  }

  const source = objectValue(value);
  const from = normalizePoint(source.from);
  const to = normalizePoint(source.to);
  if (from && to) {
    return { from, to };
  }
  if (value !== undefined && value !== null) {
    throw new Error(`${label} must contain finite from and to points.`);
  }
  return null;
}

function normalizeLineSegments(value: unknown, label: string): LineSegment[] {
  return arrayValue(value)
    .map((segment, index) => normalizeLineSegment(segment, `${label}[${index}]`))
    .filter((segment): segment is LineSegment => segment !== null);
}

function polygonFromBounds(value: unknown): Polygon | null {
  if (value === undefined || value === null) {
    return null;
  }
  const bounds = objectValue(value);
  const x = finiteNumber(bounds.x);
  const y = finiteNumber(bounds.y);
  const width = finiteNumber(bounds.width);
  const height = finiteNumber(bounds.height);

  if (x === null || y === null || width === null || height === null || width <= 0 || height <= 0) {
    throw new Error('movement.bounds must contain finite x, y, width and height values with positive size.');
  }

  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

function polygonFromTileRect(
  x: number,
  y: number,
  width: number,
  height: number,
  coordinateSystem: MapCoordinateSystem,
): Polygon {
  const topLeft = tilesToWorldMeters({ x, y }, coordinateSystem);
  const bottomRight = tilesToWorldMeters({ x: x + width, y: y + height }, coordinateSystem);
  return [
    topLeft,
    { x: bottomRight.x, y: topLeft.y },
    bottomRight,
    { x: topLeft.x, y: bottomRight.y },
  ];
}

function extractBlockedAreasFromAssets(
  rawMapData: unknown,
  coordinateSystem: MapCoordinateSystem,
): Polygon[] {
  const source = objectValue(rawMapData);
  const assets = objectValue(source.assets);
  const layers = objectValue(source.layers);
  const display = objectValue(source.display);
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
        return point
          ? [polygonFromTileRect(layerX + point.x, layerY + point.y, 1, 1, coordinateSystem)]
          : [];
      });
    }

    const widthTiles = finiteNumber(asset.widthTiles) ?? 1;
    const heightTiles = finiteNumber(asset.heightTiles) ?? 1;
    return [polygonFromTileRect(layerX, layerY, widthTiles, heightTiles, coordinateSystem)];
  });
}

function visualLayersFromRawMap(rawMapData: unknown): unknown[] {
  const source = objectValue(rawMapData);
  const layers = objectValue(source.layers);
  const display = objectValue(source.display);

  return arrayValue(objectValue(layers).visual).length > 0
    ? arrayValue(objectValue(layers).visual)
    : arrayValue(display.visualLayers);
}

export function extractMovementConstraintMapInput(
  rawMapData: unknown,
  validatedCoordinateSystem?: MapCoordinateSystem,
): MovementConstraintMapInput {
  const movement = objectValue(objectValue(rawMapData).movement);
  const coordinateSystem = validatedCoordinateSystem ?? extractMapCoordinateSystem(rawMapData);
  const boundsPolygon = polygonFromBounds(movement.bounds);
  const walkableAreas = normalizePolygons(movement.walkableAreas, 'movement.walkableAreas');
  const inferredWalkableAreas = extractTemporaryWalkableAreas(
    visualLayersFromRawMap(rawMapData)
      .map((item, index) => {
        const layer = objectValue(item);
        return {
          id: optionalString(layer.id) ?? `visual_${index}`,
          assetId: optionalString(layer.assetId) ?? '',
          x: finiteNumber(layer.x) ?? 0,
          y: finiteNumber(layer.y) ?? 0,
          z: finiteNumber(layer.z) ?? index,
        };
      })
      .filter((layer) => layer.assetId.length > 0),
    coordinateSystem,
  );
  const explicitBlockedAreas = normalizePolygons(movement.blockedAreas, 'movement.blockedAreas');
  const assetBlockedAreas = extractBlockedAreasFromAssets(rawMapData, coordinateSystem);
  const routeGraph = normalizeRouteGraph(movement.routeGraph);

  return {
    coordinateSystem,
    routeGraph,
    walkableAreas:
      walkableAreas.length > 0
        ? walkableAreas
        : inferredWalkableAreas.length > 0
          ? inferredWalkableAreas
          : boundsPolygon
            ? [boundsPolygon]
            : [],
    blockedAreas: [...explicitBlockedAreas, ...assetBlockedAreas],
    walls: normalizeLineSegments(movement.walls, 'movement.walls'),
    doors: normalizePolygons(movement.doors, 'movement.doors'),
    corridors: normalizePolygons(movement.corridors, 'movement.corridors'),
  };
}

function normalizeRouteGraph(value: unknown): MovementRouteGraph {
  const routeGraph = objectValue(value);
  return {
    nodes: arrayValue(routeGraph.nodes)
      .map(normalizeRouteNode)
      .filter((node): node is RouteNode => node !== null),
    edges: arrayValue(routeGraph.edges)
      .map(normalizeRouteEdge)
      .filter((edge): edge is RouteEdge => edge !== null),
  };
}

function normalizeRouteEdge(value: unknown): RouteEdge | null {
  const edge = objectValue(value);
  const fromNode = optionalString(edge.from_node);
  const toNode = optionalString(edge.to_node);
  if (!fromNode || !toNode) {
    return null;
  }
  const edgeId = optionalString(edge.edge_id);
  const id = optionalString(edge.id);

  return {
    ...(edgeId ? { edge_id: edgeId } : {}),
    ...(id ? { id } : {}),
    from_node: fromNode,
    to_node: toNode,
    bidirectional: edge.bidirectional === true,
    weight: finiteNumber(edge.weight) ?? undefined,
    distance_m: finiteNumber(edge.distance_m) ?? undefined,
    enabled: edge.enabled !== false,
  };
}

function normalizeRouteNode(value: unknown, index: number): RouteNode | null {
  const node = objectValue(value);
  const position = normalizePoint(node.position);
  if (!position) {
    if (node.position === undefined || node.position === null) {
      return null;
    }
    throw new Error(`movement.routeGraph.nodes[${index}].position must contain finite x and y coordinates.`);
  }
  return {
    node_id: optionalString(node.node_id) ?? undefined,
    id: optionalString(node.id) ?? undefined,
    position,
  };
}

function requiredPoint(value: unknown, label: string): Point {
  const point = normalizePoint(value);
  if (!point) {
    throw new Error(`${label} must contain finite x and y coordinates.`);
  }
  return point;
}
