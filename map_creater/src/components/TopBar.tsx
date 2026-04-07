import type { CanvasSize, EditorMode } from '../types/graph'

interface TopBarProps {
  canvasSize: CanvasSize
  mode: EditorMode
  nodeCount: number
  edgeCount: number
  errorCount: number
  warningCount: number
  showGrid: boolean
  latticeSpacing: number
  showBackground: boolean
  hasBackground: boolean
  zoom: number
  onImportGraph: () => void
  onExportGraph: () => void
  onLoadSample: () => void
  onClearGraph: () => void
  onLoadBackground: () => void
  onRemoveBackground: () => void
  onToggleGrid: () => void
  onToggleBackground: () => void
  onLatticeSpacingChange: (spacing: number) => void
  onZoomChange: (zoom: number) => void
  onCanvasSizeChange: (size: CanvasSize) => void
  onAutoFitCanvas: () => void
}

export function TopBar({
  canvasSize,
  mode,
  nodeCount,
  edgeCount,
  errorCount,
  warningCount,
  showGrid,
  latticeSpacing,
  showBackground,
  hasBackground,
  zoom,
  onImportGraph,
  onExportGraph,
  onLoadSample,
  onClearGraph,
  onLoadBackground,
  onRemoveBackground,
  onToggleGrid,
  onToggleBackground,
  onLatticeSpacingChange,
  onZoomChange,
  onCanvasSizeChange,
  onAutoFitCanvas,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div>
        <p className="topbar-kicker">Navigation Graph Dataset Editor</p>
        <h1>Indoor Navigation FYP</h1>
      </div>

      <div className="topbar-actions">
        <div className="status-chip">
          <span className="status-chip-label">Mode</span>
          <strong>{mode}</strong>
        </div>
        <div className="status-chip">
          <span className="status-chip-label">Dataset</span>
          <strong>
            {nodeCount} nodes / {edgeCount} edges
          </strong>
        </div>
        <div className={errorCount > 0 ? 'status-chip is-danger' : 'status-chip'}>
          <span className="status-chip-label">Validation</span>
          <strong>
            {errorCount} errors / {warningCount} warnings
          </strong>
        </div>

        <label className="toggle-chip">
          <input type="checkbox" checked={showGrid} onChange={onToggleGrid} />
          <span>Helper Grid</span>
        </label>
        <label className="toggle-chip" aria-disabled={!hasBackground}>
          <input
            type="checkbox"
            checked={showBackground}
            onChange={onToggleBackground}
            disabled={!hasBackground}
          />
          <span>Background</span>
        </label>

        <label className="zoom-chip">
          <span>Lattice</span>
          <select
            value={latticeSpacing}
            onChange={(event) => onLatticeSpacingChange(Number(event.target.value))}
          >
            {[40, 50, 60, 80].map((spacing) => (
              <option key={spacing} value={spacing}>
                {spacing}px
              </option>
            ))}
          </select>
        </label>

        <label className="zoom-chip">
          <span>Zoom</span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={zoom}
            onChange={(event) => onZoomChange(Number(event.target.value))}
          />
          <strong>{Math.round(zoom * 100)}%</strong>
        </label>

        <label className="zoom-chip">
          <span>Width</span>
          <input
            type="number"
            min={400}
            step={50}
            value={canvasSize.width}
            onChange={(event) =>
              onCanvasSizeChange({
                ...canvasSize,
                width: Number(event.target.value) || canvasSize.width,
              })
            }
          />
        </label>

        <label className="zoom-chip">
          <span>Height</span>
          <input
            type="number"
            min={400}
            step={50}
            value={canvasSize.height}
            onChange={(event) =>
              onCanvasSizeChange({
                ...canvasSize,
                height: Number(event.target.value) || canvasSize.height,
              })
            }
          />
        </label>

        <button type="button" className="ghost-button" onClick={onImportGraph}>
          Import JSON
        </button>
        <button type="button" className="ghost-button" onClick={onExportGraph}>
          Export JSON
        </button>
        <button type="button" className="ghost-button" onClick={onLoadBackground}>
          Load Background
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={onRemoveBackground}
          disabled={!hasBackground}
        >
          Remove Background
        </button>
        <button type="button" className="ghost-button" onClick={onLoadSample}>
          Load Sample
        </button>
        <button type="button" className="ghost-button" onClick={onAutoFitCanvas}>
          Auto Fit Canvas
        </button>
        <button type="button" className="danger-button" onClick={onClearGraph}>
          Clear Graph
        </button>
      </div>
    </header>
  )
}
