import { ImageIcon } from "lucide-react";
import type { EditorAction } from "../app/editorReducer";
import type { EditorState } from "../app/editorState";

interface AssetPaletteProps {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  images: Map<string, HTMLImageElement>;
}

export function AssetPalette({ state, dispatch, images }: AssetPaletteProps) {
  return (
    <section className="panel asset-panel">
      <div className="panel-heading">
        <p className="eyebrow">Assets</p>
        <h2>Serious Tiles</h2>
      </div>
      <p className="muted">Use Mix on 2-3 road tiles for random brush and node-path fill.</p>
      <div className="asset-grid">
        {state.document.assets.items.map((asset) => (
          <div
            className={state.selectedAssetId === asset.id ? "asset-tile active" : "asset-tile"}
            key={asset.id}
            title={asset.id}
          >
            <button
              className="asset-main"
              type="button"
              onClick={() => {
                dispatch({ type: "setSelectedAsset", assetId: asset.id });
                dispatch({ type: "setTool", tool: "place" });
              }}
            >
              {images.get(asset.id) ? (
                <img alt="" src={images.get(asset.id)?.src} />
              ) : (
                <span className="asset-placeholder">
                  <ImageIcon size={18} />
                </span>
              )}
              <span>{asset.id}</span>
            </button>
            <button
              className={state.selectedBrushAssetIds.includes(asset.id) ? "mix-button active" : "mix-button"}
              type="button"
              onClick={() => dispatch({ type: "toggleBrushAsset", assetId: asset.id })}
            >
              Mix
            </button>
          </div>
        ))}
      </div>
      {state.document.assets.items.length === 0 ? <p className="muted">No assets loaded yet.</p> : null}
    </section>
  );
}
