import type { CollisionState, MapPlacement, NavigationLink, NavigationNode, SpawnDirection } from "../map/schema";
import type { EditorDocument, EditorState, EditorTool } from "./editorState";
import { cloneDocument } from "./editorState";

export type EditorAction =
  | { type: "setTool"; tool: EditorTool }
  | { type: "setSelectedAsset"; assetId: string | null }
  | { type: "setMapInfo"; map: Partial<EditorDocument["map"]> }
  | { type: "setResourceRoot"; resourceRoot: string }
  | { type: "setSpawn"; x: number; y: number; direction: SpawnDirection }
  | { type: "setViewport"; viewport: Partial<EditorState["viewport"]> }
  | { type: "select"; selection: EditorState["selected"] }
  | { type: "setAssets"; assets: EditorDocument["assets"]["items"] }
  | { type: "placeAsset"; placementId: string; assetId: string; x: number; y: number }
  | { type: "movePlacement"; placementId: string; x: number; y: number }
  | { type: "deletePlacement"; placementId: string }
  | { type: "paintCollision"; x: number; y: number; state: CollisionState }
  | { type: "eraseCollision"; x: number; y: number }
  | { type: "createNode"; node: NavigationNode }
  | { type: "updateNode"; nodeId: string; patch: Partial<NavigationNode> }
  | { type: "deleteNode"; nodeId: string }
  | { type: "createLink"; link: NavigationLink }
  | { type: "deleteLink"; linkId: string }
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

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "setTool":
      return { ...state, activeTool: action.tool, linkStartNodeId: action.tool === "link" ? state.linkStartNodeId : null };
    case "setSelectedAsset":
      return { ...state, selectedAssetId: action.assetId };
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
          const placement: MapPlacement = {
            id: action.placementId,
            assetId: action.assetId,
            x: action.x,
            y: action.y,
          };
          document.layers.visual.push(placement);
        },
        { kind: "placement", id: action.placementId },
      );
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
      return updateDocument(state, (document) => upsertCollision(document, action.x, action.y, action.state));
    case "eraseCollision":
      return updateDocument(state, (document) => {
        document.layers.collision = document.layers.collision.filter((cell) => !(cell.x === action.x && cell.y === action.y));
      });
    case "createNode":
      return updateDocument(
        state,
        (document) => {
          document.navigation.nodes.push(action.node);
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
