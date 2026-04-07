import { NODE_TYPE_OPTIONS } from '../types/graph'
import type { EdgeDefaults, EditorMode, NodeDefaults } from '../types/graph'

interface ToolbarProps {
  mode: EditorMode
  nodeDefaults: NodeDefaults
  edgeDefaults: EdgeDefaults
  pendingEdgeStartId: string | null
  onModeChange: (mode: EditorMode) => void
  onNodeDefaultsChange: (next: NodeDefaults) => void
  onEdgeDefaultsChange: (next: EdgeDefaults) => void
}

const modeCopy: Record<EditorMode, string> = {
  select: 'Select nodes or edges, drag nodes, and edit properties.',
  addNode: 'Click the canvas to add a graph node with the current node defaults.',
  addEdge: 'Click a source node and then a target node to create an edge.',
  delete: 'Click a node or edge to remove it from the dataset.',
}

export function Toolbar({
  mode,
  nodeDefaults,
  edgeDefaults,
  pendingEdgeStartId,
  onModeChange,
  onNodeDefaultsChange,
  onEdgeDefaultsChange,
}: ToolbarProps) {
  return (
    <aside className="panel toolbar-panel">
      <div className="panel-heading">
        <p className="panel-kicker">Modes</p>
        <h2>Graph Tools</h2>
      </div>

      <div className="tool-list" role="toolbar" aria-label="Graph editor modes">
        {(['select', 'addNode', 'addEdge', 'delete'] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            className={entry === mode ? 'tool-button is-active' : 'tool-button'}
            onClick={() => onModeChange(entry)}
          >
            <span className="tool-button-title">
              {entry === 'addNode'
                ? 'Add Node'
                : entry === 'addEdge'
                  ? 'Add Edge'
                  : entry === 'delete'
                    ? 'Delete'
                    : 'Select'}
            </span>
            <span className="tool-button-copy">{modeCopy[entry]}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-section">
        <p className="section-title">Node Defaults</p>
        <label className="field">
          <span>Node type</span>
          <select
            value={nodeDefaults.type}
            onChange={(event) =>
              onNodeDefaultsChange({ ...nodeDefaults, type: event.target.value })
            }
          >
            {NODE_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Floor ID</span>
          <input
            type="number"
            step={1}
            value={nodeDefaults.floor_id}
            onChange={(event) =>
              onNodeDefaultsChange({
                ...nodeDefaults,
                floor_id: Number(event.target.value) || 1,
              })
            }
          />
        </label>
      </div>

      <div className="toolbar-section">
        <p className="section-title">Edge Defaults</p>
        <label className="field">
          <span>Weight</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={edgeDefaults.weight}
            onChange={(event) =>
              onEdgeDefaultsChange({
                ...edgeDefaults,
                weight: Number(event.target.value) || 1,
              })
            }
          />
        </label>

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={edgeDefaults.bidirectional}
            onChange={(event) =>
              onEdgeDefaultsChange({
                ...edgeDefaults,
                bidirectional: event.target.checked,
              })
            }
          />
          <span>Bidirectional</span>
        </label>
      </div>

      <div className="toolbar-section toolbar-note">
        <p className="section-title">Workflow</p>
        <p>Nodes should represent junctions or semantic anchors, not arbitrary corridor points.</p>
        <p>Use `not_walkable` for blocked zones, walls, or obstacles that should not join the route graph.</p>
        <p>New nodes and dragged nodes auto-connect to same-floor junctions one lattice step away.</p>
        <p>Current edge source: {pendingEdgeStartId ?? 'Not selected'}</p>
      </div>
    </aside>
  )
}
