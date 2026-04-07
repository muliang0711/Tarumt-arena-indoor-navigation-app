interface ControlBarProps {
  activeFloor: number | null
  fileName: string
  floors: number[]
  isLoadingSample: boolean
  renderMode: 'debug' | 'presentation'
  showLabels: boolean
  onClearSelection: () => void
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void
  onFitMap: () => void
  onFloorChange: (floorId: number | null) => void
  onLoadSample: () => void
  onModeToggle: () => void
  onToggleLabels: () => void
}

export function ControlBar({
  activeFloor,
  fileName,
  floors,
  isLoadingSample,
  renderMode,
  showLabels,
  onClearSelection,
  onFileSelect,
  onFitMap,
  onFloorChange,
  onLoadSample,
  onModeToggle,
  onToggleLabels,
}: ControlBarProps) {
  return (
    <header className="control-bar">
      <div className="brand-block">
        <p className="eyebrow">Canvas Indoor Wayfinding</p>
        <h1>Pixel Map Renderer</h1>
      </div>

      <div className="toolbar-cluster">
        <label className="button button-primary file-button">
          <input accept=".json,application/json" type="file" onChange={onFileSelect} />
          Load JSON
        </label>

        <button
          className="button"
          disabled={isLoadingSample}
          type="button"
          onClick={onLoadSample}
        >
          {isLoadingSample ? 'Loading…' : 'Load Sample'}
        </button>

        <button className="button" type="button" onClick={onFitMap}>
          Fit Map
        </button>

        <button className="button" type="button" onClick={onClearSelection}>
          Reset Focus
        </button>

        <label className="select-wrap">
          <span>Floor</span>
          <select
            value={activeFloor ?? ''}
            onChange={(event) =>
              onFloorChange(event.target.value ? Number(event.target.value) : null)
            }
          >
            {floors.map((floorId) => (
              <option key={floorId} value={floorId}>
                Floor {floorId}
              </option>
            ))}
          </select>
        </label>

        <button
          aria-pressed={showLabels}
          className={`toggle-button ${showLabels ? 'is-active' : ''}`}
          type="button"
          onClick={onToggleLabels}
        >
          Labels
        </button>

        <button
          aria-pressed={renderMode === 'debug'}
          className={`toggle-button ${renderMode === 'debug' ? 'is-active' : ''}`}
          type="button"
          onClick={onModeToggle}
        >
          {renderMode === 'debug' ? 'Debug' : 'Presentation'}
        </button>

        <div className="file-pill" title={fileName}>
          <span>Dataset</span>
          <strong>{fileName}</strong>
        </div>
      </div>
    </header>
  )
}
