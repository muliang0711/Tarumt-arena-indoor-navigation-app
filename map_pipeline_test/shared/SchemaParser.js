import { DEFAULT_PIXELS_PER_METER, DEFAULT_TILE_SIZE } from "./types.js";

export async function loadMapSchema(url = "assets/map.json") {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load map schema from ${url}: ${response.status} ${response.statusText}`);
  }
  return normalizeMapSchema(await response.json());
}

export function normalizeMapSchema(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Map schema must be a JSON object.");
  }

  const map = raw.map || {};
  const tileSize = assertPositiveNumber(map.tileSize ?? DEFAULT_TILE_SIZE, "map.tileSize");
  const width = assertPositiveNumber(map.width, "map.width");
  const height = assertPositiveNumber(map.height, "map.height");
  const assets = normalizeAssets(raw.assets?.items || raw.display?.assets || [], tileSize);
  const visualLayers = normalizeVisualLayers(raw.layers?.visual || raw.display?.visualLayers || []);
  const collision = normalizeCollision(raw.layers?.collision || []);
  const display = normalizeDisplay(raw.display || {}, width, height);
  const pixelsPerMeter = raw.movement?.coordinateSystem?.pixelsPerMeter ?? DEFAULT_PIXELS_PER_METER;

  return {
    schemaVersion: raw.schemaVersion,
    metadata: {
      id: requireString(map.id, "map.id"),
      name: map.name || map.id,
      floor: map.floor,
    },
    tileSize,
    width,
    height,
    worldWidth: width * tileSize,
    worldHeight: height * tileSize,
    resourceRoot: normalizeResourceRoot(raw.assets?.resourceRoot || "resources"),
    assets,
    visualLayers,
    collision,
    display,
    navigation: {
      nodes: Array.isArray(raw.navigation?.nodes) ? raw.navigation.nodes.map(clone) : [],
      links: Array.isArray(raw.navigation?.links) ? raw.navigation.links.map(clone) : [],
    },
    movement: {
      coordinateSystem: {
        ...(raw.movement?.coordinateSystem || {}),
        pixelsPerMeter,
      },
      routeGraph: {
        nodes: Array.isArray(raw.movement?.routeGraph?.nodes) ? raw.movement.routeGraph.nodes.map(clone) : [],
        edges: Array.isArray(raw.movement?.routeGraph?.edges) ? raw.movement.routeGraph.edges.map(clone) : [],
      },
      rooms: Array.isArray(raw.movement?.rooms) ? raw.movement.rooms.map(clone) : [],
      corridors: Array.isArray(raw.movement?.corridors) ? raw.movement.corridors.map(clone) : [],
      walkableAreas: Array.isArray(raw.movement?.walkableAreas) ? raw.movement.walkableAreas.map(clone) : [],
      walls: Array.isArray(raw.movement?.walls) ? raw.movement.walls.map(clone) : [],
      doors: Array.isArray(raw.movement?.doors) ? raw.movement.doors.map(clone) : [],
      entrances: Array.isArray(raw.movement?.entrances) ? raw.movement.entrances.map(clone) : [],
    },
    spawn: raw.spawn ? clone(raw.spawn) : null,
    ambiguities: display.coordinateSpaceSource === "inferred"
      ? ["display label/icon positions are inferred as tile-space because they are integer positions within map bounds"]
      : [],
  };
}

function normalizeAssets(items, tileSize) {
  if (!Array.isArray(items)) {
    throw new Error("assets.items must be an array.");
  }

  return items.map((item, index) => {
    const widthTiles = assertPositiveNumber(item.widthTiles ?? 1, `assets.items[${index}].widthTiles`);
    const heightTiles = assertPositiveNumber(item.heightTiles ?? 1, `assets.items[${index}].heightTiles`);
    return {
      id: requireString(item.id, `assets.items[${index}].id`),
      src: requireString(item.src, `assets.items[${index}].src`),
      widthTiles,
      heightTiles,
      widthPixels: widthTiles * tileSize,
      heightPixels: heightTiles * tileSize,
      blocksMovement: Boolean(item.blocksMovement),
      blockedOffsets: Array.isArray(item.blockedOffsets) ? item.blockedOffsets.map(clone) : [],
    };
  });
}

function normalizeVisualLayers(items) {
  if (!Array.isArray(items)) {
    throw new Error("layers.visual must be an array.");
  }

  return items.map((item, index) => ({
    id: item.id || `${item.assetId || "asset"}_${index}`,
    assetId: requireString(item.assetId, `layers.visual[${index}].assetId`),
    x: assertFiniteNumber(item.x, `layers.visual[${index}].x`),
    y: assertFiniteNumber(item.y, `layers.visual[${index}].y`),
    z: Number.isFinite(item.z) ? item.z : index,
  }));
}

function normalizeCollision(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((item) => ({
    x: Number(item.x),
    y: Number(item.y),
    state: item.state || "blocked",
  })).filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y));
}

function normalizeDisplay(display, width, height) {
  const labels = Array.isArray(display.labels) ? display.labels.map((item, index) => ({
    id: item.id || `label_${index}`,
    text: String(item.text || ""),
    position: normalizePosition(item.position, `display.labels[${index}].position`),
    sourceId: item.sourceId,
  })) : [];
  const icons = Array.isArray(display.icons) ? display.icons.map((item, index) => ({
    id: item.id || `icon_${index}`,
    iconId: item.iconId || "destination",
    position: normalizePosition(item.position, `display.icons[${index}].position`),
    sourceId: item.sourceId,
  })) : [];

  const coordinateSpace = inferDisplayCoordinateSpace([...labels, ...icons], width, height);
  return {
    labels,
    icons,
    layerOrder: Array.isArray(display.layerOrder) ? [...display.layerOrder] : ["visualLayers", "icons", "labels"],
    coordinateSpace: coordinateSpace.space,
    coordinateSpaceSource: coordinateSpace.source,
  };
}

function inferDisplayCoordinateSpace(items, width, height) {
  if (items.length === 0) {
    return { space: "tile", source: "empty" };
  }

  const allIntegerMapPositions = items.every((item) => (
    Number.isInteger(item.position.x)
    && Number.isInteger(item.position.y)
    && item.position.x >= 0
    && item.position.y >= 0
    && item.position.x <= width
    && item.position.y <= height
  ));

  return allIntegerMapPositions
    ? { space: "tile", source: "inferred" }
    : { space: "pixel", source: "inferred" };
}

function normalizePosition(position, label) {
  if (!position || typeof position !== "object") {
    throw new Error(`${label} is required.`);
  }
  return {
    x: assertFiniteNumber(position.x, `${label}.x`),
    y: assertFiniteNumber(position.y, `${label}.y`),
  };
}

function normalizeResourceRoot(root) {
  return String(root).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function assertPositiveNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return number;
}

function assertFiniteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return number;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
