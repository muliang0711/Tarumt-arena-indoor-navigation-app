import type { EditorAction } from "../app/editorReducer";
import type { EditorState } from "../app/editorState";
import type { SpawnDirection } from "../map/schema";

interface MapSettingsPanelProps {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

export function MapSettingsPanel({ state, dispatch }: MapSettingsPanelProps) {
  const { map, assets, spawn } = state.document;

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Map</p>
        <h2>Settings</h2>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Map id</span>
          <input value={map.id} onChange={(event) => dispatch({ type: "setMapInfo", map: { id: event.target.value } })} />
        </label>
        <label className="field">
          <span>Name</span>
          <input value={map.name} onChange={(event) => dispatch({ type: "setMapInfo", map: { name: event.target.value } })} />
        </label>
        <label className="field">
          <span>Width</span>
          <input
            min={1}
            type="number"
            value={map.width}
            onChange={(event) => dispatch({ type: "setMapInfo", map: { width: Number(event.target.value) } })}
          />
        </label>
        <label className="field">
          <span>Height</span>
          <input
            min={1}
            type="number"
            value={map.height}
            onChange={(event) => dispatch({ type: "setMapInfo", map: { height: Number(event.target.value) } })}
          />
        </label>
        <label className="field">
          <span>Tile size</span>
          <input
            min={1}
            type="number"
            value={map.tileSize}
            onChange={(event) => dispatch({ type: "setMapInfo", map: { tileSize: Number(event.target.value) } })}
          />
        </label>
        <label className="field">
          <span>Resource root</span>
          <input value={assets.resourceRoot} onChange={(event) => dispatch({ type: "setResourceRoot", resourceRoot: event.target.value })} />
        </label>
        <label className="field">
          <span>Spawn X</span>
          <input
            min={0}
            type="number"
            value={spawn.x}
            onChange={(event) => dispatch({ type: "setSpawn", x: Number(event.target.value), y: spawn.y, direction: spawn.direction })}
          />
        </label>
        <label className="field">
          <span>Spawn Y</span>
          <input
            min={0}
            type="number"
            value={spawn.y}
            onChange={(event) => dispatch({ type: "setSpawn", x: spawn.x, y: Number(event.target.value), direction: spawn.direction })}
          />
        </label>
        <label className="field">
          <span>Direction</span>
          <select
            value={spawn.direction}
            onChange={(event) =>
              dispatch({ type: "setSpawn", x: spawn.x, y: spawn.y, direction: event.target.value as SpawnDirection })
            }
          >
            <option value="down">Down</option>
            <option value="up">Up</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </label>
      </div>
    </section>
  );
}
