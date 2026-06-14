import type { CollisionState, MapPlacement, NavigationLink, NavigationNode, SpawnDirection } from "../map/schema";
import type { EditorDocument, EditorState, EditorTool } from "./editorState";
import { cloneDocument, createLinkId } from "./editorState";

const AUTO_GROW_EDGE_DISTANCE = 0;
const AUTO_GROW_PADDING = 10;

export type EditorAction =
  | { type: "setTool"; tool: EditorTool }
  | { type: "setSelectedAsset"; assetId: string | null }
  | { type: "setBrushAssets"; assetIds: string[] }
  | { type: "toggleBrushAsset"; assetId: string }
  | { type: "setMapInfo"; map: Partial<EditorDocument["map"]> }
  | { type: "setResourceRoot"; resourceRoot: string }
  | { type: "setSpawn"; x: number; y: number; direction: SpawnDirection }
  | { type: "setViewport"; viewport: Partial<EditorState["viewport"]> }
  | { type: "select"; selection: EditorState["selected"] }
  | { type: "setAssets"; assets: EditorDocument["assets"]["items"] }
  | { type: "placeAsset"; placementId: string; assetId: string; x: number; y: number }
  | { type: "paintRandomBrush"; placementId: string; x: number; y: number }
  | { type: "movePlacement"; placementId: string; x: number; y: number }
  | { type: "deletePlacement"; placementId: string }
  | { type: "paintCollision"; x: number; y: number; state: CollisionState }
  | { type: "eraseCollision"; x: number; y: number }
  | { type: "createNode"; node: NavigationNode }
  | { type: "updateNode"; nodeId: string; patch: Partial<NavigationNode> }
  | { type: "deleteNode"; nodeId: string }
  | { type: "createLink"; link: NavigationLink }
  | { type: "deleteLink"; linkId: string }
  | { type: "autoLinkStraightNodes" }
  | { type: "fillLinkedNodePaths" }
  | { type: "setLinkStart"; nodeId: string | null }
  | { type: "replaceDocument"; document: EditorDocument }
  | { type: "undo" }
  | { type: "redo" };

function withHistory(state: EditorState, document: EditorDocument, selection = state.selected): EditorState {
  return {
    ...state,
    document,
    selected: selection,
    history: {
      past: [...state.history.past, cloneDocument(state.document)],
      future: [],
    },
  };
}

function updateDocument(state: EditorState, update: (document: EditorDocument) => void, selection = state.selected): EditorState {
  const document = cloneDocument(state.document);
  update(document);
  return withHistory(state, document, selection);
}

function upsertCollision(document: EditorDocument, x: number, y: number, state: CollisionState): void {
  document.layers.collision = document.layers.collision.filter((cell) => !(cell.x === x && cell.y === y));
  document.layers.collision.push({ x, y, state });
  document.layers.collision.sort((left, right) => left.y - right.y || left.x - right.x);
}

function shouldGrowForPoint(document: EditorDocument, x: number, y: number): boolean {
  return (
    x <= AUTO_GROW_EDGE_DISTANCE ||
    y <= AUTO_GROW_EDGE_DISTANCE ||
    x >= document.map.width - 1 - AUTO_GROW_EDGE_DISTANCE ||
    y >= document.map.height - 1 - AUTO_GROW_EDGE_DISTANCE
  );
}

function shiftDocumentContent(document: EditorDocument, offsetX: number, offsetY: number): void {
  document.layers.visual = document.layers.visual.map((placement) => ({
    ...placement,
    x: placement.x + offsetX,
    y: placement.y + offsetY,
  }));
  document.layers.collision = document.layers.collision.map((cell) => ({
    ...cell,
    x: cell.x + offsetX,
    y: cell.y + offsetY,
  }));
  document.navigation.nodes = document.navigation.nodes.map((node) => ({
    ...node,
    x: node.x + offsetX,
    y: node.y + offsetY,
  }));
  document.spawn = {
    ...document.spawn,
    x: document.spawn.x + offsetX,
    y: document.spawn.y + offsetY,
  };
}

function growMapAroundContentIfNeeded(document: EditorDocument, x: number, y: number): { x: number; y: number } {
  if (!shouldGrowForPoint(document, x, y)) {
    return { x, y };
  }

  document.map.width += AUTO_GROW_PADDING * 2;
  document.map.height += AUTO_GROW_PADDING * 2;
  shiftDocumentContent(document, AUTO_GROW_PADDING, AUTO_GROW_PADDING);
  return { x: x + AUTO_GROW_PADDING, y: y + AUTO_GROW_PADDING };
}

function assetForPlacement(document: EditorDocument, assetId: string) {
  return document.assets.items.find((asset) => asset.id === assetId) ?? null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function placementFromClick(document: EditorDocument, placementId: string, assetId: string, x: number, y: number): MapPlacement {
  const asset = assetForPlacement(document, assetId);
  const widthTiles = asset?.widthTiles ?? 1;
  const heightTiles = asset?.heightTiles ?? 1;
  const maxX = Math.max(0, document.map.width - widthTiles);
  const maxY = Math.max(0, document.map.height - heightTiles);

  return {
    id: placementId,
    assetId,
    x: clamp(x - Math.floor(widthTiles / 2), 0, maxX),
    y: clamp(y - Math.floor(heightTiles / 2), 0, maxY),
  };
}

function autoBlockPlacementFootprint(document: EditorDocument, placement: MapPlacement): void {
  const asset = assetForPlacement(document, placement.assetId);
  if (!asset?.blocksMovement) {
    return;
  }

  const offsets =
    asset.blockedOffsets && asset.blockedOffsets.length > 0
      ? asset.blockedOffsets
      : Array.from({ length: asset.heightTiles }, (_, y) => Array.from({ length: asset.widthTiles }, (__, x) => ({ x, y }))).flat();

  for (const offset of offsets) {
    const x = placement.x + offset.x;
    const y = placement.y + offset.y;
    if (x >= 0 && y >= 0 && x < document.map.width && y < document.map.height) {
      upsertCollision(document, x, y, "blocked");
    }
  }
}

function assetCoversTile(asset: { widthTiles: number; heightTiles: number }, placement: MapPlacement, x: number, y: number): boolean {
  return x >= placement.x && y >= placement.y && x < placement.x + asset.widthTiles && y < placement.y + asset.heightTiles;
}

function hasBlockingPlacementAt(document: EditorDocument, x: number, y: number): boolean {
  return document.layers.visual.some((placement) => {
    const asset = assetForPlacement(document, placement.assetId);
    return Boolean(asset?.blocksMovement && assetCoversTile(asset, placement, x, y));
  });
}

function removeReplaceableTilePlacement(document: EditorDocument, x: number, y: number): void {
  document.layers.visual = document.layers.visual.filter((placement) => {
    const asset = assetForPlacement(document, placement.assetId);
    if (!asset || asset.blocksMovement) {
      return true;
    }
    return !(placement.x === x && placement.y === y && asset.widthTiles === 1 && asset.heightTiles === 1);
  });
}

function chooseBrushAssetId(document: EditorDocument, state: EditorState, x: number, y: number): string | null {
  const candidateIds = (state.selectedBrushAssetIds.length > 0 ? state.selectedBrushAssetIds : state.selectedAssetId ? [state.selectedAssetId] : [])
    .filter((assetId) => document.assets.items.some((asset) => asset.id === assetId));

  if (candidateIds.length === 0) {
    return null;
  }

  return candidateIds[Math.abs(x + y) % candidateIds.length];
}

function paintBrushTile(document: EditorDocument, state: EditorState, placementId: string, x: number, y: number): void {
  if (hasBlockingPlacementAt(document, x, y)) {
    return;
  }

  const assetId = chooseBrushAssetId(document, state, x, y);
  if (!assetId) {
    return;
  }

  removeReplaceableTilePlacement(document, x, y);
  document.layers.visual.push({ id: placementId, assetId, x, y });
  upsertCollision(document, x, y, "walkable");
}

function linkExists(document: EditorDocument, from: string, to: string): boolean {
  return document.navigation.links.some(
    (link) => (link.from === from && link.to === to) || (link.bidirectional && link.from === to && link.to === from),
  );
}

function hasBlockedCellBetween(document: EditorDocument, from: NavigationNode, to: NavigationNode): boolean {
  if (from.x !== to.x && from.y !== to.y) {
    return true;
  }

  const blocked = new Set(document.layers.collision.filter((cell) => cell.state === "blocked").map((cell) => `${cell.x},${cell.y}`));
  if (from.x === to.x) {
    const start = Math.min(from.y, to.y) + 1;
    const end = Math.max(from.y, to.y);
    for (let y = start; y < end; y += 1) {
      if (blocked.has(`${from.x},${y}`)) {
        return true;
      }
    }
    return false;
  }

  const start = Math.min(from.x, to.x) + 1;
  const end = Math.max(from.x, to.x);
  for (let x = start; x < end; x += 1) {
    if (blocked.has(`${x},${from.y}`)) {
      return true;
    }
  }
  return false;
}

function autoLinkStraightNodes(document: EditorDocument): void {
  const additions: NavigationLink[] = [];

  for (let leftIndex = 0; leftIndex < document.navigation.nodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < document.navigation.nodes.length; rightIndex += 1) {
      const from = document.navigation.nodes[leftIndex];
      const to = document.navigation.nodes[rightIndex];
      const aligned = from.x === to.x || from.y === to.y;
      if (!aligned || linkExists(document, from.id, to.id) || hasBlockedCellBetween(document, from, to)) {
        continue;
      }

      additions.push({
        id: createLinkId(from.id, to.id, [...document.navigation.links, ...additions]),
        from: from.id,
        to: to.id,
        bidirectional: true,
      });
    }
  }

  document.navigation.links.push(...additions);
}

function cellsBetweenInclusive(from: NavigationNode, to: NavigationNode): Array<{ x: number; y: number }> {
  if (from.x === to.x) {
    const start = Math.min(from.y, to.y);
    const end = Math.max(from.y, to.y);
    return Array.from({ length: end - start + 1 }, (_, index) => ({ x: from.x, y: start + index }));
  }

  if (from.y === to.y) {
    const start = Math.min(from.x, to.x);
    const end = Math.max(from.x, to.x);
    return Array.from({ length: end - start + 1 }, (_, index) => ({ x: start + index, y: from.y }));
  }

  return [];
}

function fillLinkedNodePaths(document: EditorDocument, state: EditorState): void {
  const nodeById = new Map(document.navigation.nodes.map((node) => [node.id, node]));
  const painted = new Set<string>();

  for (const link of document.navigation.links) {
    const from = nodeById.get(link.from);
    const to = nodeById.get(link.to);
    if (!from || !to) {
      continue;
    }

    const cells = cellsBetweenInclusive(from, to);
    if (cells.length === 0 || cells.some((cell) => hasBlockingPlacementAt(document, cell.x, cell.y))) {
      continue;
    }

    for (const cell of cells) {
      const key = `${cell.x},${cell.y}`;
      if (painted.has(key)) {
        continue;
      }
      painted.add(key);
      paintBrushTile(document, state, `path_${cell.x}_${cell.y}`, cell.x, cell.y);
    }
  }
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "setTool":
      return { ...state, activeTool: action.tool, linkStartNodeId: action.tool === "link" ? state.linkStartNodeId : null };
    case "setSelectedAsset":
      return { ...state, selectedAssetId: action.assetId };
    case "setBrushAssets":
      return { ...state, selectedBrushAssetIds: action.assetIds };
    case "toggleBrushAsset": {
      const selected = state.selectedBrushAssetIds.includes(action.assetId)
        ? state.selectedBrushAssetIds.filter((assetId) => assetId !== action.assetId)
        : [...state.selectedBrushAssetIds, action.assetId];
      return { ...state, selectedBrushAssetIds: selected };
    }
    case "setViewport":
      return { ...state, viewport: { ...state.viewport, ...action.viewport } };
    case "select":
      return { ...state, selected: action.selection };
    case "setLinkStart":
      return { ...state, linkStartNodeId: action.nodeId };
    case "setMapInfo":
      return updateDocument(state, (document) => {
        document.map = { ...document.map, ...action.map };
      });
    case "setResourceRoot":
      return updateDocument(state, (document) => {
        document.assets.resourceRoot = action.resourceRoot;
      });
    case "setSpawn":
      return updateDocument(state, (document) => {
        document.spawn = { x: action.x, y: action.y, direction: action.direction };
      });
    case "setAssets":
      return updateDocument(state, (document) => {
        document.assets.items = action.assets;
      });
    case "replaceDocument":
      return withHistory(state, cloneDocument(action.document), { kind: null, id: null });
    case "placeAsset":
      return updateDocument(
        state,
        (document) => {
          const target = growMapAroundContentIfNeeded(document, action.x, action.y);
          const placement = placementFromClick(document, action.placementId, action.assetId, target.x, target.y);
          document.layers.visual.push(placement);
          autoBlockPlacementFootprint(document, placement);
        },
        { kind: "placement", id: action.placementId },
      );
    case "paintRandomBrush":
      return updateDocument(state, (document) => {
        const target = growMapAroundContentIfNeeded(document, action.x, action.y);
        paintBrushTile(document, state, action.placementId, target.x, target.y);
      });
    case "movePlacement":
      return updateDocument(state, (document) => {
        document.layers.visual = document.layers.visual.map((placement) =>
          placement.id === action.placementId ? { ...placement, x: action.x, y: action.y } : placement,
        );
      });
    case "deletePlacement":
      return updateDocument(
        state,
        (document) => {
          document.layers.visual = document.layers.visual.filter((placement) => placement.id !== action.placementId);
        },
        { kind: null, id: null },
      );
    case "paintCollision":
      return updateDocument(state, (document) => {
        const target = growMapAroundContentIfNeeded(document, action.x, action.y);
        upsertCollision(document, target.x, target.y, action.state);
      });
    case "eraseCollision":
      return updateDocument(state, (document) => {
        document.layers.collision = document.layers.collision.filter((cell) => !(cell.x === action.x && cell.y === action.y));
      });
    case "createNode":
      return updateDocument(
        state,
        (document) => {
          const target = growMapAroundContentIfNeeded(document, action.node.x, action.node.y);
          document.navigation.nodes.push({ ...action.node, x: target.x, y: target.y });
        },
        { kind: "node", id: action.node.id },
      );
    case "updateNode":
      return updateDocument(state, (document) => {
        document.navigation.nodes = document.navigation.nodes.map((node) =>
          node.id === action.nodeId ? { ...node, ...action.patch } : node,
        );
      });
    case "deleteNode":
      return updateDocument(
        state,
        (document) => {
          document.navigation.nodes = document.navigation.nodes.filter((node) => node.id !== action.nodeId);
          document.navigation.links = document.navigation.links.filter((link) => link.from !== action.nodeId && link.to !== action.nodeId);
        },
        { kind: null, id: null },
      );
    case "createLink":
      return updateDocument(
        state,
        (document) => {
          document.navigation.links.push(action.link);
        },
        { kind: "link", id: action.link.id },
      );
    case "deleteLink":
      return updateDocument(
        state,
        (document) => {
          document.navigation.links = document.navigation.links.filter((link) => link.id !== action.linkId);
        },
        { kind: null, id: null },
      );
    case "autoLinkStraightNodes":
      return updateDocument(state, (document) => autoLinkStraightNodes(document));
    case "fillLinkedNodePaths":
      return updateDocument(state, (document) => fillLinkedNodePaths(document, state));
    case "undo": {
      const previous = state.history.past.at(-1);
      if (!previous) {
        return state;
      }
      return {
        ...state,
        document: cloneDocument(previous),
        selected: { kind: null, id: null },
        history: {
          past: state.history.past.slice(0, -1),
          future: [cloneDocument(state.document), ...state.history.future],
        },
      };
    }
    case "redo": {
      const next = state.history.future[0];
      if (!next) {
        return state;
      }
      return {
        ...state,
        document: cloneDocument(next),
        history: {
          past: [...state.history.past, cloneDocument(state.document)],
          future: state.history.future.slice(1),
        },
      };
    }
    default:
      return state;
  }
}
