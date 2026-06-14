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
      <p className="muted">Blocking assets automatically paint blocked collision cells over their footprint.</p>
      <div className="asset-grid">
        {state.document.assets.items.map((asset) => (
          <button
            className={state.selectedAssetId === asset.id ? "asset-tile active" : "asset-tile"}
            key={asset.id}
            title={asset.id}
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
        ))}
      </div>
      {state.document.assets.items.length === 0 ? <p className="muted">No assets loaded yet.</p> : null}
    </section>
  );
}
