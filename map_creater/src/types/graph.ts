export const NODE_TYPE_OPTIONS = [
  'junction',
  'room',
  'toilet',
  'elevator',
  'stairs',
  'entrance',
  'exit',
] as const

export type PredefinedNodeType = (typeof NODE_TYPE_OPTIONS)[number]
export type NodeType = PredefinedNodeType | (string & {})
export type NodeTag = string

export interface GraphNode {
  node_id: string
  floor_id: number
  x: number
  y: number
  type: NodeType
  tags: NodeTag[] | null
  name: string | null
  enabled: boolean | null
  metadata: Record<string, unknown> | null
}

export interface GraphEdge {
  edge_id: string
  from_node: string
  to_node: string
  bidirectional: boolean
  weight: number
  distance_m: number | null
  time_s: number | null
  accessibility: string | null
  enabled: boolean | null
  metadata: Record<string, unknown> | null
}

export interface GraphDataset {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export type EditorMode = 'select' | 'addNode' | 'addEdge' | 'delete'

export interface Point {
  x: number
  y: number
}

export interface Selection {
  kind: 'node' | 'edge'
  id: string
}

export interface NodeDefaults {
  floor_id: number
  type: NodeType
}

export interface EdgeDefaults {
  bidirectional: boolean
  weight: number
}

export interface ValidationResult {
  errors: string[]
  warnings: string[]
}
