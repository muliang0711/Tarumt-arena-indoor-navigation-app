/**
 * Pathfinding Service
 *
 * Provides two pathfinding strategies:
 * 1. BFS (Breadth-First Search) - Unweighted, hop-based. For MVP.
 * 2. Dijkstra - Weighted, distance-based. For future use when distance_m is populated.
 *
 * All inputs/outputs use the schema types.
 */

import { Node } from '../schema';
import { NodeRepository } from '../repo/NodeRepository';

/**
 * Result of a pathfinding operation
 */
export interface PathResult {
    /** Ordered list of nodes from start to end */
    path: Node[];
    /** Total cost (hops for BFS, meters for Dijkstra) */
    totalCost: number;
    /** Which algorithm was used */
    algorithmUsed: 'BFS' | 'Dijkstra';
}

export class PathfindingService {
    private repo: NodeRepository;

    constructor(repo: NodeRepository) {
        this.repo = repo;
    }

    /**
     * BFS - Breadth-First Search (Unweighted)
     *
     * Finds the path with the fewest hops (edges).
     * Use this when distance_m is not available.
     */
    findPathBFS(startId: string, endId: string): PathResult {
        this.validateNodes(startId, endId);

        // Track visited nodes and their parent for path reconstruction
        const visited = new Set<string>();
        const parent = new Map<string, string>();
        const queue: string[] = [startId];
        visited.add(startId);

        while (queue.length > 0) {
            const current = queue.shift()!;

            if (current === endId) {
                // Reconstruct path
                const path = this.reconstructPath(parent, startId, endId);
                return {
                    path,
                    totalCost: path.length - 1, // Number of hops
                    algorithmUsed: 'BFS',
                };
            }

            for (const neighbor of this.repo.getNeighbors(current)) {
                if (!visited.has(neighbor.neighborId)) {
                    visited.add(neighbor.neighborId);
                    parent.set(neighbor.neighborId, current);
                    queue.push(neighbor.neighborId);
                }
            }
        }

        throw new Error(`No path found from "${startId}" to "${endId}".`);
    }

    /**
     * Dijkstra - Weighted Shortest Path
     *
     * Finds the path with the lowest total distance_m.
     * Falls back to edge weight if distance_m is null.
     */
    findPathDijkstra(startId: string, endId: string): PathResult {
        this.validateNodes(startId, endId);

        const dist = new Map<string, number>();
        const parent = new Map<string, string>();
        const visited = new Set<string>();

        // Initialize all distances to Infinity
        for (const node of this.repo.getAllNodes()) {
            dist.set(node.node_id, Infinity);
        }
        dist.set(startId, 0);

        while (true) {
            // Find the unvisited node with smallest distance (simple approach)
            let current: string | null = null;
            let minDist = Infinity;

            for (const [nodeId, d] of dist) {
                if (!visited.has(nodeId) && d < minDist) {
                    minDist = d;
                    current = nodeId;
                }
            }

            if (current === null) {
                break; // No more reachable unvisited nodes
            }

            if (current === endId) {
                // Found shortest path
                const path = this.reconstructPath(parent, startId, endId);
                return {
                    path,
                    totalCost: dist.get(endId)!,
                    algorithmUsed: 'Dijkstra',
                };
            }

            visited.add(current);

            for (const neighbor of this.repo.getNeighbors(current)) {
                if (visited.has(neighbor.neighborId)) continue;

                // Use distance_m if available, otherwise fall back to weight
                const edgeCost = neighbor.edge.distance_m ?? neighbor.edge.weight;
                const newDist = dist.get(current)! + edgeCost;

                if (newDist < (dist.get(neighbor.neighborId) ?? Infinity)) {
                    dist.set(neighbor.neighborId, newDist);
                    parent.set(neighbor.neighborId, current);
                }
            }
        }

        throw new Error(`No path found from "${startId}" to "${endId}".`);
    }

    /**
     * Validate that both node IDs exist in the graph
     */
    private validateNodes(startId: string, endId: string): void {
        if (!this.repo.hasNode(startId)) {
            throw new Error(`Start node "${startId}" does not exist.`);
        }
        if (!this.repo.hasNode(endId)) {
            throw new Error(`End node "${endId}" does not exist.`);
        }
        if (startId === endId) {
            throw new Error(`Start and end nodes are the same ("${startId}").`);
        }
    }

    /**
     * Reconstruct the path from parent map
     */
    private reconstructPath(parent: Map<string, string>, startId: string, endId: string): Node[] {
        const nodeIds: string[] = [];
        let current: string | undefined = endId;

        while (current !== undefined) {
            nodeIds.unshift(current);
            if (current === startId) break;
            current = parent.get(current);
        }

        // Convert node IDs to full Node objects
        return nodeIds.map(id => {
            const node = this.repo.getNode(id);
            if (!node) throw new Error(`Node "${id}" not found during path reconstruction.`);
            return node;
        });
    }
}
