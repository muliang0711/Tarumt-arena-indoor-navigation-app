// ═══════════════════════════════════════════════════════════════
//  Pathfinder — Local Dijkstra shortest path on the graph
// ═══════════════════════════════════════════════════════════════

import { getGraph } from '../data/mapData';
import type { ProcessedGraph, EdgeGeometry } from '../types';

export interface PathResult {
    /** Ordered list of node IDs from start to end */
    nodeIds: string[];
    /** Ordered list of edge IDs along the path */
    edgeIds: string[];
    /** Total path distance in meters */
    totalDistance: number;
}

/**
 * Find shortest path between two nodes using Dijkstra's algorithm.
 * Uses edge length (meters) as the cost.
 */
export function findShortestPath(
    startNodeId: string,
    endNodeId: string
): PathResult | null {
    const graph = getGraph();

    // Validate nodes exist
    if (!graph.nodes.has(startNodeId) || !graph.nodes.has(endNodeId)) {
        return null;
    }
    if (startNodeId === endNodeId) {
        return { nodeIds: [startNodeId], edgeIds: [], totalDistance: 0 };
    }

    // Build adjacency list: nodeId -> Array<{ neighborId, edgeId, cost }>
    const adj = new Map<string, Array<{ neighborId: string; edgeId: string; cost: number }>>();
    for (const node of graph.nodes.values()) {
        adj.set(node.node_id, []);
    }
    for (const edge of graph.edges.values()) {
        const cost = edge.length;
        adj.get(edge.from_node)?.push({ neighborId: edge.to_node, edgeId: edge.edge_id, cost });
        // Bidirectional (all edges in our data are bidirectional)
        adj.get(edge.to_node)?.push({ neighborId: edge.from_node, edgeId: edge.edge_id, cost });
    }

    // Dijkstra
    const dist = new Map<string, number>();
    const prev = new Map<string, { nodeId: string; edgeId: string } | null>();
    const visited = new Set<string>();

    for (const nodeId of graph.nodes.keys()) {
        dist.set(nodeId, Infinity);
        prev.set(nodeId, null);
    }
    dist.set(startNodeId, 0);

    while (true) {
        // Find unvisited node with smallest distance
        let minDist = Infinity;
        let current: string | null = null;
        for (const [nodeId, d] of dist.entries()) {
            if (!visited.has(nodeId) && d < minDist) {
                minDist = d;
                current = nodeId;
            }
        }

        if (current === null || current === endNodeId) break;
        visited.add(current);

        const neighbors = adj.get(current) || [];
        for (const { neighborId, edgeId, cost } of neighbors) {
            if (visited.has(neighborId)) continue;
            const newDist = minDist + cost;
            if (newDist < (dist.get(neighborId) ?? Infinity)) {
                dist.set(neighborId, newDist);
                prev.set(neighborId, { nodeId: current, edgeId });
            }
        }
    }

    // Reconstruct path
    if (dist.get(endNodeId) === Infinity) {
        return null; // No path found
    }

    const nodeIds: string[] = [];
    const edgeIds: string[] = [];
    let cursor: string | null = endNodeId;

    while (cursor !== null) {
        nodeIds.unshift(cursor);
        const prevEntry = prev.get(cursor);
        if (prevEntry) {
            edgeIds.unshift(prevEntry.edgeId);
            cursor = prevEntry.nodeId;
        } else {
            cursor = null;
        }
    }

    return {
        nodeIds,
        edgeIds,
        totalDistance: dist.get(endNodeId) ?? 0,
    };
}

/**
 * Get the edge geometries for a path result, in order.
 */
export function getPathEdges(pathResult: PathResult): EdgeGeometry[] {
    const graph = getGraph();
    return pathResult.edgeIds
        .map((eid) => graph.edges.get(eid))
        .filter(Boolean) as EdgeGeometry[];
}
