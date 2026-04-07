import type {
  CanvasSize,
  EdgeDefaults,
  GraphDataset,
  GraphEdge,
  GraphNode,
  NodeDefaults,
  NodeTag,
  Point,
  ValidationResult,
} from '../types/graph'

export const DEFAULT_CANVAS_WIDTH = 1600
export const DEFAULT_CANVAS_HEIGHT = 1000
export const DEFAULT_LATTICE_SPACING = 50
const AUTO_FIT_PADDING_STEPS = 4

type NodeVisualStyle = {
  fill: string
  stroke: string
  text: string
  badge: string
  shape: 'circle' | 'diamond'
}

export const nodeTypeStyles: Record<string, NodeVisualStyle> = {
  junction: { fill: '#eef2ff', stroke: '#3150a4', text: '#1e2d66', badge: 'JN', shape: 'circle' },
  room: { fill: '#d9f1ff', stroke: '#1d6f95', text: '#10384c', badge: 'RM', shape: 'circle' },
  toilet: { fill: '#dcfce7', stroke: '#2f855a', text: '#17402b', badge: 'WC', shape: 'circle' },
  elevator: { fill: '#fde7d3', stroke: '#a65f18', text: '#59320b', badge: 'EL', shape: 'circle' },
  stairs: { fill: '#ede9fe', stroke: '#6d28d9', text: '#40157d', badge: 'ST', shape: 'circle' },
  entrance: { fill: '#d1fae5', stroke: '#047857', text: '#064e3b', badge: 'EN', shape: 'circle' },
  exit: { fill: '#fee2e2', stroke: '#b42318', text: '#5b1b14', badge: 'EX', shape: 'circle' },
  not_walkable: {
    fill: '#1f2937',
    stroke: '#991b1b',
    text: '#fef2f2',
    badge: 'NW',
    shape: 'diamond',
  },
  default: { fill: '#e5e7eb', stroke: '#475569', text: '#1f2937', badge: 'ND', shape: 'circle' },
}

export function getNodeStyle(type: string) {
  return nodeTypeStyles[type] ?? nodeTypeStyles.default
}

export function getNodeBadge(type: string) {
  return getNodeStyle(type).badge
}

export function getNodeShape(type: string) {
  return getNodeStyle(type).shape
}

export function snapValue(value: number, gridSize: number, enabled: boolean) {
  if (!enabled) {
    return value
  }

  return Math.round(value / gridSize) * gridSize
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function clampCanvasSize(size: CanvasSize): CanvasSize {
  return {
    width: Math.max(400, Math.round(size.width)),
    height: Math.max(400, Math.round(size.height)),
  }
}

export function clampPoint(point: Point, canvasSize: CanvasSize): Point {
  return {
    x: clamp(point.x, 0, canvasSize.width),
    y: clamp(point.y, 0, canvasSize.height),
  }
}

export function normalizePoint(
  point: Point,
  gridSize: number,
  snapToGrid: boolean,
  canvasSize: CanvasSize,
): Point {
  return clampPoint({
    x: snapValue(point.x, gridSize, snapToGrid),
    y: snapValue(point.y, gridSize, snapToGrid),
  }, canvasSize)
}

export function getNearestAnchorPoint(
  point: Point,
  spacing: number,
  canvasSize: CanvasSize,
) {
  return normalizePoint(point, spacing, true, canvasSize)
}

export function isPointNearAnchor(
  point: Point,
  anchor: Point,
  spacing: number,
) {
  const threshold = Math.min(16, spacing * 0.32)
  return Math.hypot(point.x - anchor.x, point.y - anchor.y) <= threshold
}

export function getClientPointInSvg(
  svg: SVGSVGElement | null,
  clientX: number,
  clientY: number,
  canvasSize: CanvasSize,
): Point | null {
  if (!svg) {
    return null
  }

  const rect = svg.getBoundingClientRect()
  if (!rect.width || !rect.height) {
    return null
  }

  return {
    x: ((clientX - rect.left) / rect.width) * canvasSize.width,
    y: ((clientY - rect.top) / rect.height) * canvasSize.height,
  }
}

export function getAutoCanvasSize(
  nodes: GraphNode[],
  spacing: number,
): CanvasSize {
  const maxX = nodes.length > 0 ? Math.max(...nodes.map((node) => node.x)) : 0
  const maxY = nodes.length > 0 ? Math.max(...nodes.map((node) => node.y)) : 0
  const padding = spacing * AUTO_FIT_PADDING_STEPS

  return clampCanvasSize({
    width: Math.max(DEFAULT_CANVAS_WIDTH, snapValue(maxX + padding, spacing, true)),
    height: Math.max(DEFAULT_CANVAS_HEIGHT, snapValue(maxY + padding, spacing, true)),
  })
}

function getNextNumericId(existingIds: string[], prefix: string) {
  const next = existingIds.reduce((maxId, id) => {
    const match = id.match(new RegExp(`^${prefix}_(\\d+)$`))
    if (!match) {
      return maxId
    }

    return Math.max(maxId, Number(match[1]))
  }, 0)

  return `${prefix}_${next + 1}`
}

export function createGraphNode(
  point: Point,
  defaults: NodeDefaults,
  existingNodes: GraphNode[],
): GraphNode {
  return {
    node_id: getNextNumericId(
      existingNodes.map((node) => node.node_id),
      'N',
    ),
    floor_id: defaults.floor_id,
    x: point.x,
    y: point.y,
    type: defaults.type,
    tags: null,
    name: null,
    enabled: true,
    metadata: null,
  }
}

export function createGraphEdge(
  fromNode: string,
  toNode: string,
  defaults: EdgeDefaults,
  existingEdges: GraphEdge[],
): GraphEdge {
  return {
    edge_id: getNextNumericId(
      existingEdges.map((edge) => edge.edge_id),
      'E',
    ),
    from_node: fromNode,
    to_node: toNode,
    bidirectional: defaults.bidirectional,
    weight: defaults.weight,
    distance_m: null,
    time_s: null,
    accessibility: null,
    enabled: true,
    metadata: null,
  }
}

export function hasEdgeBetweenNodes(
  edges: GraphEdge[],
  firstNodeId: string,
  secondNodeId: string,
) {
  return edges.some(
    (edge) =>
      (edge.from_node === firstNodeId && edge.to_node === secondNodeId) ||
      (edge.from_node === secondNodeId && edge.to_node === firstNodeId),
  )
}

export function getAdjacentJunctionNodes(
  currentNode: GraphNode,
  nodes: GraphNode[],
  spacing: number,
) {
  if (currentNode.type === 'not_walkable' || currentNode.enabled === false) {
    return []
  }

  return nodes.filter((node) => {
    if (
      node.node_id === currentNode.node_id ||
      node.type !== 'junction' ||
      node.enabled === false ||
      node.floor_id !== currentNode.floor_id
    ) {
      return false
    }

    const horizontalNeighbor =
      node.y === currentNode.y && Math.abs(node.x - currentNode.x) === spacing
    const verticalNeighbor =
      node.x === currentNode.x && Math.abs(node.y - currentNode.y) === spacing

    return horizontalNeighbor || verticalNeighbor
  })
}

export function createAutoEdgesForAdjacentJunctions(
  currentNode: GraphNode,
  nodes: GraphNode[],
  edges: GraphEdge[],
  spacing: number,
  defaults: EdgeDefaults,
) {
  const autoEdges: GraphEdge[] = []

  getAdjacentJunctionNodes(currentNode, nodes, spacing).forEach((junctionNode) => {
    const nextEdgeList = [...edges, ...autoEdges]
    if (hasEdgeBetweenNodes(nextEdgeList, currentNode.node_id, junctionNode.node_id)) {
      return
    }

    autoEdges.push(
      createGraphEdge(
        currentNode.node_id,
        junctionNode.node_id,
        defaults,
        nextEdgeList,
      ),
    )
  })

  return autoEdges
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid "${field}".`)
  }

  return value
}

function asNumber(value: unknown, field: string) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Invalid "${field}".`)
  }

  return value
}

function asBoolean(value: unknown, field: string) {
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid "${field}".`)
  }

  return value
}

function asNullableBoolean(value: unknown) {
  if (value === null || value === undefined) {
    return true
  }

  if (typeof value !== 'boolean') {
    throw new Error('Invalid "enabled".')
  }

  return value
}

function asNullableString(value: unknown, field: string) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value !== 'string') {
    throw new Error(`Invalid "${field}".`)
  }

  return value
}

function asNullableNumber(value: unknown, field: string) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Invalid "${field}".`)
  }

  return value
}

function asNullableTags(value: unknown): NodeTag[] | null {
  if (value === null || value === undefined) {
    return null
  }

  if (!Array.isArray(value) || value.some((tag) => typeof tag !== 'string')) {
    throw new Error('Invalid "tags".')
  }

  return value
}

function asNullableMetadata(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  if (!isObject(value)) {
    throw new Error('Invalid "metadata".')
  }

  return value
}

export function normalizeNode(raw: Record<string, unknown>): GraphNode {
  return {
    node_id: asString(raw.node_id, 'node_id'),
    floor_id: asNumber(raw.floor_id, 'floor_id'),
    x: asNumber(raw.x, 'x'),
    y: asNumber(raw.y, 'y'),
    type: asString(raw.type, 'type'),
    tags: asNullableTags(raw.tags),
    name: asNullableString(raw.name, 'name'),
    enabled: asNullableBoolean(raw.enabled),
    metadata: asNullableMetadata(raw.metadata),
  }
}

export function normalizeEdge(raw: Record<string, unknown>): GraphEdge {
  return {
    edge_id: asString(raw.edge_id, 'edge_id'),
    from_node: asString(raw.from_node, 'from_node'),
    to_node: asString(raw.to_node, 'to_node'),
    bidirectional: asBoolean(raw.bidirectional, 'bidirectional'),
    weight: asNumber(raw.weight, 'weight'),
    distance_m: asNullableNumber(raw.distance_m, 'distance_m'),
    time_s: asNullableNumber(raw.time_s, 'time_s'),
    accessibility: asNullableString(raw.accessibility, 'accessibility'),
    enabled: asNullableBoolean(raw.enabled),
    metadata: asNullableMetadata(raw.metadata),
  }
}

export function validateGraphDataset(dataset: GraphDataset): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()
  const nodeConnectionCounts = new Map<string, number>()

  dataset.edges.forEach((edge) => {
    nodeConnectionCounts.set(
      edge.from_node,
      (nodeConnectionCounts.get(edge.from_node) ?? 0) + 1,
    )
    nodeConnectionCounts.set(
      edge.to_node,
      (nodeConnectionCounts.get(edge.to_node) ?? 0) + 1,
    )
  })

  dataset.nodes.forEach((node, index) => {
    const label = `Node ${index + 1}`
    if (!node.node_id.trim()) {
      errors.push(`${label}: node_id is required.`)
    }
    if (nodeIds.has(node.node_id)) {
      errors.push(`${label}: duplicate node_id "${node.node_id}".`)
    }
    nodeIds.add(node.node_id)
    if (Number.isNaN(node.floor_id)) {
      errors.push(`${label}: floor_id is required.`)
    }
    if (Number.isNaN(node.x) || Number.isNaN(node.y)) {
      errors.push(`${label}: x and y are required.`)
    }
    if (!node.type.trim()) {
      errors.push(`${label}: type is required.`)
    }
    if (node.type === 'not_walkable' && (nodeConnectionCounts.get(node.node_id) ?? 0) > 0) {
      warnings.push(
        `${label}: not_walkable nodes should not be connected to route edges.`,
      )
    }
    if (node.enabled === false) {
      warnings.push(`${label}: node is disabled.`)
    }
  })

  dataset.edges.forEach((edge, index) => {
    const label = `Edge ${index + 1}`
    if (!edge.edge_id.trim()) {
      errors.push(`${label}: edge_id is required.`)
    }
    if (edgeIds.has(edge.edge_id)) {
      errors.push(`${label}: duplicate edge_id "${edge.edge_id}".`)
    }
    edgeIds.add(edge.edge_id)
    if (!edge.from_node.trim()) {
      errors.push(`${label}: from_node is required.`)
    }
    if (!edge.to_node.trim()) {
      errors.push(`${label}: to_node is required.`)
    }
    if (typeof edge.bidirectional !== 'boolean') {
      errors.push(`${label}: bidirectional must be boolean.`)
    }
    if (typeof edge.weight !== 'number' || Number.isNaN(edge.weight)) {
      errors.push(`${label}: weight is required.`)
    }
    if (!nodeIds.has(edge.from_node)) {
      errors.push(`${label}: from_node "${edge.from_node}" does not exist.`)
    }
    if (!nodeIds.has(edge.to_node)) {
      errors.push(`${label}: to_node "${edge.to_node}" does not exist.`)
    }
    if (edge.enabled === false) {
      warnings.push(`${label}: edge is disabled.`)
    }
  })

  return { errors, warnings }
}

export function parseGraphDataset(value: unknown): GraphDataset {
  if (!isObject(value)) {
    throw new Error('Dataset must be an object.')
  }

  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    throw new Error('Dataset must contain "nodes" and "edges" arrays.')
  }

  const dataset: GraphDataset = {
    nodes: value.nodes.map((entry) => {
      if (!isObject(entry)) {
        throw new Error('Each node must be an object.')
      }

      return normalizeNode(entry)
    }),
    edges: value.edges.map((entry) => {
      if (!isObject(entry)) {
        throw new Error('Each edge must be an object.')
      }

      return normalizeEdge(entry)
    }),
  }

  const validation = validateGraphDataset(dataset)
  if (validation.errors.length > 0) {
    throw new Error(validation.errors.join('\n'))
  }

  return dataset
}

export function serializeGraphDataset(dataset: GraphDataset) {
  return JSON.stringify(dataset, null, 2)
}

export function tagsToString(tags: NodeTag[] | null) {
  return tags?.join(', ') ?? ''
}

export function parseTagsInput(raw: string): NodeTag[] | null {
  const tags = raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

  return tags.length > 0 ? tags : null
}
