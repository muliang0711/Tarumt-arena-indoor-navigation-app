import { Boxes, Dices, Eraser, Grid2X2, Link, MapPin, MousePointer2, Route, SquareDashedMousePointer } from "lucide-react";
import type { EditorAction } from "../app/editorReducer";
import type { EditorState, EditorTool } from "../app/editorState";

interface ToolPanelProps {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

const TOOLS: Array<{ id: EditorTool; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "place", label: "Place", icon: Boxes },
  { id: "random-brush", label: "Random Brush", icon: Dices },
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "erase", label: "Erase", icon: Eraser },
  { id: "collision-walkable", label: "Walkable", icon: Route },
  { id: "collision-blocked", label: "Blocked", icon: Grid2X2 },
  { id: "node", label: "Node", icon: MapPin },
  { id: "link", label: "Link", icon: Link },
];

export function ToolPanel({ state, dispatch }: ToolPanelProps) {
  return (
    <section className="panel tool-panel">
      <div className="panel-heading">
        <p className="eyebrow">Tools</p>
        <h2>Editor Mode</h2>
      </div>
      <div className="tool-grid">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              className={state.activeTool === tool.id ? "tool-button active" : "tool-button"}
              key={tool.id}
              title={tool.label}
              type="button"
              onClick={() => dispatch({ type: "setTool", tool: tool.id })}
            >
              <Icon size={18} />
              <span>{tool.label}</span>
            </button>
          );
        })}
      </div>
      <label className="check-row">
        <input
          checked={state.viewport.showGrid}
          type="checkbox"
          onChange={(event) => dispatch({ type: "setViewport", viewport: { showGrid: event.target.checked } })}
        />
        <span>Show grid</span>
      </label>
      <label className="field">
        <span>Zoom</span>
        <input
          max={4}
          min={1}
          step={0.25}
          type="range"
          value={state.viewport.zoom}
          onChange={(event) => dispatch({ type: "setViewport", viewport: { zoom: Number(event.target.value) } })}
        />
      </label>
      <div className="status-line">
        <SquareDashedMousePointer size={16} />
        <span>{state.activeTool}</span>
      </div>
    </section>
  );
}
