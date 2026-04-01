import { createGraphEdge, createGraphNode } from '../lib/graph'
import type { GraphDataset } from '../types/graph'

const nodes = [
  createGraphNode({ x: 180, y: 210 }, { floor_id: 1, type: 'entrance' }, []),
  createGraphNode({ x: 380, y: 210 }, { floor_id: 1, type: 'junction' }, []),
  createGraphNode({ x: 580, y: 210 }, { floor_id: 1, type: 'room' }, []),
  createGraphNode({ x: 380, y: 390 }, { floor_id: 1, type: 'toilet' }, []),
  createGraphNode({ x: 580, y: 390 }, { floor_id: 1, type: 'elevator' }, []),
  createGraphNode({ x: 780, y: 390 }, { floor_id: 1, type: 'stairs' }, []),
].map((node, index) => ({
  ...node,
  node_id: `N_${index + 1}`,
  name:
    index === 0
      ? 'Main Entrance'
      : index === 2
        ? 'Room 101'
        : index === 3
          ? 'Toilet'
          : index === 4
            ? 'Lift'
            : index === 5
              ? 'Stairs'
              : null,
  tags:
    index === 1
      ? ['decision']
      : index === 4
        ? ['vertical']
        : null,
}))

const edges = [
  createGraphEdge('N_1', 'N_2', { bidirectional: true, weight: 1 }, []),
  createGraphEdge('N_2', 'N_3', { bidirectional: true, weight: 1 }, []),
  createGraphEdge('N_2', 'N_4', { bidirectional: true, weight: 1 }, []),
  createGraphEdge('N_3', 'N_5', { bidirectional: true, weight: 1 }, []),
  createGraphEdge('N_5', 'N_6', { bidirectional: false, weight: 2 }, []),
].map((edge, index) => ({
  ...edge,
  edge_id: `E_${index + 1}`,
  accessibility: index === 4 ? 'stairs_only' : null,
}))

export const seedGraphDataset: GraphDataset = {
  nodes,
  edges,
}
