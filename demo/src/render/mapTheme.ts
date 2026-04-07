export interface NodeRenderStyle {
  accent: string
  code: string
  fill: string
  label: string
  outline: string
}

const DEFAULT_STYLE: NodeRenderStyle = {
  accent: '#8ec0ff',
  code: 'ND',
  fill: '#3a506b',
  label: 'Node',
  outline: '#d4e3f8',
}

const STYLES: Record<string, NodeRenderStyle> = {
  elevator: {
    accent: '#8fb4ff',
    code: 'LF',
    fill: '#243c64',
    label: 'Elevator',
    outline: '#d6e3ff',
  },
  entrance: {
    accent: '#89f0cd',
    code: 'IN',
    fill: '#17453c',
    label: 'Entrance',
    outline: '#cff9eb',
  },
  exit: {
    accent: '#ff9f87',
    code: 'OUT',
    fill: '#5b2b25',
    label: 'Exit',
    outline: '#ffdcd3',
  },
  junction: {
    accent: '#c2d0de',
    code: 'JN',
    fill: '#324657',
    label: 'Junction',
    outline: '#e6edf5',
  },
  room: {
    accent: '#ffd279',
    code: 'RM',
    fill: '#5f4323',
    label: 'Room',
    outline: '#fff0c8',
  },
  stairs: {
    accent: '#c29cff',
    code: 'ST',
    fill: '#452a60',
    label: 'Stairs',
    outline: '#ecdfff',
  },
  toilet: {
    accent: '#78ecff',
    code: 'WC',
    fill: '#154c58',
    label: 'Toilet',
    outline: '#d3fbff',
  },
}

export const MAP_PALETTE = {
  background: '#0f1722',
  corridor: '#2f4a61',
  corridorEdge: '#d7e4f3',
  corridorShadow: '#12202d',
  floor: '#162331',
  floorAccent: '#203142',
  grid: '#213141',
  highlight: '#89f0cd',
  junction: '#3c617a',
  junctionAccent: '#eff6ff',
  label: '#f5f7fb',
  labelShadow: '#09111a',
  wall: '#0a1119',
}

export function getNodeRenderStyle(type: string): NodeRenderStyle {
  return STYLES[type] ?? DEFAULT_STYLE
}
