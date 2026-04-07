import type { FloorGraph, GraphEdge, GraphNode, ParsedGraph } from '../types/graph'

interface RawGraphNode {
  enabled?: boolean | null
  floor_id: number | string
  metadata?: Record<string, unknown> | null
  name?: string | null
  node_id: string
  tags?: string[] | null
  type: string
  x: number
  y: number
}

interface RawGraphEdge {
  accessibility?: string | null
  bidirectional: boolean
  distance_m?: number | null
  edge_id: string
  enabled?: boolean | null
  from_node: string
  metadata?: Record<string, unknown> | null
  time_s?: number | null
  to_node: string
  weight: number
}

const EMPTY_OBJECT = {}

export function parseGraphText(text: string): ParsedGraph {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error(
      error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON.',
    )
  }

  return normalizeGraph(parsed)
}

export function filterGraphByFloor(
  graph: ParsedGraph,
  floorId: number | null,
): FloorGraph | null {
  if (floorId === null) {
    return null
  }

  const nodes = graph.nodes.filter((node) => node.floor_id === floorId)
  const nodesById = new Map<string, GraphNode>()

  for (const node of nodes) {
    nodesById.set(node.node_id, node)
  }

  const edges = graph.edges.filter(
    (edge) => nodesById.has(edge.from_node) && nodesById.has(edge.to_node),
  )

  return {
    edges,
    floorId,
    nodeTypes: [...new Set(nodes.map((node) => node.type))].sort(),
    nodes,
    nodesById,
  }
}

function normalizeGraph(input: unknown): ParsedGraph {
  if (!isRecord(input)) {
    throw new Error('Graph payload must be an object with nodes and edges arrays.')
  }

  if (!Array.isArray(input.nodes) || !Array.isArray(input.edges)) {
    throw new Error('Graph payload must contain both "nodes" and "edges" arrays.')
  }

  const nodes = input.nodes.map(normalizeNode)
  const nodesById = new Map<string, GraphNode>()

  for (const node of nodes) {
    if (nodesById.has(node.node_id)) {
      throw new Error(`Duplicate node_id "${node.node_id}" found in the graph.`)
    }

    nodesById.set(node.node_id, node)
  }

  const edges = input.edges.map((entry, index) => normalizeEdge(entry, index))

  for (const edge of edges) {
    if (!nodesById.has(edge.from_node) || !nodesById.has(edge.to_node)) {
      throw new Error(
        `Edge "${edge.edge_id}" references missing nodes (${edge.from_node} -> ${edge.to_node}).`,
      )
    }
  }

  return {
    edges,
    floors: [...new Set(nodes.map((node) => node.floor_id))].sort((a, b) => a - b),
    nodeTypes: [...new Set(nodes.map((node) => node.type))].sort(),
    nodes,
    nodesById,
  }
}

function normalizeNode(input: unknown): GraphNode {
  if (!isRecord(input)) {
    throw new Error('Every node entry must be an object.')
  }

  const node = input as Partial<RawGraphNode>
  const nodeId = readString(node.node_id, 'node_id')

  return {
    enabled: node.enabled !== false,
    floor_id: readFloorId(node.floor_id, `node.floor_id (${nodeId})`),
    metadata: readMetadata(node.metadata),
    name: typeof node.name === 'string' ? node.name : null,
    node_id: nodeId,
    tags: Array.isArray(node.tags)
      ? node.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    type: readString(node.type, `node.type (${nodeId})`),
    x: readNumber(node.x, `node.x (${nodeId})`),
    y: readNumber(node.y, `node.y (${nodeId})`),
  }
}

function normalizeEdge(input: unknown, index: number): GraphEdge {
  if (!isRecord(input)) {
    throw new Error('Every edge entry must be an object.')
  }

  const edge = input as Partial<RawGraphEdge>
  const edgeId = readString(edge.edge_id, `edges[${index}].edge_id`)

  return {
    accessibility:
      typeof edge.accessibility === 'string' ? edge.accessibility : null,
    bidirectional:
      typeof edge.bidirectional === 'boolean' ? edge.bidirectional : true,
    distance_m:
      typeof edge.distance_m === 'number' ? edge.distance_m : null,
    edge_id: edgeId,
    enabled: edge.enabled !== false,
    from_node: readString(edge.from_node, `edge.from_node (${edgeId})`),
    metadata: readMetadata(edge.metadata),
    time_s: typeof edge.time_s === 'number' ? edge.time_s : null,
    to_node: readString(edge.to_node, `edge.to_node (${edgeId})`),
    weight: readNumber(edge.weight, `edge.weight (${edgeId})`),
  }
}

function readFloorId(value: unknown, fieldName: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0 && !Number.isNaN(Number(value))) {
    return Number(value)
  }

  throw new Error(`"${fieldName}" must be a number.`)
}

function readString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`"${fieldName}" must be a non-empty string.`)
  }

  return value
}

function readNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`"${fieldName}" must be a valid number.`)
  }

  return value
}

function readMetadata(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : EMPTY_OBJECT
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
