import { getLayoutPrefabCatalog } from '../render/manualLayoutCatalog'
import type { LayoutPrefabId } from '../types/layout'

interface LayoutStudioProps {
  activeFloor: number | null
  editorEnabled: boolean
  exportText: string
  itemCount: number
  selectedPrefabId: LayoutPrefabId
  onClearFloor: () => void
  onCopyExport: () => void
  onToggleEditor: () => void
  onSelectPrefab: (prefabId: LayoutPrefabId) => void
}

export function LayoutStudio({
  activeFloor,
  editorEnabled,
  exportText,
  itemCount,
  selectedPrefabId,
  onClearFloor,
  onCopyExport,
  onToggleEditor,
  onSelectPrefab,
}: LayoutStudioProps) {
  const prefabs = getLayoutPrefabCatalog()

  return (
    <section className="sidebar-card layout-card">
      <div className="card-header">
        <div>
          <p className="card-kicker">Layout Studio</p>
          <h2>Manual Placement</h2>
        </div>
        <button
          aria-pressed={editorEnabled}
          className={`toggle-button ${editorEnabled ? 'is-active' : ''}`}
          type="button"
          onClick={onToggleEditor}
        >
          {editorEnabled ? 'Edit On' : 'Edit Off'}
        </button>
      </div>

      <div className="stats-grid layout-stats">
        <article>
          <span>Floor</span>
          <strong>{activeFloor ?? 'N/A'}</strong>
        </article>
        <article>
          <span>Placed</span>
          <strong>{itemCount}</strong>
        </article>
      </div>

      <p className="layout-help">
        Turn edit mode on and drag the existing houses or facilities on the map to move them.
        The exported JSON includes both manual prefab items and moved scene-marker positions.
      </p>

      <div className="prefab-grid">
        {prefabs.map((prefab) => (
          <button
            key={prefab.id}
            className={`prefab-chip ${selectedPrefabId === prefab.id ? 'is-active' : ''}`}
            type="button"
            onClick={() => onSelectPrefab(prefab.id)}
          >
            {prefab.label}
          </button>
        ))}
      </div>

      <div className="layout-actions">
        <button className="button" type="button" onClick={onCopyExport}>
          Copy Layout JSON
        </button>
        <button className="button" type="button" onClick={onClearFloor}>
          Clear Floor
        </button>
      </div>

      <pre className="layout-export">{exportText}</pre>
    </section>
  )
}
