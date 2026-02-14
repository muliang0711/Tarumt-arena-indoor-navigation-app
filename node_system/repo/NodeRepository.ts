/**
 * Node Repository
 *
 * Reads and provides access to the navigation graph data
 * from the mvp_system_data.json file.
 *
 * Uses the Node and Edge schemas for strict typing.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Node, Edge } from '../schema';

/**
 * Raw JSON structure of the data file
 */
interface SystemData {
    nodes: Node[];
    edges: Edge[];
}

/**
 * Adjacency list entry: which edges leave from a given node
 */
export interface AdjacencyEntry {
    edge: Edge;
    neighborId: string;
}

export class NodeRepository {
    private nodes: Map<string, Node> = new Map();
    private edges: Edge[] = [];
    private adjacencyList: Map<string, AdjacencyEntry[]> = new Map();

    constructor(dataFilePath?: string) {
        const filePath = dataFilePath || path.join(__dirname, '..', 'mvp_data', 'mvp_system_data.json');
        this.loadData(filePath);
    }

    /**
     * Load and parse the JSON data file into typed structures
     */
    private loadData(filePath: string): void {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data: SystemData = JSON.parse(raw);

        // Index nodes by node_id
        for (const node of data.nodes) {
            this.nodes.set(node.node_id, node);
        }

        this.edges = data.edges;

        // Build adjacency list
        for (const edge of data.edges) {
            // Forward direction: from_node -> to_node
            if (!this.adjacencyList.has(edge.from_node)) {
                this.adjacencyList.set(edge.from_node, []);
            }
            this.adjacencyList.get(edge.from_node)!.push({
                edge,
                neighborId: edge.to_node,
            });

            // Reverse direction (if bidirectional)
            if (edge.bidirectional) {
                if (!this.adjacencyList.has(edge.to_node)) {
                    this.adjacencyList.set(edge.to_node, []);
                }
                this.adjacencyList.get(edge.to_node)!.push({
                    edge,
                    neighborId: edge.from_node,
                });
            }
        }

        console.log(`[NodeRepository] Loaded ${this.nodes.size} nodes, ${this.edges.length} edges.`);
    }

    /**
     * Get a node by its ID
     */
    getNode(nodeId: string): Node | undefined {
        return this.nodes.get(nodeId);
    }

    /**
     * Get all nodes
     */
    getAllNodes(): Node[] {
        return Array.from(this.nodes.values());
    }

    /**
     * Get all edges
     */
    getAllEdges(): Edge[] {
        return this.edges;
    }

    /**
     * Get neighbors of a node (adjacency list)
     */
    getNeighbors(nodeId: string): AdjacencyEntry[] {
        return this.adjacencyList.get(nodeId) || [];
    }

    /**
     * Check if a node exists
     */
    hasNode(nodeId: string): boolean {
        return this.nodes.has(nodeId);
    }
}
