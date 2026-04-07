export interface GraphNode {
  node_id: string
  floor_id: number
  x: number
  y: number
  type: string
  name: string | null
  tags: string[]
  enabled: boolean
  metadata: Record<string, unknown>
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
  enabled: boolean
  metadata: Record<string, unknown>
}

export interface ParsedGraph {
  edges: GraphEdge[]
  floors: number[]
  nodeTypes: string[]
  nodes: GraphNode[]
  nodesById: Map<string, GraphNode>
}

export interface FloorGraph {
  edges: GraphEdge[]
  floorId: number
  nodeTypes: string[]
  nodes: GraphNode[]
  nodesById: Map<string, GraphNode>
}
