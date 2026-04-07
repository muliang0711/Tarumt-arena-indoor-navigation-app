import type { GraphNode } from '../types/graph'
import { getNodeRenderStyle } from '../render/mapTheme'

interface DetailsPanelProps {
  activeFloor: number | null
  hoveredNode: GraphNode | null
  renderMode: 'debug' | 'presentation'
  selectedNode: GraphNode | null
  tileCount: number
  visibleEdgeCount: number
  visibleNodeCount: number
}

export function DetailsPanel({
  activeFloor,
  hoveredNode,
  renderMode,
  selectedNode,
  tileCount,
  visibleEdgeCount,
  visibleNodeCount,
}: DetailsPanelProps) {
  const focusNode = selectedNode ?? hoveredNode
  const style = focusNode ? getNodeRenderStyle(focusNode.type) : null

  return (
    <section className="sidebar-card details-card">
      <div className="card-header">
        <p className="card-kicker">
          {selectedNode ? 'Selected Node' : hoveredNode ? 'Hover Preview' : 'Map Summary'}
        </p>
        <h2>{focusNode?.name ?? focusNode?.node_id ?? 'Indoor Scene'}</h2>
      </div>

      <div className="stats-grid">
        <article>
          <span>Floor</span>
          <strong>{activeFloor ?? 'N/A'}</strong>
        </article>
        <article>
          <span>Nodes</span>
          <strong>{visibleNodeCount}</strong>
        </article>
        <article>
          <span>Edges</span>
          <strong>{visibleEdgeCount}</strong>
        </article>
        <article>
          <span>Tiles</span>
          <strong>{tileCount}</strong>
        </article>
        <article>
          <span>Mode</span>
          <strong>{renderMode}</strong>
        </article>
      </div>

      {focusNode ? (
        <div className="details-body">
          {style ? (
            <div className="type-pill" style={{ background: style.fill, color: style.outline }}>
              {style.label}
            </div>
          ) : null}

          <dl className="details-list">
            <div>
              <dt>Node ID</dt>
              <dd>{focusNode.node_id}</dd>
            </div>
            <div>
              <dt>Coordinates</dt>
              <dd>
                {Math.round(focusNode.x)}, {Math.round(focusNode.y)}
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{focusNode.enabled ? 'Enabled' : 'Disabled'}</dd>
            </div>
            <div>
              <dt>Tags</dt>
              <dd>{focusNode.tags.length > 0 ? focusNode.tags.join(', ') : 'None'}</dd>
            </div>
          </dl>

          {Object.keys(focusNode.metadata).length > 0 ? (
            <div className="details-section">
              <h3>Metadata</h3>
              <dl className="meta-list">
                {Object.entries(focusNode.metadata).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{formatValue(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="empty-details">
          <p>The renderer converts topology into corridor tiles, junctions, and anchored facility blocks.</p>
          <p>Use debug mode to inspect route centerlines and raw node anchors.</p>
        </div>
      )}
    </section>
  )
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return JSON.stringify(value)
}
