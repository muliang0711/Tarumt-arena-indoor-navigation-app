import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'

import {
  getNodeBadge,
  getNodeShape,
  getNodeStyle,
} from '../lib/graph'
import type {
  CanvasSize,
  EditorMode,
  GraphDataset,
  GraphEdge,
  GraphNode,
  Point,
  Selection,
} from '../types/graph'

interface GraphCanvasProps {
  canvasSize: CanvasSize
  dataset: GraphDataset
  selection: Selection | null
  mode: EditorMode
  pendingEdgeStartId: string | null
  pointerPosition: Point | null
  hoveredAnchor: Point | null
  latticeSpacing: number
  showGrid: boolean
  showBackground: boolean
  backgroundImageUrl: string | null
  zoom: number
  isPanning: boolean
  isSpacePressed: boolean
  svgRef: RefObject<SVGSVGElement | null>
  viewportRef: RefObject<HTMLDivElement | null>
  onCanvasPointerDown: (event: ReactPointerEvent<SVGRectElement>) => void
  onCanvasPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void
  onCanvasPointerLeave: () => void
  onAnchorPointerDown: (anchor: Point) => void
  onNodePointerDown: (
    nodeId: string,
    event: ReactPointerEvent<SVGGElement>,
  ) => void
  onEdgePointerDown: (
    edgeId: string,
    event: ReactPointerEvent<SVGGElement>,
  ) => void
}

function renderHelperGrid(spacing: number, canvasSize: CanvasSize) {
  const lines = []

  for (let x = 0; x <= canvasSize.width; x += spacing) {
    lines.push(
      <line
        key={`grid-x-${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={canvasSize.height}
      />,
    )
  }

  for (let y = 0; y <= canvasSize.height; y += spacing) {
    lines.push(
      <line
        key={`grid-y-${y}`}
        x1={0}
        y1={y}
        x2={canvasSize.width}
        y2={y}
      />,
    )
  }

  return <g className="helper-grid">{lines}</g>
}

function renderAnchorLattice(
  canvasSize: CanvasSize,
  spacing: number,
  mode: EditorMode,
  hoveredAnchor: Point | null,
  onAnchorPointerDown: (anchor: Point) => void,
) {
  const anchors = []

  for (let x = 0; x <= canvasSize.width; x += spacing) {
    for (let y = 0; y <= canvasSize.height; y += spacing) {
      const isHovered = hoveredAnchor?.x === x && hoveredAnchor?.y === y
      anchors.push(
        <g key={`anchor-${x}-${y}`} className="anchor-point">
          {isHovered ? (
            <circle
              cx={x}
              cy={y}
              r={11}
              className="anchor-point-hover-ring"
              pointerEvents="none"
            />
          ) : null}
          <circle
            cx={x}
            cy={y}
            r={isHovered ? 3.8 : 2.4}
            className={isHovered ? 'anchor-point-dot is-hovered' : 'anchor-point-dot'}
            pointerEvents="none"
          />
          <circle
            cx={x}
            cy={y}
            r={12}
            className="anchor-point-hit"
            pointerEvents={mode === 'addNode' ? 'all' : 'none'}
            onPointerDown={(event) => {
              event.stopPropagation()
              onAnchorPointerDown({ x, y })
            }}
          />
        </g>,
      )
    }
  }

  return <g className="anchor-lattice">{anchors}</g>
}

function edgeLabel(edge: GraphEdge) {
  return edge.bidirectional ? `w:${edge.weight}` : `w:${edge.weight} ->`
}

function nodeLabel(node: GraphNode) {
  return node.name || node.type
}

export function GraphCanvas({
  canvasSize,
  dataset,
  selection,
  mode,
  pendingEdgeStartId,
  pointerPosition,
  hoveredAnchor,
  latticeSpacing,
  showGrid,
  showBackground,
  backgroundImageUrl,
  zoom,
  isPanning,
  isSpacePressed,
  svgRef,
  viewportRef,
  onCanvasPointerDown,
  onCanvasPointerMove,
  onCanvasPointerLeave,
  onAnchorPointerDown,
  onNodePointerDown,
  onEdgePointerDown,
}: GraphCanvasProps) {
  const nodeLookup = new Map(dataset.nodes.map((node) => [node.node_id, node]))
  const canvasCursor = isPanning
    ? 'is-panning'
    : isSpacePressed
      ? 'is-pannable'
      : mode === 'addNode'
        ? 'is-draw-mode'
        : 'is-select-mode'

  return (
    <section className="panel canvas-panel">
      <div className="panel-heading">
        <p className="panel-kicker">Workspace</p>
        <h2>Graph Canvas</h2>
      </div>

      <div className="canvas-meta">
        <span>Canvas: {canvasSize.width} x {canvasSize.height}</span>
        <span>Lattice: {latticeSpacing}px</span>
        <span>Mode: {mode}</span>
        <span>Pending edge source: {pendingEdgeStartId ?? 'None'}</span>
      </div>

      <div ref={viewportRef} className={`canvas-viewport ${canvasCursor}`}>
        <svg
          ref={svgRef}
          className="graph-canvas"
          width={canvasSize.width * zoom}
          height={canvasSize.height * zoom}
          viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
          onPointerMove={onCanvasPointerMove}
          onPointerLeave={onCanvasPointerLeave}
        >
          <rect
            className="canvas-background"
            x={0}
            y={0}
            width={canvasSize.width}
            height={canvasSize.height}
            onPointerDown={onCanvasPointerDown}
          />

          {showBackground && backgroundImageUrl ? (
            <image
              href={backgroundImageUrl}
              x={0}
              y={0}
              width={canvasSize.width}
              height={canvasSize.height}
              preserveAspectRatio="xMidYMid meet"
              opacity={0.16}
              pointerEvents="none"
            />
          ) : null}

          {showGrid ? renderHelperGrid(latticeSpacing, canvasSize) : null}
          {renderAnchorLattice(
            canvasSize,
            latticeSpacing,
            mode,
            hoveredAnchor,
            onAnchorPointerDown,
          )}

          {dataset.edges.map((edge) => {
            const from = nodeLookup.get(edge.from_node)
            const to = nodeLookup.get(edge.to_node)
            if (!from || !to) {
              return null
            }

            const isSelected =
              selection?.kind === 'edge' && selection.id === edge.edge_id
            const midX = (from.x + to.x) / 2
            const midY = (from.y + to.y) / 2

            return (
              <g
                key={edge.edge_id}
                className={isSelected ? 'graph-edge is-selected' : 'graph-edge'}
                onPointerDown={(event) => onEdgePointerDown(edge.edge_id, event)}
              >
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={isSelected ? '#0f172a' : '#62718a'}
                  strokeWidth={isSelected ? 3.5 : 2.5}
                  strokeDasharray={edge.bidirectional ? undefined : '10 8'}
                  strokeLinecap="round"
                />
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="transparent"
                  strokeWidth={16}
                  strokeLinecap="round"
                />
                <rect
                  x={midX - 24}
                  y={midY - 12}
                  width={48}
                  height={22}
                  rx={9}
                  fill="rgba(255,255,255,0.94)"
                  stroke={isSelected ? '#0f172a' : 'rgba(100,116,139,0.4)'}
                  strokeWidth={1}
                />
                <text x={midX} y={midY + 4} textAnchor="middle" className="edge-label">
                  {edgeLabel(edge)}
                </text>
              </g>
            )
          })}

          {dataset.nodes.map((node) => {
            const style = getNodeStyle(node.type)
            const badge = getNodeBadge(node.type)
            const shape = getNodeShape(node.type)
            const isSelected =
              selection?.kind === 'node' && selection.id === node.node_id
            const isPendingStart = pendingEdgeStartId === node.node_id
            const markerSize = isSelected ? 34 : 30

            return (
              <g
                key={node.node_id}
                className={isSelected ? 'graph-node is-selected' : 'graph-node'}
                onPointerDown={(event) => onNodePointerDown(node.node_id, event)}
              >
                {isPendingStart ? (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={27}
                    fill="none"
                    stroke="#f59e0b"
                    strokeDasharray="8 6"
                    strokeWidth={2}
                    pointerEvents="none"
                  />
                ) : null}
                {shape === 'diamond' ? (
                  <rect
                    x={node.x - markerSize / 2}
                    y={node.y - markerSize / 2}
                    width={markerSize}
                    height={markerSize}
                    rx={4}
                    fill={style.fill}
                    stroke={isSelected ? '#111827' : style.stroke}
                    strokeWidth={isSelected ? 3 : 2}
                    transform={`rotate(45 ${node.x} ${node.y})`}
                  />
                ) : (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isSelected ? 18 : 15}
                    fill={style.fill}
                    stroke={isSelected ? '#111827' : style.stroke}
                    strokeWidth={isSelected ? 3 : 2}
                  />
                )}
                <text
                  x={node.x}
                  y={node.y + 4}
                  textAnchor="middle"
                  className="node-badge"
                  fill={style.text}
                >
                  {badge}
                </text>
                <text
                  x={node.x}
                  y={node.y + 34}
                  textAnchor="middle"
                  className="node-label"
                >
                  {nodeLabel(node)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="canvas-status">
        <span>
          Cursor:{' '}
          {pointerPosition
            ? `${Math.round(pointerPosition.x)}, ${Math.round(pointerPosition.y)}`
            : 'Outside canvas'}
        </span>
        <span>
          Hovered anchor:{' '}
          {hoveredAnchor ? `${hoveredAnchor.x}, ${hoveredAnchor.y}` : 'None'}
        </span>
        <span>Place nodes on anchor dots, then connect only walkable nodes with edges.</span>
      </div>
    </section>
  )
}
