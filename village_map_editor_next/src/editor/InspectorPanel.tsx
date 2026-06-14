import type { EditorAction } from "../app/editorReducer";
import type { EditorState } from "../app/editorState";
import type { NodeType } from "../map/schema";

interface InspectorPanelProps {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

export function InspectorPanel({ state, dispatch }: InspectorPanelProps) {
  const selectedPlacement =
    state.selected.kind === "placement" ? state.document.layers.visual.find((item) => item.id === state.selected.id) : null;
  const selectedNode = state.selected.kind === "node" ? state.document.navigation.nodes.find((item) => item.id === state.selected.id) : null;
  const selectedLink = state.selected.kind === "link" ? state.document.navigation.links.find((item) => item.id === state.selected.id) : null;

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Inspector</p>
        <h2>Selection</h2>
      </div>
      {!selectedPlacement && !selectedNode && !selectedLink ? <p className="muted">Select a placement, node, or link.</p> : null}
      {selectedPlacement ? (
        <div className="form-grid">
          <label className="field">
            <span>Placement id</span>
            <input readOnly value={selectedPlacement.id} />
          </label>
          <label className="field">
            <span>Asset</span>
            <input readOnly value={selectedPlacement.assetId} />
          </label>
          <label className="field">
            <span>X</span>
            <input
              type="number"
              value={selectedPlacement.x}
              onChange={(event) =>
                dispatch({
                  type: "movePlacement",
                  placementId: selectedPlacement.id,
                  x: Number(event.target.value),
                  y: selectedPlacement.y,
                })
              }
            />
          </label>
          <label className="field">
            <span>Y</span>
            <input
              type="number"
              value={selectedPlacement.y}
              onChange={(event) =>
                dispatch({
                  type: "movePlacement",
                  placementId: selectedPlacement.id,
                  x: selectedPlacement.x,
                  y: Number(event.target.value),
                })
              }
            />
          </label>
        </div>
      ) : null}
      {selectedNode ? (
        <div className="form-grid">
          <label className="field">
            <span>Node id</span>
            <input readOnly value={selectedNode.id} />
          </label>
          <label className="field">
            <span>Label</span>
            <input
              value={selectedNode.label}
              onChange={(event) => dispatch({ type: "updateNode", nodeId: selectedNode.id, patch: { label: event.target.value } })}
            />
          </label>
          <label className="field">
            <span>Type</span>
            <select
              value={selectedNode.type}
              onChange={(event) =>
                dispatch({ type: "updateNode", nodeId: selectedNode.id, patch: { type: event.target.value as NodeType } })
              }
            >
              <option value="destination">Destination</option>
              <option value="junction">Junction</option>
              <option value="stairs">Stairs</option>
              <option value="elevator">Elevator</option>
            </select>
          </label>
        </div>
      ) : null}
      {selectedLink ? (
        <div className="selection-meta">
          <strong>{selectedLink.id}</strong>
          <span>
            {selectedLink.from} to {selectedLink.to}
          </span>
        </div>
      ) : null}
    </section>
  );
}
