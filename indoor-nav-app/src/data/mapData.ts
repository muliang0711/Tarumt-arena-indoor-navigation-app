// ═══════════════════════════════════════════════════════════════
//  Map Data — Load and pre-compute graph geometry
// ═══════════════════════════════════════════════════════════════

import rawData from './mvp_system_data.json';
import { NAV_CONFIG, CORRIDOR_HALF_WIDTH } from '../config/navigationConfig';
import type {
    RawGraphData,
    RawNode,
    EdgeGeometry,
    NodeAdjacency,
    ProcessedGraph,
    Point,
} from '../types';

const graphData = rawData as RawGraphData;

/**
 * Convert grid coordinates to meters
 */
function gridToMeters(x: number, y: number): Point {
    return {
        x: x * NAV_CONFIG.METERS_PER_GRID_UNIT,
        y: y * NAV_CONFIG.METERS_PER_GRID_UNIT,
    };
}

/**
 * Process raw graph data into navigation-ready format.
 * Pre-computes edge geometry (angles, lengths, direction vectors).
 */
export function processGraphData(): ProcessedGraph {
    // Build node map
    const nodes = new Map<string, RawNode>();
    for (const node of graphData.nodes) {
        nodes.set(node.node_id, node);
    }

    // Build edge geometry map
    const edges = new Map<string, EdgeGeometry>();
    for (const edge of graphData.edges) {
        const fromNode = nodes.get(edge.from_node);
        const toNode = nodes.get(edge.to_node);
        if (!fromNode || !toNode) {
            console.warn(`Edge ${edge.edge_id}: missing node(s)`);
            continue;
        }

        const p0 = gridToMeters(fromNode.x, fromNode.y);
        const p1 = gridToMeters(toNode.x, toNode.y);
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx); // radians, P0→P1

        edges.set(edge.edge_id, {
            edge_id: edge.edge_id,
            from_node: edge.from_node,
            to_node: edge.to_node,
            p0,
            p1,
            length,
            angle,
            direction: length > 0 ? { x: dx / length, y: dy / length } : { x: 0, y: 0 },
            halfWidth: CORRIDOR_HALF_WIDTH,
        });
    }

    // Build adjacency map: for each node, list of edge IDs
    const adjacency = new Map<string, NodeAdjacency>();
    for (const node of graphData.nodes) {
        adjacency.set(node.node_id, { node_id: node.node_id, edges: [] });
    }
    for (const edge of graphData.edges) {
        adjacency.get(edge.from_node)?.edges.push(edge.edge_id);
        if (edge.bidirectional) {
            adjacency.get(edge.to_node)?.edges.push(edge.edge_id);
        }
    }

    return { nodes, edges, adjacency };
}

/** Singleton processed graph */
let _graph: ProcessedGraph | null = null;

export function getGraph(): ProcessedGraph {
    if (!_graph) {
        _graph = processGraphData();
    }
    return _graph;
}

/**
 * Get the node at the other end of an edge, given one endpoint.
 */
export function getOtherNode(edge: EdgeGeometry, nodeId: string): string {
    return edge.from_node === nodeId ? edge.to_node : edge.from_node;
}

/**
 * Get all edges connected to a node (excluding a given edge).
 */
export function getAdjacentEdges(
    graph: ProcessedGraph,
    nodeId: string,
    excludeEdgeId?: string
): EdgeGeometry[] {
    const adj = graph.adjacency.get(nodeId);
    if (!adj) return [];
    return adj.edges
        .filter((eid) => eid !== excludeEdgeId)
        .map((eid) => graph.edges.get(eid)!)
        .filter(Boolean);
}

/** Raw data accessors */
export function getRawNodes(): RawNode[] {
    return graphData.nodes;
}
export function getRawEdges() {
    return graphData.edges;
}
