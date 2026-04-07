import type { FloorGraph, GraphEdge, GraphNode } from '../types/graph'
import type {
  MarkerSide,
  SceneData,
  SceneMarker,
  SceneRoute,
  SceneTile,
  TilePoint,
} from '../types/scene'

const GRID_PADDING = 6
const TILE_SIZE = 16

interface ProjectedNode {
  col: number
  connections: GraphNode[]
  degree: number
  node: GraphNode
  row: number
}

export function buildScene(graph: FloorGraph): SceneData {
  const projectedNodes = projectNodes(graph)
  const routes = buildRoutes(graph.edges, projectedNodes)
  const markers = buildMarkers(graph.nodes, projectedNodes, routes)
  const tiles = buildTiles(graph.nodes, projectedNodes, routes)

  return normalizeScene(graph.floorId, graph.nodes, projectedNodes, routes, markers, tiles)
}

function projectNodes(graph: FloorGraph): Map<string, ProjectedNode> {
  const projected = new Map<string, ProjectedNode>()
  const degreeMap = new Map<string, number>()
  const neighbors = new Map<string, Set<string>>()

  for (const edge of graph.edges) {
    degreeMap.set(edge.from_node, (degreeMap.get(edge.from_node) ?? 0) + 1)
    degreeMap.set(edge.to_node, (degreeMap.get(edge.to_node) ?? 0) + 1)

    if (!neighbors.has(edge.from_node)) {
      neighbors.set(edge.from_node, new Set())
    }

    if (!neighbors.has(edge.to_node)) {
      neighbors.set(edge.to_node, new Set())
    }

    neighbors.get(edge.from_node)?.add(edge.to_node)
    neighbors.get(edge.to_node)?.add(edge.from_node)
  }

  const xs = graph.nodes.map((node) => node.x)
  const ys = graph.nodes.map((node) => node.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = Math.max(maxX - minX, 1)
  const spanY = Math.max(maxY - minY, 1)
  const aspect = spanX / spanY
  const densityBase = clamp(28 + graph.nodes.length * 3, 38, 92)
  const gridWidth = clamp(Math.round(densityBase * Math.max(aspect, 0.75)), 36, 116)
  const gridHeight = clamp(
    Math.round(densityBase / Math.max(aspect, 0.75)),
    28,
    96,
  )
  const occupied = new Set<string>()

  for (const node of graph.nodes) {
    const desiredCol = mapToGrid(node.x, minX, maxX, gridWidth)
    const desiredRow = mapToGrid(node.y, minY, maxY, gridHeight)
    const position = findOpenPosition(desiredCol, desiredRow, occupied, gridWidth, gridHeight)
    const linkedNodes = [...(neighbors.get(node.node_id) ?? [])]
      .map((nodeId) => graph.nodesById.get(nodeId))
      .filter((entry): entry is GraphNode => Boolean(entry))

    projected.set(node.node_id, {
      col: position.col,
      connections: linkedNodes,
      degree: degreeMap.get(node.node_id) ?? 0,
      node,
      row: position.row,
    })
    occupied.add(tileKey(position.col, position.row))
  }

  return projected
}

function buildRoutes(
  edges: GraphEdge[],
  projectedNodes: Map<string, ProjectedNode>,
): SceneRoute[] {
  const occupancy = new Map<string, number>()

  return [...edges]
    .sort((left, right) => {
      const leftDistance = Math.abs((projectedNodes.get(left.from_node)?.col ?? 0) - (projectedNodes.get(left.to_node)?.col ?? 0)) +
        Math.abs((projectedNodes.get(left.from_node)?.row ?? 0) - (projectedNodes.get(left.to_node)?.row ?? 0))
      const rightDistance = Math.abs((projectedNodes.get(right.from_node)?.col ?? 0) - (projectedNodes.get(right.to_node)?.col ?? 0)) +
        Math.abs((projectedNodes.get(right.from_node)?.row ?? 0) - (projectedNodes.get(right.to_node)?.row ?? 0))

      return rightDistance - leftDistance
    })
    .map((edge) => {
      const fromNode = projectedNodes.get(edge.from_node)
      const toNode = projectedNodes.get(edge.to_node)

      if (!fromNode || !toNode) {
        return {
          bidirectional: edge.bidirectional,
          edgeId: edge.edge_id,
          enabled: edge.enabled,
          fromNode: edge.from_node,
          points: [],
          tiles: [],
          toNode: edge.to_node,
        }
      }

      const route = routeEdge(edge, fromNode, toNode, occupancy, projectedNodes)

      for (const tile of route.tiles) {
        const key = tileKey(tile.col, tile.row)
        occupancy.set(key, (occupancy.get(key) ?? 0) + 1)
      }

      return route
    })
}

function routeEdge(
  edge: GraphEdge,
  fromNode: ProjectedNode,
  toNode: ProjectedNode,
  occupancy: Map<string, number>,
  anchors: Map<string, ProjectedNode>,
): SceneRoute {
  const start = { col: fromNode.col, row: fromNode.row }
  const end = { col: toNode.col, row: toNode.row }

  if (start.col === end.col || start.row === end.row) {
    return {
      bidirectional: edge.bidirectional,
      edgeId: edge.edge_id,
      enabled: edge.enabled,
      fromNode: edge.from_node,
      points: [start, end],
      tiles: rasterizePoints([start, end]),
      toNode: edge.to_node,
    }
  }

  const candidateA = [start, { col: end.col, row: start.row }, end]
  const candidateB = [start, { col: start.col, row: end.row }, end]
  const routeA = rasterizePoints(candidateA)
  const routeB = rasterizePoints(candidateB)
  const scoreA = scoreRoute(routeA, occupancy, anchors, edge)
  const scoreB = scoreRoute(routeB, occupancy, anchors, edge)
  const useA = scoreA <= scoreB

  return {
    bidirectional: edge.bidirectional,
    edgeId: edge.edge_id,
    enabled: edge.enabled,
    fromNode: edge.from_node,
    points: useA ? candidateA : candidateB,
    tiles: useA ? routeA : routeB,
    toNode: edge.to_node,
  }
}

function scoreRoute(
  route: TilePoint[],
  occupancy: Map<string, number>,
  anchors: Map<string, ProjectedNode>,
  edge: GraphEdge,
): number {
  let score = 0

  for (const tile of route) {
    const key = tileKey(tile.col, tile.row)
    score += occupancy.has(key) ? 0.5 : 1

    for (const anchor of anchors.values()) {
      const isEndpoint =
        anchor.node.node_id === edge.from_node || anchor.node.node_id === edge.to_node

      if (!isEndpoint && anchor.col === tile.col && anchor.row === tile.row) {
        score += 18
      }
    }
  }

  return score
}

function buildMarkers(
  nodes: GraphNode[],
  projectedNodes: Map<string, ProjectedNode>,
  routes: SceneRoute[],
): SceneMarker[] {
  const occupancy = new Set<string>()

  for (const route of routes) {
    for (const tile of route.tiles) {
      occupancy.add(tileKey(tile.col, tile.row))
    }
  }

  const markers: SceneMarker[] = []

  for (const node of nodes) {
    const projected = projectedNodes.get(node.node_id)
    if (!projected || node.type === 'junction') {
      continue
    }

    const size = getMarkerSize(node.type)
    const placement = placeMarker(node, projected, size.width, size.height, occupancy)

    markers.push({
      anchorCol: projected.col,
      anchorRow: projected.row,
      col: placement.col,
      enabled: node.enabled,
      floorId: node.floor_id,
      height: size.height,
      metadata: node.metadata,
      name: node.name,
      nodeId: node.node_id,
      row: placement.row,
      side: placement.side,
      tags: node.tags,
      title: node.name ?? node.node_id,
      type: node.type,
      width: size.width,
    })

    for (let row = placement.row; row < placement.row + size.height; row += 1) {
      for (let col = placement.col; col < placement.col + size.width; col += 1) {
        occupancy.add(tileKey(col, row))
      }
    }
  }

  return markers
}

function placeMarker(
  node: GraphNode,
  projected: ProjectedNode,
  width: number,
  height: number,
  occupancy: Set<string>,
): { col: number; row: number; side: MarkerSide } {
  const sidePriority = getPlacementPriority(node, projected)

  for (const side of sidePriority) {
    const position = markerPosition(projected.col, projected.row, width, height, side)

    if (canOccupy(position.col, position.row, width, height, occupancy, projected)) {
      return {
        col: position.col,
        row: position.row,
        side,
      }
    }
  }

  const fallback = markerPosition(projected.col, projected.row, width, height, 'right')
  return {
    col: fallback.col,
    row: fallback.row,
    side: 'right',
  }
}

function canOccupy(
  col: number,
  row: number,
  width: number,
  height: number,
  occupancy: Set<string>,
  projected: ProjectedNode,
): boolean {
  for (let nextRow = row; nextRow < row + height; nextRow += 1) {
    for (let nextCol = col; nextCol < col + width; nextCol += 1) {
      if (nextCol === projected.col && nextRow === projected.row) {
        continue
      }

      if (occupancy.has(tileKey(nextCol, nextRow))) {
        return false
      }
    }
  }

  return true
}

function getPlacementPriority(node: GraphNode, projected: ProjectedNode): MarkerSide[] {
  if (node.type === 'entrance' || node.type === 'exit') {
    const horizontal = projected.col < projected.connections.length * 2 + 18 ? 'left' : 'right'
    return horizontal === 'left'
      ? ['left', 'up', 'down', 'right']
      : ['right', 'down', 'up', 'left']
  }

  if (isFrontFacingStructure(node.type)) {
    return ['up', 'left', 'right', 'down']
  }

  const neighborBias = projected.connections.reduce(
    (accumulator, connection) => {
      accumulator.dx += connection.x - projected.node.x
      accumulator.dy += connection.y - projected.node.y
      return accumulator
    },
    { dx: 0, dy: 0 },
  )

  if (Math.abs(neighborBias.dx) >= Math.abs(neighborBias.dy)) {
    return projected.row % 2 === 0
      ? ['up', 'down', 'right', 'left']
      : ['down', 'up', 'left', 'right']
  }

  return projected.col % 2 === 0
    ? ['left', 'right', 'up', 'down']
    : ['right', 'left', 'down', 'up']
}

function buildTiles(
  nodes: GraphNode[],
  projectedNodes: Map<string, ProjectedNode>,
  routes: SceneRoute[],
): Map<string, SceneTile> {
  const tiles = new Map<string, SceneTile>()

  for (const route of routes) {
    for (const tile of route.tiles) {
      const key = tileKey(tile.col, tile.row)
      const current = tiles.get(key)

      if (current) {
        current.edgeIds.push(route.edgeId)
      } else {
        tiles.set(key, {
          col: tile.col,
          edgeIds: [route.edgeId],
          kind: 'corridor',
          nodeIds: [],
          row: tile.row,
        })
      }
    }
  }

  for (const node of nodes) {
    const projected = projectedNodes.get(node.node_id)
    if (!projected) {
      continue
    }

    const key = tileKey(projected.col, projected.row)
    const current = tiles.get(key)
    const isJunction = node.type === 'junction' || projected.degree > 2

    if (current) {
      current.kind = isJunction ? 'junction' : current.kind
      current.nodeIds.push(node.node_id)
    } else {
      tiles.set(key, {
        col: projected.col,
        edgeIds: [],
        kind: isJunction ? 'junction' : 'corridor',
        nodeIds: [node.node_id],
        row: projected.row,
      })
    }
  }

  return tiles
}

function normalizeScene(
  floorId: number,
  nodes: GraphNode[],
  projectedNodes: Map<string, ProjectedNode>,
  routes: SceneRoute[],
  markers: SceneMarker[],
  tiles: Map<string, SceneTile>,
): SceneData {
  const usedCols: number[] = []
  const usedRows: number[] = []

  for (const tile of tiles.values()) {
    usedCols.push(tile.col)
    usedRows.push(tile.row)
  }

  for (const marker of markers) {
    usedCols.push(marker.col, marker.col + marker.width - 1)
    usedRows.push(marker.row, marker.row + marker.height - 1)
  }

  const minCol = Math.min(...usedCols, 0) - 4
  const minRow = Math.min(...usedRows, 0) - 4
  const shiftedTiles = new Map<string, SceneTile>()

  for (const tile of tiles.values()) {
    const shiftedTile = {
      ...tile,
      col: tile.col - minCol,
      row: tile.row - minRow,
    }

    shiftedTiles.set(tileKey(shiftedTile.col, shiftedTile.row), shiftedTile)
  }

  const shiftedRoutes = routes.map((route) => ({
    ...route,
    points: route.points.map((point) => ({
      col: point.col - minCol,
      row: point.row - minRow,
    })),
    tiles: route.tiles.map((point) => ({
      col: point.col - minCol,
      row: point.row - minRow,
    })),
  }))

  const shiftedMarkers = markers.map((marker) => ({
    ...marker,
    anchorCol: marker.anchorCol - minCol,
    anchorRow: marker.anchorRow - minRow,
    col: marker.col - minCol,
    row: marker.row - minRow,
  }))

  const anchors = nodes
    .map((node) => projectedNodes.get(node.node_id))
    .filter((entry): entry is ProjectedNode => Boolean(entry))
    .map((entry) => ({
      col: entry.col - minCol,
      node: entry.node,
      row: entry.row - minRow,
    }))

  const maxCol = Math.max(
    ...[...shiftedTiles.values()].map((tile) => tile.col),
    ...shiftedMarkers.map((marker) => marker.col + marker.width),
    24,
  )
  const maxRow = Math.max(
    ...[...shiftedTiles.values()].map((tile) => tile.row),
    ...shiftedMarkers.map((marker) => marker.row + marker.height),
    18,
  )

  return {
    anchors,
    floorId,
    height: (maxRow + 4) * TILE_SIZE,
    markers: shiftedMarkers,
    routes: shiftedRoutes,
    tileLookup: shiftedTiles,
    tileSize: TILE_SIZE,
    tiles: [...shiftedTiles.values()],
    width: (maxCol + 4) * TILE_SIZE,
  }
}

function rasterizePoints(points: TilePoint[]): TilePoint[] {
  const tiles: TilePoint[] = []

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]

    if (start.col === end.col) {
      const direction = start.row <= end.row ? 1 : -1
      for (let row = start.row; row !== end.row + direction; row += direction) {
        if (!tiles.some((tile) => tile.col === start.col && tile.row === row)) {
          tiles.push({ col: start.col, row })
        }
      }
    } else {
      const direction = start.col <= end.col ? 1 : -1
      for (let col = start.col; col !== end.col + direction; col += direction) {
        if (!tiles.some((tile) => tile.col === col && tile.row === start.row)) {
          tiles.push({ col, row: start.row })
        }
      }
    }
  }

  return tiles
}

function findOpenPosition(
  col: number,
  row: number,
  occupied: Set<string>,
  width: number,
  height: number,
): TilePoint {
  if (!occupied.has(tileKey(col, row))) {
    return { col, row }
  }

  for (let radius = 1; radius < 10; radius += 1) {
    for (let offsetRow = -radius; offsetRow <= radius; offsetRow += 1) {
      for (let offsetCol = -radius; offsetCol <= radius; offsetCol += 1) {
        const nextCol = clamp(col + offsetCol, GRID_PADDING, width - GRID_PADDING)
        const nextRow = clamp(row + offsetRow, GRID_PADDING, height - GRID_PADDING)

        if (!occupied.has(tileKey(nextCol, nextRow))) {
          return {
            col: nextCol,
            row: nextRow,
          }
        }
      }
    }
  }

  return { col, row }
}

function mapToGrid(value: number, min: number, max: number, span: number): number {
  if (min === max) {
    return Math.round(span / 2)
  }

  const ratio = (value - min) / (max - min)
  return Math.round(GRID_PADDING + ratio * (span - GRID_PADDING * 2))
}

function markerPosition(
  anchorCol: number,
  anchorRow: number,
  width: number,
  height: number,
  side: MarkerSide,
): TilePoint {
  if (side === 'up') {
    return { col: anchorCol - Math.floor(width / 2), row: anchorRow - height }
  }

  if (side === 'down') {
    return { col: anchorCol - Math.floor(width / 2), row: anchorRow + 1 }
  }

  if (side === 'left') {
    return { col: anchorCol - width, row: anchorRow - Math.floor(height / 2) }
  }

  return { col: anchorCol + 1, row: anchorRow - Math.floor(height / 2) }
}

function getMarkerSize(type: string): { height: number; width: number } {
  if (type === 'room') {
    return { height: 5, width: 6 }
  }

  if (type === 'entrance' || type === 'exit') {
    return { height: 4, width: 4 }
  }

  if (type === 'toilet' || type === 'stairs' || type === 'elevator') {
    return { height: 5, width: 4 }
  }

  return { height: 4, width: 4 }
}

function tileKey(col: number, row: number): string {
  return `${col},${row}`
}

function isFrontFacingStructure(type: string): boolean {
  return type === 'room' || type === 'toilet' || type === 'stairs' || type === 'elevator'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
