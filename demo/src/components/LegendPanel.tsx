import { getNodeRenderStyle } from '../render/mapTheme'

interface LegendPanelProps {
  nodeTypes: string[]
}

export function LegendPanel({ nodeTypes }: LegendPanelProps) {
  if (nodeTypes.length === 0) {
    return null
  }

  return (
    <section className="sidebar-card">
      <div className="card-header">
        <p className="card-kicker">Legend</p>
        <h2>Pixel Tiles</h2>
      </div>

      <div className="legend-list">
        {nodeTypes.map((type) => {
          const style = getNodeRenderStyle(type)

          return (
            <div className="legend-item" key={type}>
              <span
                className="legend-swatch"
                style={{
                  background: style.fill,
                  boxShadow: `inset 0 2px 0 ${style.outline}, inset 0 -2px 0 #09111a`,
                }}
              />
              <div>
                <strong>{style.label}</strong>
                <span>{style.code}</span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
