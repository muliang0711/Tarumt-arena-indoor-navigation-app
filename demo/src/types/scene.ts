import type { GraphNode } from './graph'

export type MarkerSide = 'down' | 'left' | 'right' | 'up'

export interface TilePoint {
  col: number
  row: number
}

export interface SceneTile {
  col: number
  edgeIds: string[]
  kind: 'corridor' | 'junction'
  nodeIds: string[]
  row: number
}

export interface SceneRoute {
  bidirectional: boolean
  edgeId: string
  enabled: boolean
  fromNode: string
  points: TilePoint[]
  tiles: TilePoint[]
  toNode: string
}

export interface SceneMarker {
  anchorCol: number
  anchorRow: number
  col: number
  enabled: boolean
  floorId: number
  height: number
  metadata: Record<string, unknown>
  name: string | null
  nodeId: string
  row: number
  side: MarkerSide
  tags: string[]
  title: string
  type: string
  width: number
}

export interface SceneNodeAnchor {
  col: number
  node: GraphNode
  row: number
}

export interface SceneData {
  anchors: SceneNodeAnchor[]
  floorId: number
  height: number
  markers: SceneMarker[]
  routes: SceneRoute[]
  tileLookup: Map<string, SceneTile>
  tileSize: number
  tiles: SceneTile[]
  width: number
}
