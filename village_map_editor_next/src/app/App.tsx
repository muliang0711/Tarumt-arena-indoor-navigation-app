import { useEffect, useMemo, useReducer, useState } from "react";
import { loadEditorAssets } from "../assets/assetLoader";
import { AssetPalette } from "../editor/AssetPalette";
import { ExportPanel } from "../editor/ExportPanel";
import { InspectorPanel } from "../editor/InspectorPanel";
import { MapCanvas } from "../editor/MapCanvas";
import { MapSettingsPanel } from "../editor/MapSettingsPanel";
import { ToolPanel } from "../editor/ToolPanel";
import { exportMapDocument, mapDocumentToJson } from "../map/exportMap";
import { editorReducer } from "./editorReducer";
import { createInitialEditorState, loadEditorState, saveEditorState } from "./editorState";

const initialState = createInitialEditorState();
const STORAGE_KEY = "village-map-editor-next-state-v1";

async function exportJsonToProjectRoot(fileName: string, content: string): Promise<{ fileName: string; path: string }> {
  const response = await fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, content }),
  });
  const result = (await response.json()) as { fileName?: string; path?: string; error?: string };
  if (!response.ok || !result.fileName || !result.path) {
    throw new Error(result.error || "Unable to export map.");
  }
  return { fileName: result.fileName, path: result.path };
}

export function App() {
  const [state, dispatch] = useReducer(editorReducer, initialState);
  const [images, setImages] = useState(() => new Map<string, HTMLImageElement>());
  const [assetStatus, setAssetStatus] = useState("Loading assets...");
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const exportResult = useMemo(() => exportMapDocument(state), [state]);

  useEffect(() => {
    let cancelled = false;

    loadEditorAssets(state.document.map.tileSize)
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        setImages(loaded.images);
        dispatch({ type: "setAssets", assets: loaded.assets });
        dispatch({ type: "setSelectedAsset", assetId: loaded.assets[0]?.id ?? null });
        setAssetStatus(`Loaded ${loaded.assets.length} assets.`);
      })
      .catch((error) => {
        if (!cancelled) {
          setAssetStatus(error instanceof Error ? error.message : "Unable to load assets.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [state.document.map.tileSize]);

  async function handleExport(): Promise<void> {
    if (exportResult.errors.length > 0) {
      return;
    }
    try {
      const result = await exportJsonToProjectRoot(`${state.document.map.id || "map"}.json`, mapDocumentToJson(exportResult.document));
      setExportStatus(`Saved ${result.fileName} to ${result.path}`);
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Unable to export map.");
    }
  }

  function handleSave(): void {
    saveEditorState(window.localStorage, STORAGE_KEY, state);
  }

  function handleLoad(): void {
    const loaded = loadEditorState(window.localStorage, STORAGE_KEY);
    if (loaded) {
      dispatch({ type: "replaceDocument", document: loaded.document });
      dispatch({ type: "setSelectedAsset", assetId: loaded.selectedAssetId });
      dispatch({ type: "setTool", tool: loaded.activeTool });
      dispatch({ type: "setViewport", viewport: loaded.viewport });
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Village Map Editor Next</p>
          <h1>{state.document.map.name}</h1>
        </div>
        <div className="topbar-meta">
          <span>Schema v2</span>
          <span>{state.document.assets.items.length} assets</span>
          <span>{assetStatus}</span>
        </div>
      </header>
      <div className="editor-layout">
        <aside className="left-rail">
          <ToolPanel dispatch={dispatch} state={state} />
          <AssetPalette dispatch={dispatch} images={images} state={state} />
        </aside>
        <MapCanvas dispatch={dispatch} images={images} state={state} />
        <aside className="right-rail">
          <MapSettingsPanel dispatch={dispatch} state={state} />
          <InspectorPanel dispatch={dispatch} state={state} />
          <ExportPanel
            dispatch={dispatch}
            errors={exportResult.errors}
            exportStatus={exportStatus}
            state={state}
            onExport={handleExport}
            onLoad={handleLoad}
            onSave={handleSave}
          />
        </aside>
      </div>
    </main>
  );
}
