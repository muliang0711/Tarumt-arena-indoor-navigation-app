const TILE_SIZE = 16;
const MIN_MAP_WIDTH = 30;
const MIN_MAP_HEIGHT = 20;
const STORAGE_KEY = "village-map-editor-state-v2";
const PHONE_REVIEW_SNAPSHOT_KEY = "village-phone-review-snapshot-v1";
const SAMPLE_LAYOUT_URL = "/generated_maps/village_map_layout.json";
const ASSET_INDEX_URL = "/assets/index.json";

const SAMPLE_ALIAS_MATCHERS = {
  shop: /shop/i,
  house_pink: /house_pink/i,
  house_stone: /house_stone/i,
  tree: /tree/i,
  hedge: /hedge/i,
  fence_pen: /fence_pen/i,
  grass_patch: /grass_patch/i,
  sign_left: /signboard_left/i,
  sign_right: /signboard_right/i,
  stump: /stump/i,
};

const TILE_STATE_COLORS = {
  blocked: "rgba(219, 92, 92, 0.45)",
  walkable: "rgba(91, 208, 122, 0.4)",
};

const VALID_NODE_TYPES = new Set(["destination", "junction", "stairs", "elevator"]);

const state = {
  activeLayer: "visual",
  autoGrow: true,
  autoBlockFromVisuals: true,
  zoom: 2,
  showGrid: true,
  mapWidth: MIN_MAP_WIDTH,
  mapHeight: MIN_MAP_HEIGHT,
  visualMode: "paint",
  metadataMode: "walkable",
  placements: [],
  metadataTiles: {},
  nodes: [],
  links: [],
  selectedAssetId: null,
  selectedPlacementId: null,
  selectedNodeId: null,
  selectedLinkId: null,
  linkStartNodeId: null,
  hoverTile: null,
  dragPlacementId: null,
  dragOffset: { x: 0, y: 0 },
  metadataPaintActive: false,
  history: [],
};

let assets = [];
const assetMap = new Map();

const canvas = document.querySelector("#map-canvas");
const ctx = canvas.getContext("2d");
const backgroundCacheCanvas = document.createElement("canvas");
const backgroundCacheCtx = backgroundCacheCanvas.getContext("2d");

const renderState = {
  backgroundCacheKey: "",
  frameId: 0,
  pendingCanvas: false,
  pendingUi: false,
  selectedPreviewAssetId: null,
};

const ui = {
  activeLayerButtons: document.querySelectorAll("[data-layer]"),
  applyMapSizeButton: document.querySelector("#apply-map-size-button"),
  autoBlockVisualToggle: document.querySelector("#auto-block-visual-toggle"),
  autoGrowToggle: document.querySelector("#auto-grow-toggle"),
  clearButton: document.querySelector("#clear-button"),
  clearMetadataButton: document.querySelector("#clear-metadata-button"),
  exportJsonButton: document.querySelector("#export-json-button"),
  exportPngButton: document.querySelector("#export-png-button"),
  gridToggle: document.querySelector("#grid-toggle"),
  importInput: document.querySelector("#import-json-input"),
  loadButton: document.querySelector("#load-button"),
  mapHeightInput: document.querySelector("#map-height-input"),
  mapWidthInput: document.querySelector("#map-width-input"),
  metadataPanel: document.querySelector("#metadata-tools-panel"),
  metadataModeButtons: document.querySelectorAll("[data-metadata-mode]"),
  paletteGroups: document.querySelector("#palette-groups"),
  palettePanel: document.querySelector("#palette-panel"),
  reloadAssetsButton: document.querySelector("#reload-assets-button"),
  reviewMapButton: document.querySelector("#review-map-button"),
  sampleButton: document.querySelector("#sample-button"),
  saveButton: document.querySelector("#save-button"),
  selectedMeta: document.querySelector("#selected-meta"),
  selectedPreview: document.querySelector("#selected-preview"),
  selectionMeta: document.querySelector("#selection-meta"),
  statusText: document.querySelector("#status-text"),
  placementsCount: document.querySelector("#placements-count"),
  walkableCount: document.querySelector("#walkable-count"),
  blockedCount: document.querySelector("#blocked-count"),
  nodesCount: document.querySelector("#nodes-count"),
  linksCount: document.querySelector("#links-count"),
  nodeIdInput: document.querySelector("#node-id-input"),
  nodeLabelInput: document.querySelector("#node-label-input"),
  nodeTypeSelect: document.querySelector("#node-type-select"),
  undoButton: document.querySelector("#undo-button"),
  visualModeButtons: document.querySelectorAll("[data-visual-mode]"),
  visualPanel: document.querySelector("#visual-tools-panel"),
  zoomRange: document.querySelector("#zoom-range"),
};

function setTextIfChanged(element, value) {
  if (element.textContent !== value) {
    element.textContent = value;
  }
}

function isSameTile(left, right) {
  return left?.x === right?.x && left?.y === right?.y;
}

function tileKey(x, y) {
  return `${x},${y}`;
}

function sanitizeAnchorId(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeNodeType(value) {
  if (value === "entrance") {
    return "destination";
  }
  return VALID_NODE_TYPES.has(value) ? value : "destination";
}

function nodeTypeLabel(value) {
  const type = normalizeNodeType(value);
  if (type === "junction") {
    return "Junction";
  }
  if (type === "stairs") {
    return "Stairs";
  }
  if (type === "elevator") {
    return "Elevator";
  }
  return "Destination";
}

function assetTileWidth(asset) {
  if (!asset?.image) {
    return 1;
  }
  return Math.max(Math.ceil(asset.image.width / TILE_SIZE), 1);
}

function assetTileHeight(asset) {
  if (!asset?.image) {
    return 1;
  }
  return Math.max(Math.ceil(asset.image.height / TILE_SIZE), 1);
}

function assetBaseId(assetId) {
  return assetId.replace(/^\d+_/, "");
}

function getGrassAssets() {
  return assets.filter((asset) => assetBaseId(asset.id).startsWith("terrain_grass_plain"));
}

function grassVariantAsset(tileX, tileY) {
  const grassAssets = getGrassAssets();
  if (!grassAssets.length) {
    return null;
  }
  const index = (tileX * 19 + tileY * 23 + tileX * tileY) % grassAssets.length;
  return grassAssets[index];
}

function getUnwalkableBackgroundAssets() {
  return assets.filter((asset) => /unwalkable_tile/i.test(assetBaseId(asset.id)));
}

function unwalkableBackgroundVariantAsset(tileX, tileY) {
  const backgroundAssets = getUnwalkableBackgroundAssets();
  if (!backgroundAssets.length) {
    return grassVariantAsset(tileX, tileY);
  }
  const index = (tileX * 17 + tileY * 29 + tileX * tileY) % backgroundAssets.length;
  return backgroundAssets[index];
}

function backgroundAssetSignature() {
  const backgroundAssets = getUnwalkableBackgroundAssets();
  if (backgroundAssets.length) {
    return backgroundAssets.map((asset) => asset.id).join("|");
  }
  return getGrassAssets().map((asset) => asset.id).join("|");
}

function snapshotState() {
  return JSON.stringify({
    autoBlockFromVisuals: state.autoBlockFromVisuals,
    autoGrow: state.autoGrow,
    links: state.links,
    mapHeight: state.mapHeight,
    mapWidth: state.mapWidth,
    metadataTiles: state.metadataTiles,
    nodes: state.nodes,
    placements: state.placements,
    selectedAssetId: state.selectedAssetId,
    showGrid: state.showGrid,
    zoom: state.zoom,
  });
}

function saveHistory() {
  state.history.push(snapshotState());
  if (state.history.length > 80) {
    state.history.shift();
  }
}

function restoreSnapshot(snapshot) {
  const parsed = JSON.parse(snapshot);
  const parsedNodes = Array.isArray(parsed.nodes) ? parsed.nodes : Array.isArray(parsed.anchors) ? parsed.anchors : [];
  state.nodes = parsedNodes
    .filter((node) => typeof node?.id === "string" && typeof node?.x === "number" && typeof node?.y === "number")
    .map((node) => ({
      ...node,
      label: typeof node.label === "string" ? node.label : node.id,
      type: normalizeNodeType(node.type),
    }));
  state.autoBlockFromVisuals =
    typeof parsed.autoBlockFromVisuals === "boolean" ? parsed.autoBlockFromVisuals : true;
  state.autoGrow = typeof parsed.autoGrow === "boolean" ? parsed.autoGrow : true;
  state.links = Array.isArray(parsed.links)
    ? parsed.links.filter((link) => typeof link?.id === "string" && typeof link?.from === "string" && typeof link?.to === "string")
    : [];
  state.mapHeight = typeof parsed.mapHeight === "number" ? Math.max(Math.floor(parsed.mapHeight), MIN_MAP_HEIGHT) : MIN_MAP_HEIGHT;
  state.mapWidth = typeof parsed.mapWidth === "number" ? Math.max(Math.floor(parsed.mapWidth), MIN_MAP_WIDTH) : MIN_MAP_WIDTH;
  state.metadataTiles = parsed.metadataTiles && typeof parsed.metadataTiles === "object" ? parsed.metadataTiles : {};
  state.placements = Array.isArray(parsed.placements) ? parsed.placements : [];
  state.selectedAssetId = typeof parsed.selectedAssetId === "string" ? parsed.selectedAssetId : null;
  state.showGrid = typeof parsed.showGrid === "boolean" ? parsed.showGrid : true;
  state.zoom = typeof parsed.zoom === "number" ? Math.min(Math.max(parsed.zoom, 1), 4) : 2;
  state.selectedPlacementId = null;
  state.selectedNodeId = null;
  state.selectedLinkId = null;
  state.linkStartNodeId = null;
}

function persistLocal() {
  window.localStorage.setItem(STORAGE_KEY, snapshotState());
}

function loadLocalState() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return false;
  }

  try {
    restoreSnapshot(raw);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

function makePlacement(assetId, tileX, tileY) {
  return {
    assetId,
    id: `${assetId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    tileX,
    tileY,
  };
}

function syncInputs() {
  ui.autoBlockVisualToggle.checked = state.autoBlockFromVisuals;
  ui.autoGrowToggle.checked = state.autoGrow;
  ui.gridToggle.checked = state.showGrid;
  ui.mapWidthInput.value = String(state.mapWidth);
  ui.mapHeightInput.value = String(state.mapHeight);
  ui.nodeTypeSelect.value = normalizeNodeType(ui.nodeTypeSelect.value);
  ui.zoomRange.value = String(state.zoom);
}

function fitMapToPlacements() {
  let nextWidth = MIN_MAP_WIDTH;
  let nextHeight = MIN_MAP_HEIGHT;

  for (const placement of state.placements) {
    const asset = getPlacementAsset(placement);
    if (!asset) {
      continue;
    }
    nextWidth = Math.max(nextWidth, placement.tileX + assetTileWidth(asset));
    nextHeight = Math.max(nextHeight, placement.tileY + assetTileHeight(asset));
  }

  for (const node of state.nodes) {
    nextWidth = Math.max(nextWidth, node.x + 1);
    nextHeight = Math.max(nextHeight, node.y + 1);
  }

  for (const key of Object.keys(state.metadataTiles)) {
    const [x, y] = key.split(",").map(Number);
    nextWidth = Math.max(nextWidth, x + 1);
    nextHeight = Math.max(nextHeight, y + 1);
  }

  state.mapWidth = Math.max(nextWidth, state.mapWidth, MIN_MAP_WIDTH);
  state.mapHeight = Math.max(nextHeight, state.mapHeight, MIN_MAP_HEIGHT);
}

function ensureMapFits(tileX, tileY, width, height) {
  state.mapWidth = Math.max(state.mapWidth, tileX + width);
  state.mapHeight = Math.max(state.mapHeight, tileY + height);
}

function getPlacementAsset(placement) {
  return assetMap.get(placement.assetId);
}

function shouldAutoBlockAsset(asset) {
  if (!asset?.id) {
    return false;
  }

  const baseId = assetBaseId(asset.id);
  if (baseId.startsWith("terrain_path_") || baseId.startsWith("terrain_grass_plain")) {
    return false;
  }

  return true;
}

function getAutoBlockedTileKeys() {
  const blocked = new Set();

  if (!state.autoBlockFromVisuals) {
    return blocked;
  }

  for (const placement of state.placements) {
    const asset = getPlacementAsset(placement);
    if (!asset || !shouldAutoBlockAsset(asset)) {
      continue;
    }

    const width = assetTileWidth(asset);
    const height = assetTileHeight(asset);
    for (let y = placement.tileY; y < placement.tileY + height; y += 1) {
      for (let x = placement.tileX; x < placement.tileX + width; x += 1) {
        blocked.add(tileKey(x, y));
      }
    }
  }

  return blocked;
}

function getResolvedMetadataTiles() {
  const resolved = {};
  const autoBlocked = getAutoBlockedTileKeys();

  for (const key of autoBlocked) {
    resolved[key] = "blocked";
  }

  for (const [key, value] of Object.entries(state.metadataTiles)) {
    resolved[key] = value;
  }

  return resolved;
}

function getRenderPlacements() {
  return [...state.placements].sort((left, right) => {
    const leftAsset = getPlacementAsset(left);
    const rightAsset = getPlacementAsset(right);
    const leftDepth = left.tileY + (leftAsset ? assetTileHeight(leftAsset) : 1);
    const rightDepth = right.tileY + (rightAsset ? assetTileHeight(rightAsset) : 1);
    if (leftDepth !== rightDepth) {
      return leftDepth - rightDepth;
    }
    return left.id.localeCompare(right.id);
  });
}

function findNodeById(nodeId) {
  return state.nodes.find((node) => node.id === nodeId) ?? null;
}

function findNodeAt(tileX, tileY) {
  return state.nodes.find((node) => node.x === tileX && node.y === tileY) ?? null;
}

function getTopPlacementAt(tileX, tileY) {
  const placements = getRenderPlacements();
  for (let index = placements.length - 1; index >= 0; index -= 1) {
    const placement = placements[index];
    const asset = getPlacementAsset(placement);
    if (!asset) {
      continue;
    }

    const width = assetTileWidth(asset);
    const height = assetTileHeight(asset);
    if (
      tileX >= placement.tileX &&
      tileX < placement.tileX + width &&
      tileY >= placement.tileY &&
      tileY < placement.tileY + height
    ) {
      return placement;
    }
  }
  return null;
}

function removePlacementById(placementId) {
  const nextPlacements = state.placements.filter((placement) => placement.id !== placementId);
  if (nextPlacements.length === state.placements.length) {
    return;
  }

  saveHistory();
  state.placements = nextPlacements;
  if (state.selectedPlacementId === placementId) {
    state.selectedPlacementId = null;
  }
  persistLocal();
  render();
}

function makeLinkId(from, to) {
  return [from, to].sort().join("__");
}

function linkExists(from, to) {
  const linkId = makeLinkId(from, to);
  return state.links.some((link) => link.id === linkId);
}

function findLinkAt(tileX, tileY) {
  const px = tileX + 0.5;
  const py = tileY + 0.5;
  let best = null;
  let bestDistance = Infinity;

  for (const link of state.links) {
    const fromNode = findNodeById(link.from);
    const toNode = findNodeById(link.to);
    if (!fromNode || !toNode) {
      continue;
    }

    const ax = fromNode.x + 0.5;
    const ay = fromNode.y + 0.5;
    const bx = toNode.x + 0.5;
    const by = toNode.y + 0.5;
    const abx = bx - ax;
    const aby = by - ay;
    const lengthSquared = abx * abx + aby * aby;
    if (!lengthSquared) {
      continue;
    }

    const apx = px - ax;
    const apy = py - ay;
    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / lengthSquared));
    const closestX = ax + abx * t;
    const closestY = ay + aby * t;
    const distance = Math.hypot(px - closestX, py - closestY);
    if (distance < 0.38 && distance < bestDistance) {
      best = link;
      bestDistance = distance;
    }
  }

  return best;
}

function removeNodeById(nodeId) {
  const nextNodes = state.nodes.filter((node) => node.id !== nodeId);
  if (nextNodes.length === state.nodes.length) {
    return;
  }

  saveHistory();
  state.nodes = nextNodes;
  state.links = state.links.filter((link) => link.from !== nodeId && link.to !== nodeId);
  if (state.selectedNodeId === nodeId) {
    state.selectedNodeId = null;
  }
  if (state.linkStartNodeId === nodeId) {
    state.linkStartNodeId = null;
  }
  state.selectedLinkId = null;
  persistLocal();
  render();
}

function removeLinkById(linkId) {
  const nextLinks = state.links.filter((link) => link.id !== linkId);
  if (nextLinks.length === state.links.length) {
    return;
  }

  saveHistory();
  state.links = nextLinks;
  if (state.selectedLinkId === linkId) {
    state.selectedLinkId = null;
  }
  persistLocal();
  render();
}

function applyMetadataBrush(tileX, tileY, mode) {
  const key = tileKey(tileX, tileY);
  if (mode === "erase") {
    delete state.metadataTiles[key];
    return;
  }

  if (mode === "walkable" || mode === "blocked") {
    state.metadataTiles[key] = mode;
  }
}

function createNodeAt(tileX, tileY) {
  const nodeType = normalizeNodeType(ui.nodeTypeSelect.value);
  const label = ui.nodeLabelInput.value.trim() || `${nodeType} ${tileX},${tileY}`;
  const explicitId = sanitizeAnchorId(ui.nodeIdInput.value);
  const baseId = explicitId || sanitizeAnchorId(label) || `${nodeType}`;
  let id = baseId;
  const idTakenByOther = state.nodes.some((node) => node.id === id && !(node.x === tileX && node.y === tileY));
  if (!explicitId && idTakenByOther) {
    id = `${baseId}_${tileX}_${tileY}`;
  }

  const existingNode = state.nodes.find((node) => node.id === id);
  const nextNode = {
    id,
    label,
    type: nodeType,
    x: tileX,
    y: tileY,
  };

  if (existingNode) {
    state.nodes = state.nodes.map((node) => (node.id === id ? nextNode : node));
  } else {
    state.nodes.push(nextNode);
  }

  state.selectedNodeId = id;
  state.selectedPlacementId = null;
  state.selectedLinkId = null;
  ui.nodeTypeSelect.value = nodeType;
  if (explicitId) {
    ui.nodeIdInput.value = id;
  }
}

function createLinkBetween(nodeAId, nodeBId) {
  if (!nodeAId || !nodeBId || nodeAId === nodeBId || linkExists(nodeAId, nodeBId)) {
    return;
  }

  state.links.push({
    id: makeLinkId(nodeAId, nodeBId),
    from: nodeAId,
    to: nodeBId,
  });
}

function handleLinkClick(node) {
  if (!node) {
    state.linkStartNodeId = null;
    state.selectedNodeId = null;
    state.selectedLinkId = null;
    render();
    return;
  }

  if (!state.linkStartNodeId) {
    state.linkStartNodeId = node.id;
    state.selectedNodeId = node.id;
    state.selectedLinkId = null;
    render();
    return;
  }

  if (state.linkStartNodeId === node.id) {
    state.linkStartNodeId = null;
    state.selectedNodeId = node.id;
    state.selectedLinkId = null;
    render();
    return;
  }

  saveHistory();
  createLinkBetween(state.linkStartNodeId, node.id);
  state.linkStartNodeId = node.id;
  state.selectedNodeId = node.id;
  state.selectedLinkId = null;
  persistLocal();
  render();
}

function placeAsset(tileX, tileY) {
  const asset = assetMap.get(state.selectedAssetId);
  if (!asset) {
    return;
  }

  let nextX = Math.max(tileX, 0);
  let nextY = Math.max(tileY, 0);
  const width = assetTileWidth(asset);
  const height = assetTileHeight(asset);

  if (state.autoGrow) {
    ensureMapFits(nextX, nextY, width, height);
  } else {
    nextX = Math.min(nextX, state.mapWidth - width);
    nextY = Math.min(nextY, state.mapHeight - height);
  }

  saveHistory();
  state.placements.push(makePlacement(asset.id, nextX, nextY));
  state.selectedPlacementId = null;
  state.selectedNodeId = null;
  state.selectedLinkId = null;
  persistLocal();
  render();
}

function undo() {
  const snapshot = state.history.pop();
  if (!snapshot) {
    return;
  }

  restoreSnapshot(snapshot);
  persistLocal();
  render();
}

function clearVisualMap() {
  if (!state.placements.length) {
    return;
  }

  saveHistory();
  state.placements = [];
  state.selectedPlacementId = null;
  persistLocal();
  render();
}

function clearMetadata() {
  const hasManualTiles = Object.keys(state.metadataTiles).length > 0;
  const hasNodes = state.nodes.length > 0;
  const hasLinks = state.links.length > 0;
  if (!hasManualTiles && !hasNodes && !hasLinks) {
    return;
  }

  saveHistory();
  state.metadataTiles = {};
  state.nodes = [];
  state.links = [];
  state.selectedNodeId = null;
  state.selectedLinkId = null;
  state.linkStartNodeId = null;
  persistLocal();
  render();
}

function setActiveLayer(layer) {
  state.activeLayer = layer;
  state.selectedPlacementId = null;
  state.selectedNodeId = null;
  state.selectedLinkId = null;
  state.linkStartNodeId = null;
  render();
}

function setVisualMode(mode) {
  state.visualMode = mode;
  render();
}

function setMetadataMode(mode) {
  state.metadataMode = mode;
  if (mode !== "link") {
    state.linkStartNodeId = null;
    state.selectedLinkId = null;
  }
  render();
}

function readPointerTile(event) {
  const rect = canvas.getBoundingClientRect();
  const tileX = Math.floor((event.clientX - rect.left) / (TILE_SIZE * state.zoom));
  const tileY = Math.floor((event.clientY - rect.top) / (TILE_SIZE * state.zoom));
  if (tileX < 0 || tileY < 0 || tileX >= state.mapWidth || tileY >= state.mapHeight) {
    return null;
  }
  return { x: tileX, y: tileY };
}

function handleMetadataPointerDown(event, tile) {
  const node = findNodeAt(tile.x, tile.y);
  const link = findLinkAt(tile.x, tile.y);
  const key = tileKey(tile.x, tile.y);
  if (event.button === 2) {
    if (node) {
      removeNodeById(node.id);
      return;
    }

    if (link) {
      removeLinkById(link.id);
      return;
    }

    if (state.metadataTiles[key]) {
      saveHistory();
      delete state.metadataTiles[key];
      persistLocal();
      render();
    }
    return;
  }

  if (state.metadataMode === "link") {
    if (!node && link) {
      state.selectedLinkId = link.id;
      state.selectedNodeId = null;
      state.linkStartNodeId = null;
      render();
      return;
    }
    handleLinkClick(node);
    return;
  }

  if (state.metadataMode === "erase") {
    if (!node && !link && !state.metadataTiles[key]) {
      return;
    }

    saveHistory();
    if (node) {
      state.nodes = state.nodes.filter((item) => item.id !== node.id);
      state.links = state.links.filter((item) => item.from !== node.id && item.to !== node.id);
      if (state.selectedNodeId === node.id) {
        state.selectedNodeId = null;
      }
      if (state.linkStartNodeId === node.id) {
        state.linkStartNodeId = null;
      }
    } else if (link) {
      state.links = state.links.filter((item) => item.id !== link.id);
      if (state.selectedLinkId === link.id) {
        state.selectedLinkId = null;
      }
    } else {
      delete state.metadataTiles[key];
    }
    persistLocal();
    render();
    return;
  }

  saveHistory();
  if (state.metadataMode === "node") {
    createNodeAt(tile.x, tile.y);
    persistLocal();
    render();
    return;
  }

  state.metadataPaintActive = true;
  applyMetadataBrush(tile.x, tile.y, state.metadataMode);
  persistLocal();
  render();
}

function handleVisualPointerDown(event, tile) {
  if (event.button === 2) {
    const placement = getTopPlacementAt(tile.x, tile.y);
    if (placement) {
      removePlacementById(placement.id);
    }
    return;
  }

  if (state.visualMode === "paint") {
    placeAsset(tile.x, tile.y);
    return;
  }

  if (state.visualMode === "erase") {
    const placement = getTopPlacementAt(tile.x, tile.y);
    if (placement) {
      removePlacementById(placement.id);
    }
    return;
  }

  const placement = getTopPlacementAt(tile.x, tile.y);
  if (!placement) {
    state.selectedPlacementId = null;
    render();
    return;
  }

  state.selectedPlacementId = placement.id;
  state.selectedNodeId = null;
  state.selectedLinkId = null;
  state.dragPlacementId = placement.id;
  state.dragOffset = { x: tile.x - placement.tileX, y: tile.y - placement.tileY };
  render();
}

// SECTION: editing
function drawBackgroundTerrain(targetCtx, scale) {
  for (let tileY = 0; tileY < state.mapHeight; tileY += 1) {
    for (let tileX = 0; tileX < state.mapWidth; tileX += 1) {
      const asset = unwalkableBackgroundVariantAsset(tileX, tileY);
      if (!asset?.image) {
        targetCtx.fillStyle = "#6b6251";
        targetCtx.fillRect(
          tileX * TILE_SIZE * scale,
          tileY * TILE_SIZE * scale,
          TILE_SIZE * scale,
          TILE_SIZE * scale,
        );
        continue;
      }

      targetCtx.drawImage(
        asset.image,
        tileX * TILE_SIZE * scale,
        tileY * TILE_SIZE * scale,
        TILE_SIZE * scale,
        TILE_SIZE * scale,
      );
    }
  }
}

function ensureBackgroundCache(scale) {
  const width = state.mapWidth * TILE_SIZE * scale;
  const height = state.mapHeight * TILE_SIZE * scale;
  const cacheKey = `${width}x${height}@${scale}:${backgroundAssetSignature()}`;
  if (renderState.backgroundCacheKey === cacheKey) {
    return;
  }

  backgroundCacheCanvas.width = width;
  backgroundCacheCanvas.height = height;
  backgroundCacheCtx.imageSmoothingEnabled = false;
  drawBackgroundTerrain(backgroundCacheCtx, scale);
  renderState.backgroundCacheKey = cacheKey;
}

function drawGrid(targetCtx, scale) {
  targetCtx.save();
  targetCtx.strokeStyle = "rgba(10, 22, 18, 0.24)";
  targetCtx.lineWidth = 1;

  for (let x = 0; x <= state.mapWidth; x += 1) {
    const pixelX = x * TILE_SIZE * scale + 0.5;
    targetCtx.beginPath();
    targetCtx.moveTo(pixelX, 0);
    targetCtx.lineTo(pixelX, state.mapHeight * TILE_SIZE * scale);
    targetCtx.stroke();
  }

  for (let y = 0; y <= state.mapHeight; y += 1) {
    const pixelY = y * TILE_SIZE * scale + 0.5;
    targetCtx.beginPath();
    targetCtx.moveTo(0, pixelY);
    targetCtx.lineTo(state.mapWidth * TILE_SIZE * scale, pixelY);
    targetCtx.stroke();
  }

  targetCtx.restore();
}

function drawPlacements(targetCtx, scale) {
  for (const placement of getRenderPlacements()) {
    const asset = getPlacementAsset(placement);
    if (!asset?.image) {
      continue;
    }

    targetCtx.drawImage(
      asset.image,
      placement.tileX * TILE_SIZE * scale,
      placement.tileY * TILE_SIZE * scale,
      asset.image.width * scale,
      asset.image.height * scale,
    );
  }
}

function drawVisualPreview(targetCtx, scale) {
  if (state.activeLayer !== "visual" || state.visualMode !== "paint" || !state.hoverTile) {
    return;
  }

  const asset = assetMap.get(state.selectedAssetId);
  if (!asset?.image) {
    return;
  }

  targetCtx.save();
  targetCtx.globalAlpha = 0.45;
  targetCtx.drawImage(
    asset.image,
    state.hoverTile.x * TILE_SIZE * scale,
    state.hoverTile.y * TILE_SIZE * scale,
    asset.image.width * scale,
    asset.image.height * scale,
  );
  targetCtx.restore();
}

function drawMetadataTiles(targetCtx, scale) {
  const resolvedTiles = getResolvedMetadataTiles();

  for (const [key, kind] of Object.entries(resolvedTiles)) {
    const [x, y] = key.split(",").map(Number);
    targetCtx.fillStyle = TILE_STATE_COLORS[kind] ?? "rgba(255,255,255,0.2)";
    targetCtx.fillRect(
      x * TILE_SIZE * scale,
      y * TILE_SIZE * scale,
      TILE_SIZE * scale,
      TILE_SIZE * scale,
    );
  }

  if (state.activeLayer === "metadata" && state.hoverTile && (state.metadataMode === "walkable" || state.metadataMode === "blocked")) {
    targetCtx.save();
    targetCtx.fillStyle = TILE_STATE_COLORS[state.metadataMode];
    targetCtx.fillRect(
      state.hoverTile.x * TILE_SIZE * scale,
      state.hoverTile.y * TILE_SIZE * scale,
      TILE_SIZE * scale,
      TILE_SIZE * scale,
    );
    targetCtx.restore();
  }
}

function drawLinks(targetCtx, scale) {
  for (const link of state.links) {
    const fromNode = findNodeById(link.from);
    const toNode = findNodeById(link.to);
    if (!fromNode || !toNode) {
      continue;
    }

    const isSelected = link.id === state.selectedLinkId;
    targetCtx.save();
    targetCtx.strokeStyle = isSelected ? "#ffd666" : "rgba(121, 195, 255, 0.78)";
    targetCtx.lineWidth = isSelected ? 4 : 3;
    targetCtx.lineCap = "round";
    targetCtx.beginPath();
    targetCtx.moveTo(
      fromNode.x * TILE_SIZE * scale + TILE_SIZE * scale / 2,
      fromNode.y * TILE_SIZE * scale + TILE_SIZE * scale / 2,
    );
    targetCtx.lineTo(
      toNode.x * TILE_SIZE * scale + TILE_SIZE * scale / 2,
      toNode.y * TILE_SIZE * scale + TILE_SIZE * scale / 2,
    );
    targetCtx.stroke();
    targetCtx.restore();
  }

  if (state.activeLayer === "metadata" && state.metadataMode === "link" && state.linkStartNodeId && state.hoverTile) {
    const fromNode = findNodeById(state.linkStartNodeId);
    if (!fromNode) {
      return;
    }

    targetCtx.save();
    targetCtx.strokeStyle = "rgba(255, 214, 102, 0.7)";
    targetCtx.lineWidth = 2;
    targetCtx.setLineDash([8, 6]);
    targetCtx.beginPath();
    targetCtx.moveTo(
      fromNode.x * TILE_SIZE * scale + TILE_SIZE * scale / 2,
      fromNode.y * TILE_SIZE * scale + TILE_SIZE * scale / 2,
    );
    targetCtx.lineTo(
      state.hoverTile.x * TILE_SIZE * scale + TILE_SIZE * scale / 2,
      state.hoverTile.y * TILE_SIZE * scale + TILE_SIZE * scale / 2,
    );
    targetCtx.stroke();
    targetCtx.restore();
  }
}

function drawNodes(targetCtx, scale) {
  for (const node of state.nodes) {
    const pixelX = node.x * TILE_SIZE * scale + TILE_SIZE * scale / 2;
    const pixelY = node.y * TILE_SIZE * scale + TILE_SIZE * scale / 2;
    const isSelected = node.id === state.selectedNodeId;
    const isLinkStart = node.id === state.linkStartNodeId;

    targetCtx.save();
    targetCtx.fillStyle = "rgba(8, 12, 20, 0.55)";
    targetCtx.beginPath();
    targetCtx.arc(pixelX, pixelY, 7 * scale / 2, 0, Math.PI * 2);
    targetCtx.fill();

    targetCtx.fillStyle = "rgba(74, 180, 255, 0.95)";
    targetCtx.beginPath();
    targetCtx.arc(pixelX, pixelY, 5 * scale / 2, 0, Math.PI * 2);
    targetCtx.fill();

    if (isSelected || isLinkStart) {
      targetCtx.strokeStyle = isLinkStart ? "#ffd666" : "#eaf5ff";
      targetCtx.lineWidth = isLinkStart ? 3 : 2;
      targetCtx.beginPath();
      targetCtx.arc(pixelX, pixelY, 8 * scale / 2, 0, Math.PI * 2);
      targetCtx.stroke();
    }

    targetCtx.fillStyle = "#eef7ef";
    targetCtx.font = `${Math.max(10, 10 * scale)}px "Trebuchet MS", Verdana, sans-serif`;
    targetCtx.textAlign = "left";
    targetCtx.textBaseline = "bottom";
    targetCtx.fillText(node.label, pixelX + 8, pixelY - 6);
    targetCtx.restore();
  }

  if (state.activeLayer === "metadata" && state.metadataMode === "node" && state.hoverTile) {
    const pixelX = state.hoverTile.x * TILE_SIZE * scale + TILE_SIZE * scale / 2;
    const pixelY = state.hoverTile.y * TILE_SIZE * scale + TILE_SIZE * scale / 2;
    targetCtx.save();
    targetCtx.globalAlpha = 0.55;
    targetCtx.fillStyle = "rgba(74, 180, 255, 0.95)";
    targetCtx.beginPath();
    targetCtx.arc(pixelX, pixelY, 5 * scale / 2, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.restore();
  }
}

function drawSelections(targetCtx, scale) {
  if (state.selectedPlacementId) {
    const placement = state.placements.find((item) => item.id === state.selectedPlacementId);
    const asset = placement ? getPlacementAsset(placement) : null;
    if (placement && asset) {
      targetCtx.save();
      targetCtx.strokeStyle = "#ffd666";
      targetCtx.lineWidth = 2;
      targetCtx.strokeRect(
        placement.tileX * TILE_SIZE * scale + 1,
        placement.tileY * TILE_SIZE * scale + 1,
        asset.image.width * scale - 2,
        asset.image.height * scale - 2,
      );
      targetCtx.restore();
    }
  }
}

function renderMap(targetCtx, scale, includeGrid) {
  const width = state.mapWidth * TILE_SIZE * scale;
  const height = state.mapHeight * TILE_SIZE * scale;
  targetCtx.clearRect(0, 0, width, height);
  targetCtx.imageSmoothingEnabled = false;

  ensureBackgroundCache(scale);
  targetCtx.drawImage(backgroundCacheCanvas, 0, 0);
  drawPlacements(targetCtx, scale);
  drawVisualPreview(targetCtx, scale);
  drawMetadataTiles(targetCtx, scale);
  drawLinks(targetCtx, scale);
  drawNodes(targetCtx, scale);
  drawSelections(targetCtx, scale);

  if (includeGrid && state.showGrid) {
    drawGrid(targetCtx, scale);
  }
}

function updateSelectedPreview() {
  const asset = assetMap.get(state.selectedAssetId);
  const assetId = asset?.id ?? null;
  if (renderState.selectedPreviewAssetId === assetId) {
    return;
  }

  renderState.selectedPreviewAssetId = assetId;
  ui.selectedPreview.replaceChildren();
  if (!asset) {
    setTextIfChanged(ui.selectedMeta, "No visual asset selected.");
    return;
  }

  const image = document.createElement("img");
  image.src = asset.src;
  image.alt = asset.label;
  image.width = asset.image.width * 2;
  image.height = asset.image.height * 2;
  ui.selectedPreview.replaceChildren(image);

  setTextIfChanged(
    ui.selectedMeta,
    `Name: ${asset.id}\nCategory: ${asset.category}\nSize: ${asset.image.width}x${asset.image.height}px\nFootprint: ${assetTileWidth(asset)}x${assetTileHeight(asset)} tiles`,
  );
}

function updateSelectionMeta() {
  if (state.activeLayer === "visual" && state.selectedPlacementId) {
    const placement = state.placements.find((item) => item.id === state.selectedPlacementId);
    const asset = placement ? getPlacementAsset(placement) : null;
    if (placement && asset) {
      setTextIfChanged(
        ui.selectionMeta,
        `Visual placement\nAsset: ${asset.id}\nTile: ${placement.tileX}, ${placement.tileY}\nFootprint: ${assetTileWidth(asset)}x${assetTileHeight(asset)} tiles`,
      );
      return;
    }
  }

  if (state.selectedNodeId) {
    const node = state.nodes.find((item) => item.id === state.selectedNodeId);
    if (node) {
      setTextIfChanged(
        ui.selectionMeta,
        `Metadata node\nId: ${node.id}\nLabel: ${node.label}\nType: ${nodeTypeLabel(node.type)}\nTile: ${node.x}, ${node.y}`,
      );
      return;
    }
  }

  if (state.selectedLinkId) {
    const link = state.links.find((item) => item.id === state.selectedLinkId);
    if (link) {
      setTextIfChanged(ui.selectionMeta, `Waypoint link\nFrom: ${link.from}\nTo: ${link.to}\nId: ${link.id}`);
      return;
    }
  }

  if (state.activeLayer === "metadata" && state.hoverTile) {
    const key = tileKey(state.hoverTile.x, state.hoverTile.y);
    const tileState = getResolvedMetadataTiles()[key] ?? "unassigned";
    const autoBlocked = getAutoBlockedTileKeys().has(key);
    const hoveredNode = findNodeAt(state.hoverTile.x, state.hoverTile.y);
    const hoveredLink = findLinkAt(state.hoverTile.x, state.hoverTile.y);
    setTextIfChanged(
      ui.selectionMeta,
      `Metadata tile\nTile: ${state.hoverTile.x}, ${state.hoverTile.y}\nState: ${tileState}\nSource: ${state.metadataTiles[key] ? "manual" : autoBlocked ? "auto-blocked-from-visual" : "none"}\nNode: ${hoveredNode?.id ?? "none"}\nLink: ${hoveredLink?.id ?? "none"}`,
    );
    return;
  }

  setTextIfChanged(ui.selectionMeta, "Nothing selected.");
}

function updateToolPanels() {
  const isVisual = state.activeLayer === "visual";
  ui.visualPanel.style.display = isVisual ? "block" : "none";
  ui.palettePanel.style.display = isVisual ? "block" : "none";
  ui.metadataPanel.style.display = isVisual ? "none" : "block";

  ui.activeLayerButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.layer === state.activeLayer);
  });

  ui.visualModeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.visualMode === state.visualMode);
  });

  ui.metadataModeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.metadataMode === state.metadataMode);
  });
}

function updateStatus() {
  const resolvedTiles = getResolvedMetadataTiles();
  const blockedCount = Object.values(resolvedTiles).filter((value) => value === "blocked").length;
  const walkableCount = Object.values(resolvedTiles).filter((value) => value === "walkable").length;
  const parts = [
    `Layer: ${state.activeLayer}`,
    state.activeLayer === "visual" ? `Tool: ${state.visualMode}` : `Tool: ${state.metadataMode}`,
    `Map: ${state.mapWidth}x${state.mapHeight}`,
    `Visual placements: ${state.placements.length}`,
    `Walkable: ${walkableCount}`,
    `Blocked: ${blockedCount}`,
    `Nodes: ${state.nodes.length}`,
    `Links: ${state.links.length}`,
    `Auto block: ${state.autoBlockFromVisuals ? "on" : "off"}`,
    state.linkStartNodeId ? `Link from: ${state.linkStartNodeId}` : null,
    state.hoverTile ? `Hover: ${state.hoverTile.x}, ${state.hoverTile.y}` : null,
  ].filter(Boolean);
  setTextIfChanged(ui.statusText, parts.join(" | "));
  setTextIfChanged(ui.placementsCount, String(state.placements.length));
  setTextIfChanged(ui.walkableCount, String(walkableCount));
  setTextIfChanged(ui.blockedCount, String(blockedCount));
  setTextIfChanged(ui.nodesCount, String(state.nodes.length));
  setTextIfChanged(ui.linksCount, String(state.links.length));
}

function renderCanvas() {
  const width = state.mapWidth * TILE_SIZE * state.zoom;
  const height = state.mapHeight * TILE_SIZE * state.zoom;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  renderMap(ctx, state.zoom, true);
}

function renderUi() {
  syncInputs();
  updateToolPanels();
  updateSelectedPreview();
  updateSelectionMeta();
  updateStatus();
}

function flushRender() {
  renderState.frameId = 0;
  const shouldRenderCanvas = renderState.pendingCanvas;
  const shouldRenderUi = renderState.pendingUi;
  renderState.pendingCanvas = false;
  renderState.pendingUi = false;

  if (shouldRenderCanvas) {
    renderCanvas();
  }

  if (shouldRenderUi) {
    renderUi();
  }
}

function render(options = {}) {
  const { canvas: shouldRenderCanvas = true, ui: shouldRenderUi = true } = options;
  renderState.pendingCanvas = renderState.pendingCanvas || shouldRenderCanvas;
  renderState.pendingUi = renderState.pendingUi || shouldRenderUi;

  if (renderState.frameId) {
    return;
  }

  renderState.frameId = window.requestAnimationFrame(flushRender);
}

function buildPalette() {
  const grouped = new Map();
  for (const asset of assets) {
    if (!grouped.has(asset.category)) {
      grouped.set(asset.category, []);
    }
    grouped.get(asset.category).push(asset);
  }

  ui.paletteGroups.innerHTML = "";

  for (const [category, entries] of grouped.entries()) {
    const group = document.createElement("section");
    group.className = "palette-group";

    const title = document.createElement("p");
    title.className = "palette-title";
    title.textContent = category;
    group.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "palette-grid";

    for (const asset of entries) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "palette-item";
      button.classList.toggle("is-active", asset.id === state.selectedAssetId);

      const image = document.createElement("img");
      image.src = asset.src;
      image.alt = asset.label;
      image.width = Math.max(asset.image.width * 2, 32);
      image.height = Math.max(asset.image.height * 2, 32);

      const label = document.createElement("span");
      label.className = "tile-label";
      label.textContent = asset.label;

      button.append(image, label);
      button.addEventListener("click", () => {
        state.selectedAssetId = asset.id;
        persistLocal();
        buildPalette();
        render();
      });

      grid.appendChild(button);
    }

    group.appendChild(grid);
    ui.paletteGroups.appendChild(group);
  }
}

// SECTION: rendering
function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportJson() {
  const metadataTiles = Object.entries(state.metadataTiles).map(([key, kind]) => {
    const [x, y] = key.split(",").map(Number);
    return { x, y, kind };
  });
  const resolvedTiles = Object.entries(getResolvedMetadataTiles()).map(([key, kind]) => {
    const [x, y] = key.split(",").map(Number);
    return { x, y, kind };
  });

  downloadBlob(
    new Blob(
      [
        JSON.stringify(
          {
            tileSize: TILE_SIZE,
            mapWidth: state.mapWidth,
            mapHeight: state.mapHeight,
            autoGrow: state.autoGrow,
            visual: {
              placements: state.placements,
            },
            metadata: {
              autoBlockFromVisuals: state.autoBlockFromVisuals,
              resolvedTiles,
              tiles: metadataTiles,
      nodes: state.nodes,
      links: state.links,
    },
  },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
    "village-map-project.json",
  );
}

function exportPng() {
  const exportCanvas = createExportCanvas();
  exportCanvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, "village-map-export.png");
    }
  });
}

function createExportCanvas() {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = state.mapWidth * TILE_SIZE * 2;
  exportCanvas.height = state.mapHeight * TILE_SIZE * 2;
  const exportContext = exportCanvas.getContext("2d");
  renderMap(exportContext, 2, false);
  return exportCanvas;
}

function reviewCurrentMapOnPhone() {
  const exportCanvas = createExportCanvas();
  try {
    window.localStorage.setItem(
      PHONE_REVIEW_SNAPSHOT_KEY,
      JSON.stringify({
        createdAt: new Date().toISOString(),
        fileName: "village-map-review.png",
        height: exportCanvas.height,
        kind: "map",
        label: "Current Map Snapshot",
        src: exportCanvas.toDataURL("image/png"),
        width: exportCanvas.width,
      }),
    );
    window.open("./phone_preview.html?source=map", "_blank", "noopener");
  } catch (error) {
    console.error(error);
    alert("Unable to send the current map to the phone reviewer. Export PNG and upload it in the reviewer instead.");
  }
}

function loadImportedLayout(parsed) {
  saveHistory();

  const visualPlacements = Array.isArray(parsed.visual?.placements)
    ? parsed.visual.placements
    : Array.isArray(parsed.placements)
      ? parsed.placements
      : [];

  const metadataTiles = Array.isArray(parsed.metadata?.tiles)
    ? parsed.metadata.tiles
    : Array.isArray(parsed.metadataTiles)
      ? parsed.metadataTiles
      : [];

  const nodes = Array.isArray(parsed.metadata?.nodes)
    ? parsed.metadata.nodes
    : Array.isArray(parsed.metadata?.anchors)
      ? parsed.metadata.anchors
    : Array.isArray(parsed.anchors)
        ? parsed.anchors
        : [];
  const links = Array.isArray(parsed.metadata?.links)
    ? parsed.metadata.links
    : Array.isArray(parsed.links)
      ? parsed.links
      : [];

  state.autoGrow = typeof parsed.autoGrow === "boolean" ? parsed.autoGrow : state.autoGrow;
  state.autoBlockFromVisuals =
    typeof parsed.metadata?.autoBlockFromVisuals === "boolean"
      ? parsed.metadata.autoBlockFromVisuals
      : typeof parsed.autoBlockFromVisuals === "boolean"
        ? parsed.autoBlockFromVisuals
        : state.autoBlockFromVisuals;
  state.mapWidth = typeof parsed.mapWidth === "number" ? Math.max(Math.floor(parsed.mapWidth), MIN_MAP_WIDTH) : MIN_MAP_WIDTH;
  state.mapHeight = typeof parsed.mapHeight === "number" ? Math.max(Math.floor(parsed.mapHeight), MIN_MAP_HEIGHT) : MIN_MAP_HEIGHT;
  state.placements = visualPlacements.filter((placement) => assetMap.has(placement.assetId));
  state.metadataTiles = {};
  for (const tile of metadataTiles) {
    if (typeof tile?.x === "number" && typeof tile?.y === "number" && typeof tile?.kind === "string") {
      state.metadataTiles[tileKey(tile.x, tile.y)] = tile.kind;
    }
  }
  state.nodes = nodes.filter(
    (node) =>
      typeof node?.id === "string" &&
      typeof node?.label === "string" &&
      typeof node?.type === "string" &&
      typeof node?.x === "number" &&
      typeof node?.y === "number",
  ).map((node) => ({
    ...node,
    type: normalizeNodeType(node.type),
  }));
  state.links = links.filter(
    (link) =>
      typeof link?.id === "string" &&
      typeof link?.from === "string" &&
      typeof link?.to === "string",
  );
  fitMapToPlacements();
  state.selectedPlacementId = null;
  state.selectedNodeId = null;
  state.selectedLinkId = null;
  state.linkStartNodeId = null;
  persistLocal();
  render();
}

function resolveSampleAssetId(alias) {
  const matcher = SAMPLE_ALIAS_MATCHERS[alias];
  if (!matcher) {
    return null;
  }

  const matchedAsset = assets.find((asset) => matcher.test(assetBaseId(asset.id)));
  return matchedAsset?.id ?? null;
}

async function loadSampleLayout() {
  const response = await fetch(SAMPLE_LAYOUT_URL);
  if (!response.ok) {
    throw new Error("Sample layout not found.");
  }

  const parsed = await response.json();
  const placements = Array.isArray(parsed.placements)
    ? parsed.placements
        .map((placement) => {
          const assetId = resolveSampleAssetId(placement.asset);
          if (!assetId) {
            return null;
          }
          return makePlacement(assetId, placement.tile_x, placement.tile_y);
        })
        .filter(Boolean)
    : [];

  saveHistory();
  state.placements = placements;
  state.metadataTiles = {};
  state.nodes = [];
  state.links = [];
  state.mapWidth = MIN_MAP_WIDTH;
  state.mapHeight = MIN_MAP_HEIGHT;
  fitMapToPlacements();
  state.selectedPlacementId = null;
  state.selectedNodeId = null;
  state.selectedLinkId = null;
  state.linkStartNodeId = null;
  persistLocal();
  render();
}

// SECTION: import_export
canvas.addEventListener("mousemove", (event) => {
  const tile = readPointerTile(event);
  const hoverChanged = !isSameTile(state.hoverTile, tile);
  state.hoverTile = tile;

  if (state.activeLayer === "visual" && state.dragPlacementId && tile) {
    const placement = state.placements.find((item) => item.id === state.dragPlacementId);
    const asset = placement ? getPlacementAsset(placement) : null;
    if (placement && asset) {
      const nextX = Math.max(tile.x - state.dragOffset.x, 0);
      const nextY = Math.max(tile.y - state.dragOffset.y, 0);
      let moved = false;
      if (state.autoGrow) {
        if (placement.tileX !== nextX || placement.tileY !== nextY) {
          placement.tileX = nextX;
          placement.tileY = nextY;
          ensureMapFits(nextX, nextY, assetTileWidth(asset), assetTileHeight(asset));
          moved = true;
        }
      } else {
        const boundedX = Math.min(nextX, state.mapWidth - assetTileWidth(asset));
        const boundedY = Math.min(nextY, state.mapHeight - assetTileHeight(asset));
        if (placement.tileX !== boundedX || placement.tileY !== boundedY) {
          placement.tileX = boundedX;
          placement.tileY = boundedY;
          moved = true;
        }
      }
      if (moved || hoverChanged) {
        render({ canvas: true, ui: false });
      }
      return;
    }
  }

  if (state.activeLayer === "metadata" && state.metadataPaintActive && tile) {
    if (!hoverChanged) {
      return;
    }
    applyMetadataBrush(tile.x, tile.y, state.metadataMode);
    render({ canvas: true, ui: true });
    return;
  }

  if (hoverChanged) {
    render({ canvas: true, ui: state.activeLayer === "metadata" });
  }
});

canvas.addEventListener("mouseleave", () => {
  if (!state.hoverTile && !state.metadataPaintActive) {
    return;
  }
  state.hoverTile = null;
  state.metadataPaintActive = false;
  render({ canvas: true, ui: state.activeLayer === "metadata" });
});

canvas.addEventListener("mousedown", (event) => {
  const tile = readPointerTile(event);
  if (!tile) {
    return;
  }

  if (state.activeLayer === "metadata") {
    handleMetadataPointerDown(event, tile);
    return;
  }

  handleVisualPointerDown(event, tile);
});

window.addEventListener("mouseup", () => {
  const wasDragging = Boolean(state.dragPlacementId);
  const wasPaintingMetadata = Boolean(state.metadataPaintActive);
  if (wasDragging || wasPaintingMetadata) {
    persistLocal();
  }

  state.dragPlacementId = null;
  state.metadataPaintActive = false;

  if (wasDragging || wasPaintingMetadata) {
    render({ canvas: true, ui: true });
  }
});

canvas.addEventListener("contextmenu", (event) => event.preventDefault());

window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo();
    return;
  }

  if ((event.key === "Delete" || event.key === "Backspace") && state.activeLayer === "visual" && state.selectedPlacementId) {
    event.preventDefault();
    removePlacementById(state.selectedPlacementId);
    return;
  }

  if ((event.key === "Delete" || event.key === "Backspace") && state.activeLayer === "metadata" && state.selectedNodeId) {
    event.preventDefault();
    removeNodeById(state.selectedNodeId);
    return;
  }

  if ((event.key === "Delete" || event.key === "Backspace") && state.activeLayer === "metadata" && state.selectedLinkId) {
    event.preventDefault();
    removeLinkById(state.selectedLinkId);
  }
});

ui.activeLayerButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveLayer(button.dataset.layer));
});

ui.visualModeButtons.forEach((button) => {
  button.addEventListener("click", () => setVisualMode(button.dataset.visualMode));
});

ui.metadataModeButtons.forEach((button) => {
  button.addEventListener("click", () => setMetadataMode(button.dataset.metadataMode));
});

ui.zoomRange.addEventListener("input", () => {
  state.zoom = Number(ui.zoomRange.value);
  persistLocal();
  render();
});

ui.applyMapSizeButton.addEventListener("click", () => {
  saveHistory();
  state.mapWidth = Math.max(Number(ui.mapWidthInput.value) || MIN_MAP_WIDTH, MIN_MAP_WIDTH);
  state.mapHeight = Math.max(Number(ui.mapHeightInput.value) || MIN_MAP_HEIGHT, MIN_MAP_HEIGHT);
  fitMapToPlacements();
  persistLocal();
  render();
});

ui.gridToggle.addEventListener("change", () => {
  state.showGrid = ui.gridToggle.checked;
  persistLocal();
  render();
});

ui.autoGrowToggle.addEventListener("change", () => {
  state.autoGrow = ui.autoGrowToggle.checked;
  persistLocal();
  render();
});

ui.autoBlockVisualToggle.addEventListener("change", () => {
  state.autoBlockFromVisuals = ui.autoBlockVisualToggle.checked;
  persistLocal();
  render();
});

ui.undoButton.addEventListener("click", undo);
ui.clearButton.addEventListener("click", clearVisualMap);
ui.clearMetadataButton.addEventListener("click", clearMetadata);
ui.saveButton.addEventListener("click", () => {
  persistLocal();
  render();
});
ui.loadButton.addEventListener("click", () => {
  if (loadLocalState()) {
    if (!state.selectedAssetId || !assetMap.has(state.selectedAssetId)) {
      state.selectedAssetId = assets[0]?.id ?? null;
    }
    fitMapToPlacements();
    buildPalette();
    render();
  }
});
ui.reloadAssetsButton.addEventListener("click", async () => {
  try {
    await reloadAssets();
  } catch (error) {
    alert(error instanceof Error ? error.message : "Unable to reload assets.");
  }
});
ui.reviewMapButton.addEventListener("click", reviewCurrentMapOnPhone);
ui.sampleButton.addEventListener("click", async () => {
  try {
    await loadSampleLayout();
  } catch (error) {
    alert(error instanceof Error ? error.message : "Unable to load sample layout.");
  }
});
ui.exportJsonButton.addEventListener("click", exportJson);
ui.exportPngButton.addEventListener("click", exportPng);

ui.importInput.addEventListener("change", async () => {
  const [file] = ui.importInput.files || [];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    loadImportedLayout(JSON.parse(text));
  } catch (error) {
    alert(error instanceof Error ? error.message : "Unable to import layout.");
  } finally {
    ui.importInput.value = "";
  }
});

ui.nodeLabelInput.addEventListener("input", () => {
  if (!ui.nodeIdInput.value.trim()) {
    ui.nodeIdInput.value = sanitizeAnchorId(ui.nodeLabelInput.value);
  }
});

// SECTION: events
async function fetchAssetManifest() {
  const response = await fetch(ASSET_INDEX_URL);
  if (!response.ok) {
    throw new Error("Unable to load asset manifest.");
  }
  return response.json();
}

async function loadAssets() {
  const manifest = await fetchAssetManifest();
  assetMap.clear();
  renderState.backgroundCacheKey = "";
  renderState.selectedPreviewAssetId = null;

  const results = await Promise.allSettled(
    manifest.map(
      (asset) =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => {
            asset.image = image;
            assetMap.set(asset.id, asset);
            resolve(asset);
          };
          image.onerror = () => reject(new Error(`Unable to load ${asset.src}`));
          image.src = asset.src;
        }),
    ),
  );

  assets = manifest.filter((asset) => asset.image);

  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length) {
    console.warn(
      "Skipped assets that failed to load:",
      failed.map((result) => result.reason?.message ?? result.reason),
    );
  }
}

async function reloadAssets() {
  await loadAssets();
  state.placements = state.placements.filter((placement) => assetMap.has(placement.assetId));
  if (!state.selectedAssetId || !assetMap.has(state.selectedAssetId)) {
    state.selectedAssetId = assets[0]?.id ?? null;
  }
  fitMapToPlacements();
  buildPalette();
  persistLocal();
  render();
}

async function init() {
  try {
    await loadAssets();
    loadLocalState();
    if (!state.selectedAssetId || !assetMap.has(state.selectedAssetId)) {
      state.selectedAssetId = assets[0]?.id ?? null;
    }
    fitMapToPlacements();
    buildPalette();
    render();
  } catch (error) {
    ui.statusText.textContent =
      error instanceof Error ? error.message : "Unable to load editor assets.";
    console.error(error);
  }
}

init();
