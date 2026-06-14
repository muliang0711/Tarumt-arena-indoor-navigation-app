import type { MapAsset, MapDocumentV2, NavigationLink, NavigationNode } from "../map/schema";

export type EditorTool =
  | "place"
  | "select"
  | "erase"
  | "random-brush"
  | "collision-walkable"
  | "collision-blocked"
  | "node"
  | "link";

export interface ViewportState {
  zoom: number;
  offsetX: number;
  offsetY: number;
  showGrid: boolean;
}

export interface EditorSelection {
  kind: "placement" | "node" | "link" | null;
  id: string | null;
}

export interface EditorDocument extends MapDocumentV2 {}

export interface EditorState {
  document: EditorDocument;
  selectedAssetId: string | null;
  selectedBrushAssetIds: string[];
  selected: EditorSelection;
  activeTool: EditorTool;
  linkStartNodeId: string | null;
  viewport: ViewportState;
  history: {
    past: EditorDocument[];
    future: EditorDocument[];
  };
}

export interface CreateInitialEditorStateOptions {
  assets?: MapAsset[];
}

const DEFAULT_MAP = {
  id: "village_demo_01",
  name: "Village Demo",
  tileSize: 16,
  width: 30,
  height: 20,
};

export function cloneDocument(document: EditorDocument): EditorDocument {
  return structuredClone(document) as EditorDocument;
}

export function createInitialEditorState(options: CreateInitialEditorStateOptions = {}): EditorState {
  return {
    document: {
      schemaVersion: 2,
      map: { ...DEFAULT_MAP },
      assets: {
        resourceRoot: "resources/serious_shit",
        items: options.assets ?? [],
      },
      layers: {
        visual: [],
        collision: [],
      },
      navigation: {
        nodes: [],
        links: [],
      },
      spawn: {
        x: 1,
        y: 1,
        direction: "down",
      },
    },
    selectedAssetId: options.assets?.[0]?.id ?? null,
    selectedBrushAssetIds: options.assets?.[0] ? [options.assets[0].id] : [],
    selected: { kind: null, id: null },
    activeTool: "place",
    linkStartNodeId: null,
    viewport: {
      zoom: 2,
      offsetX: 0,
      offsetY: 0,
      showGrid: true,
    },
    history: {
      past: [],
      future: [],
    },
  };
}

export interface SerializableEditorState {
  document: EditorDocument;
  selectedAssetId: string | null;
  selectedBrushAssetIds: string[];
  activeTool: EditorTool;
  viewport: ViewportState;
}

export function toSerializableState(state: EditorState): SerializableEditorState {
  return {
    document: state.document,
    selectedAssetId: state.selectedAssetId,
    selectedBrushAssetIds: state.selectedBrushAssetIds,
    activeTool: state.activeTool,
    viewport: state.viewport,
  };
}

export function fromSerializableState(serialized: SerializableEditorState): EditorState {
  return {
    document: serialized.document,
    selectedAssetId: serialized.selectedAssetId,
    selectedBrushAssetIds: serialized.selectedBrushAssetIds ?? (serialized.selectedAssetId ? [serialized.selectedAssetId] : []),
    selected: { kind: null, id: null },
    activeTool: serialized.activeTool,
    linkStartNodeId: null,
    viewport: serialized.viewport,
    history: { past: [], future: [] },
  };
}

export function saveEditorState(storage: Storage, key: string, state: EditorState): void {
  storage.setItem(key, JSON.stringify(toSerializableState(state)));
}

export function loadEditorState(storage: Storage, key: string): EditorState | null {
  const raw = storage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return fromSerializableState(JSON.parse(raw) as SerializableEditorState);
  } catch {
    return null;
  }
}

export function createNodeId(label: string, existingNodes: NavigationNode[]): string {
  const base = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "node";
  const existing = new Set(existingNodes.map((node) => node.id));
  if (!existing.has(base)) {
    return base;
  }

  let index = 2;
  while (existing.has(`${base}_${index}`)) {
    index += 1;
  }
  return `${base}_${index}`;
}

export function createLinkId(from: string, to: string, existingLinks: NavigationLink[]): string {
  const base = `${from}_to_${to}`;
  const existing = new Set(existingLinks.map((link) => link.id));
  if (!existing.has(base)) {
    return base;
  }

  let index = 2;
  while (existing.has(`${base}_${index}`)) {
    index += 1;
  }
  return `${base}_${index}`;
}
