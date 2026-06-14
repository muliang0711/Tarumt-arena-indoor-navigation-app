import { Download, GitBranchPlus, Redo2, Save, Undo2 } from "lucide-react";
import type { EditorAction } from "../app/editorReducer";
import type { EditorState } from "../app/editorState";

interface ExportPanelProps {
  state: EditorState;
  errors: string[];
  dispatch: React.Dispatch<EditorAction>;
  onExport: () => void;
  onSave: () => void;
  onLoad: () => void;
}

export function ExportPanel({ state, errors, dispatch, onExport, onSave, onLoad }: ExportPanelProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Output</p>
        <h2>JSON Export</h2>
      </div>
      <div className="stats-grid">
        <span>Assets {state.document.assets.items.length}</span>
        <span>Placed {state.document.layers.visual.length}</span>
        <span>Cells {state.document.layers.collision.length}</span>
        <span>Nodes {state.document.navigation.nodes.length}</span>
        <span>Links {state.document.navigation.links.length}</span>
      </div>
      <div className="action-row">
        <button type="button" onClick={() => dispatch({ type: "undo" })}>
          <Undo2 size={16} />
          Undo
        </button>
        <button type="button" onClick={() => dispatch({ type: "redo" })}>
          <Redo2 size={16} />
          Redo
        </button>
        <button type="button" onClick={onSave}>
          <Save size={16} />
          Save
        </button>
        <button type="button" onClick={onLoad}>
          Load
        </button>
        <button type="button" onClick={() => dispatch({ type: "autoLinkStraightNodes" })}>
          <GitBranchPlus size={16} />
          Auto link
        </button>
        <button type="button" onClick={() => dispatch({ type: "fillLinkedNodePaths" })}>
          Fill paths
        </button>
      </div>
      {errors.length > 0 ? (
        <div className="error-list">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : (
        <p className="ok-text">Map validates as schema v2.</p>
      )}
      <button className="primary-action" disabled={errors.length > 0} type="button" onClick={onExport}>
        <Download size={18} />
        Export v2 JSON
      </button>
    </section>
  );
}
