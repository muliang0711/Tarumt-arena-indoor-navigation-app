import { useState } from 'react'

import { NODE_TYPE_OPTIONS } from '../types/graph'
import type {
  GraphDataset,
  GraphEdge,
  GraphNode,
  Selection,
  ValidationResult,
} from '../types/graph'
import { parseTagsInput, tagsToString } from '../lib/graph'

interface PropertyPanelProps {
  dataset: GraphDataset
  selection: Selection | null
  validation: ValidationResult
  onUpdateNode: (nodeId: string, updater: (node: GraphNode) => GraphNode) => void
  onUpdateEdge: (edgeId: string, updater: (edge: GraphEdge) => GraphEdge) => void
  onDeleteSelection: () => void
}

function useJsonEditor(initialValue: Record<string, unknown> | null) {
  const [text, setText] = useState(JSON.stringify(initialValue ?? {}, null, 2))
  const [error, setError] = useState<string | null>(null)

  return {
    text,
    error,
    update(rawValue: string, onValid: (metadata: Record<string, unknown> | null) => void) {
      setText(rawValue)

      try {
        const parsed = JSON.parse(rawValue)
        if (parsed === null) {
          setError(null)
          onValid(null)
          return
        }

        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
          setError('Metadata must be a JSON object or null.')
          return
        }

        setError(null)
        onValid(parsed as Record<string, unknown>)
      } catch {
        setError('Invalid JSON. Fix syntax before saving metadata.')
      }
    },
  }
}

function NodeInspector({
  node,
  onUpdateNode,
  onDeleteSelection,
}: {
  node: GraphNode
  onUpdateNode: (nodeId: string, updater: (node: GraphNode) => GraphNode) => void
  onDeleteSelection: () => void
}) {
  const metadata = useJsonEditor(node.metadata)

  return (
    <aside className="panel property-panel">
      <div className="panel-heading">
        <p className="panel-kicker">Selection</p>
        <h2>Node</h2>
      </div>

      <div className="field-group">
        <label className="field">
          <span>Node ID</span>
          <input
            type="text"
            value={node.node_id}
            onChange={(event) =>
              onUpdateNode(node.node_id, (current) => ({
                ...current,
                node_id: event.target.value,
              }))
            }
          />
        </label>
        <label className="field">
          <span>Type</span>
          <select
            value={node.type}
            onChange={(event) =>
              onUpdateNode(node.node_id, (current) => ({
                ...current,
                type: event.target.value,
              }))
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
            value={node.floor_id}
            onChange={(event) =>
              onUpdateNode(node.node_id, (current) => ({
                ...current,
                floor_id: Number(event.target.value) || 0,
              }))
            }
          />
        </label>
        <label className="field">
          <span>Name</span>
          <input
            type="text"
            value={node.name ?? ''}
            onChange={(event) =>
              onUpdateNode(node.node_id, (current) => ({
                ...current,
                name: event.target.value || null,
              }))
            }
          />
        </label>
      </div>

      <div className="field-group geometry-grid">
        <label className="field">
          <span>X</span>
          <input
            type="number"
            value={node.x}
            onChange={(event) =>
              onUpdateNode(node.node_id, (current) => ({
                ...current,
                x: Number(event.target.value) || 0,
              }))
            }
          />
        </label>
        <label className="field">
          <span>Y</span>
          <input
            type="number"
            value={node.y}
            onChange={(event) =>
              onUpdateNode(node.node_id, (current) => ({
                ...current,
                y: Number(event.target.value) || 0,
              }))
            }
          />
        </label>
      </div>

      <label className="field">
        <span>Tags</span>
        <input
          type="text"
          value={tagsToString(node.tags)}
          placeholder="decision, landmark"
          onChange={(event) =>
            onUpdateNode(node.node_id, (current) => ({
              ...current,
              tags: parseTagsInput(event.target.value),
            }))
          }
        />
      </label>

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={node.enabled ?? true}
          onChange={(event) =>
            onUpdateNode(node.node_id, (current) => ({
              ...current,
              enabled: event.target.checked,
            }))
          }
        />
        <span>Enabled</span>
      </label>

      <label className="field">
        <span>Metadata JSON</span>
        <textarea
          rows={8}
          value={metadata.text}
          onChange={(event) =>
            metadata.update(event.target.value, (nextMetadata) =>
              onUpdateNode(node.node_id, (current) => ({
                ...current,
                metadata: nextMetadata,
              })),
            )
          }
          spellCheck={false}
        />
      </label>

      {metadata.error ? <p className="field-error">{metadata.error}</p> : null}

      <button type="button" className="danger-button full-width" onClick={onDeleteSelection}>
        Delete Node
      </button>
    </aside>
  )
}

function EdgeInspector({
  edge,
  nodes,
  onUpdateEdge,
  onDeleteSelection,
}: {
  edge: GraphEdge
  nodes: GraphNode[]
  onUpdateEdge: (edgeId: string, updater: (edge: GraphEdge) => GraphEdge) => void
  onDeleteSelection: () => void
}) {
  const metadata = useJsonEditor(edge.metadata)

  return (
    <aside className="panel property-panel">
      <div className="panel-heading">
        <p className="panel-kicker">Selection</p>
        <h2>Edge</h2>
      </div>

      <div className="field-group">
        <label className="field">
          <span>Edge ID</span>
          <input
            type="text"
            value={edge.edge_id}
            onChange={(event) =>
              onUpdateEdge(edge.edge_id, (current) => ({
                ...current,
                edge_id: event.target.value,
              }))
            }
          />
        </label>
        <label className="field">
          <span>From node</span>
          <select
            value={edge.from_node}
            onChange={(event) =>
              onUpdateEdge(edge.edge_id, (current) => ({
                ...current,
                from_node: event.target.value,
              }))
            }
          >
            {nodes.map((node) => (
              <option key={node.node_id} value={node.node_id}>
                {node.node_id}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>To node</span>
          <select
            value={edge.to_node}
            onChange={(event) =>
              onUpdateEdge(edge.edge_id, (current) => ({
                ...current,
                to_node: event.target.value,
              }))
            }
          >
            {nodes.map((node) => (
              <option key={node.node_id} value={node.node_id}>
                {node.node_id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="field-group geometry-grid">
        <label className="field">
          <span>Weight</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={edge.weight}
            onChange={(event) =>
              onUpdateEdge(edge.edge_id, (current) => ({
                ...current,
                weight: Number(event.target.value) || 1,
              }))
            }
          />
        </label>
        <label className="field">
          <span>Distance (m)</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={edge.distance_m ?? ''}
            onChange={(event) =>
              onUpdateEdge(edge.edge_id, (current) => ({
                ...current,
                distance_m: event.target.value ? Number(event.target.value) : null,
              }))
            }
          />
        </label>
        <label className="field">
          <span>Time (s)</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={edge.time_s ?? ''}
            onChange={(event) =>
              onUpdateEdge(edge.edge_id, (current) => ({
                ...current,
                time_s: event.target.value ? Number(event.target.value) : null,
              }))
            }
          />
        </label>
        <label className="field">
          <span>Accessibility</span>
          <input
            type="text"
            value={edge.accessibility ?? ''}
            onChange={(event) =>
              onUpdateEdge(edge.edge_id, (current) => ({
                ...current,
                accessibility: event.target.value || null,
              }))
            }
          />
        </label>
      </div>

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={edge.bidirectional}
          onChange={(event) =>
            onUpdateEdge(edge.edge_id, (current) => ({
              ...current,
              bidirectional: event.target.checked,
            }))
          }
        />
        <span>Bidirectional</span>
      </label>

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={edge.enabled ?? true}
          onChange={(event) =>
            onUpdateEdge(edge.edge_id, (current) => ({
              ...current,
              enabled: event.target.checked,
            }))
          }
        />
        <span>Enabled</span>
      </label>

      <label className="field">
        <span>Metadata JSON</span>
        <textarea
          rows={8}
          value={metadata.text}
          onChange={(event) =>
            metadata.update(event.target.value, (nextMetadata) =>
              onUpdateEdge(edge.edge_id, (current) => ({
                ...current,
                metadata: nextMetadata,
              })),
            )
          }
          spellCheck={false}
        />
      </label>

      {metadata.error ? <p className="field-error">{metadata.error}</p> : null}

      <button type="button" className="danger-button full-width" onClick={onDeleteSelection}>
        Delete Edge
      </button>
    </aside>
  )
}

export function PropertyPanel({
  dataset,
  selection,
  validation,
  onUpdateNode,
  onUpdateEdge,
  onDeleteSelection,
}: PropertyPanelProps) {
  if (!selection) {
    return (
      <aside className="panel property-panel">
        <div className="panel-heading">
          <p className="panel-kicker">Inspector</p>
          <h2>Dataset Summary</h2>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <span>Nodes</span>
            <strong>{dataset.nodes.length}</strong>
          </div>
          <div className="summary-card">
            <span>Edges</span>
            <strong>{dataset.edges.length}</strong>
          </div>
          <div className="summary-card">
            <span>Errors</span>
            <strong>{validation.errors.length}</strong>
          </div>
          <div className="summary-card">
            <span>Warnings</span>
            <strong>{validation.warnings.length}</strong>
          </div>
        </div>

        <div className="toolbar-note">
          <p className="section-title">Validation</p>
          {validation.errors.length === 0 && validation.warnings.length === 0 ? (
            <p>Dataset is valid and ready for JSON export.</p>
          ) : null}
          {validation.errors.map((entry) => (
            <p key={entry} className="validation-error">
              {entry}
            </p>
          ))}
          {validation.warnings.map((entry) => (
            <p key={entry} className="validation-warning">
              {entry}
            </p>
          ))}
        </div>

        <div className="toolbar-note">
          <p className="section-title">Editor Notes</p>
          <p>Use node mode for semantic anchors only. Avoid corridor spam nodes.</p>
          <p>Edges must keep explicit weight values even when precision is unknown.</p>
          <p>Background image is only a tracing reference and is not exported.</p>
        </div>
      </aside>
    )
  }

  if (selection.kind === 'node') {
    const node = dataset.nodes.find((entry) => entry.node_id === selection.id)
    if (!node) {
      return null
    }

    return (
      <NodeInspector
        key={node.node_id}
        node={node}
        onUpdateNode={onUpdateNode}
        onDeleteSelection={onDeleteSelection}
      />
    )
  }

  const edge = dataset.edges.find((entry) => entry.edge_id === selection.id)
  if (!edge) {
    return null
  }

  return (
    <EdgeInspector
      key={edge.edge_id}
      edge={edge}
      nodes={dataset.nodes}
      onUpdateEdge={onUpdateEdge}
      onDeleteSelection={onDeleteSelection}
    />
  )
}
