// ═══════════════════════════════════════════════════════════════
//  Navigation Engine — Corridor Constraint + Turn-Based Edge Switching
//
//  Core algorithm:
//  1. User position is parameterized as (edge_id, s, d) instead of free (x,y)
//  2. PDR steps are projected onto the current edge direction
//  3. Lateral drift is clamped to corridor width
//  4. Edge switching only allowed at nodes, scored by heading alignment
// ═══════════════════════════════════════════════════════════════

import { NAV_CONFIG, CORRIDOR_HALF_WIDTH, SIGMA_RAD } from '../config/navigationConfig';
import { getGraph, getAdjacentEdges, getOtherNode } from '../data/mapData';
import { wrapAngle } from '../services/SensorService';
import type {
    NavState,
    ProcessedGraph,
    EdgeGeometry,
    Point,
} from '../types';

export class NavigationEngine {
    private graph: ProcessedGraph;
    private state: NavState;

    constructor() {
        this.graph = getGraph();
        this.state = this.createEmptyState();
    }

    // ── Initialization ──────────────────────────────────────────

    private createEmptyState(): NavState {
        return {
            currentEdgeId: '',
            s: 0,
            d: 0,
            direction: 1,
            heading: 0,
            stepCount: 0,
            position: { x: 0, y: 0 },
            nearNode: null,
            initialized: false,
        };
    }

    /**
     * Initialize navigation at a specific node.
     * Picks the first connected edge and places user at the node position.
     */
    initializeAtNode(nodeId: string): boolean {
        const adj = this.graph.adjacency.get(nodeId);
        if (!adj || adj.edges.length === 0) {
            console.warn(`Cannot init at node ${nodeId}: no adjacent edges`);
            return false;
        }

        const edgeId = adj.edges[0];
        const edge = this.graph.edges.get(edgeId);
        if (!edge) return false;

        // Determine s: if node is from_node, s=0; if to_node, s=L
        const isFromNode = edge.from_node === nodeId;
        const s = isFromNode ? 0 : edge.length;

        this.state = {
            currentEdgeId: edgeId,
            s,
            d: 0,
            direction: isFromNode ? 1 : -1,
            heading: isFromNode ? edge.angle : wrapAngle(edge.angle + Math.PI),
            stepCount: 0,
            position: this.computePosition(edge, s, 0),
            nearNode: nodeId,
            initialized: true,
        };

        return true;
    }

    /**
     * Initialize at a specific edge and position
     */
    initializeAtEdge(edgeId: string, s: number, heading: number): boolean {
        const edge = this.graph.edges.get(edgeId);
        if (!edge) return false;

        this.state = {
            currentEdgeId: edgeId,
            s: clamp(s, 0, edge.length),
            d: 0,
            direction: 1,
            heading,
            stepCount: 0,
            position: this.computePosition(edge, s, 0),
            nearNode: null,
            initialized: true,
        };

        return true;
    }

    // ── Core: Process a Step ────────────────────────────────────

    /**
     * Process a single step from PDR.
     * Projects step onto current edge and clamps to corridor.
     * 
     * @param stepLength  Step distance in meters
     * @param heading     Current heading in radians
     */
    processStep(stepLength: number, heading: number): NavState {
        if (!this.state.initialized) return this.state;

        const edge = this.graph.edges.get(this.state.currentEdgeId);
        if (!edge) return this.state;

        this.state.heading = heading;
        this.state.stepCount++;

        // Calculate edge direction angle considering walk direction
        const edgeAngle = this.state.direction === 1 ? edge.angle : wrapAngle(edge.angle + Math.PI);

        // Project step onto edge direction
        const angleDiff = wrapAngle(heading - edgeAngle);
        const deltaS = stepLength * Math.cos(angleDiff) * this.state.direction;
        const deltaD = stepLength * Math.sin(angleDiff);

        // Update along-edge position (clamped to [0, L])
        this.state.s = clamp(this.state.s + deltaS, 0, edge.length);

        // Update lateral offset (clamped to corridor width)
        this.state.d = clamp(
            this.state.d + deltaD,
            -CORRIDOR_HALF_WIDTH,
            CORRIDOR_HALF_WIDTH
        );

        // Check node proximity
        this.state.nearNode = this.checkNodeProximity(edge);

        // Update world position
        this.state.position = this.computePosition(edge, this.state.s, this.state.d);

        return { ...this.state };
    }

    // ── Core: Handle Turn (Edge Switching) ──────────────────────

    /**
     * Handle a detected turn event.
     * Only switches edge if currently near a node.
     * Scores candidate edges by heading alignment.
     * 
     * @param deltaYaw  The yaw change that triggered the turn (radians)
     * @param heading   Current heading after the turn (radians)
     * @returns The new state (edge may have changed)
     */
    handleTurn(deltaYaw: number, heading: number): NavState {
        if (!this.state.initialized || !this.state.nearNode) {
            // Not near a node — ignore turn, stay on current edge
            return { ...this.state };
        }

        const nodeId = this.state.nearNode;
        const currentEdge = this.graph.edges.get(this.state.currentEdgeId);
        if (!currentEdge) return { ...this.state };

        // Get candidate edges (adjacent to this node, excluding current)
        const candidates = getAdjacentEdges(this.graph, nodeId, this.state.currentEdgeId);
        if (candidates.length === 0) return { ...this.state };

        // Score each candidate by heading alignment
        this.state.heading = heading;
        const scored = candidates.map((candidateEdge) => {
            // Determine the angle FROM this node along the candidate edge
            const isFrom = candidateEdge.from_node === nodeId;
            const candidateAngle = isFrom
                ? candidateEdge.angle
                : wrapAngle(candidateEdge.angle + Math.PI);

            const angleDiff = wrapAngle(heading - candidateAngle);
            const score = Math.exp(-(angleDiff * angleDiff) / (2 * SIGMA_RAD * SIGMA_RAD));

            return { edge: candidateEdge, angle: candidateAngle, score, isFrom };
        });

        // Also score the current edge (staying on it)
        const currentIsFrom = currentEdge.from_node === nodeId;
        const currentAngle = currentIsFrom
            ? currentEdge.angle
            : wrapAngle(currentEdge.angle + Math.PI);
        const currentAngleDiff = wrapAngle(heading - currentAngle);
        const currentScore = Math.exp(
            -(currentAngleDiff * currentAngleDiff) / (2 * SIGMA_RAD * SIGMA_RAD)
        );

        // Find best candidate
        scored.sort((a, b) => b.score - a.score);
        const best = scored[0];

        // Switch only if best candidate scores higher than staying on current edge
        if (best && best.score > currentScore) {
            const newEdge = best.edge;
            const newIsFrom = best.isFrom;

            this.state.currentEdgeId = newEdge.edge_id;
            this.state.s = newIsFrom ? 0 : newEdge.length;
            this.state.d = 0; // Reset lateral offset on edge switch
            this.state.direction = newIsFrom ? 1 : -1;
            this.state.position = this.computePosition(
                newEdge,
                this.state.s,
                this.state.d
            );
        }

        return { ...this.state };
    }

    // ── Position Computation ────────────────────────────────────

    /**
     * Compute world position from edge parameterization.
     * Position = P0 + s * direction + d * normal
     */
    private computePosition(edge: EdgeGeometry, s: number, d: number): Point {
        // Position along centerline
        const t = edge.length > 0 ? s / edge.length : 0;
        const cx = edge.p0.x + (edge.p1.x - edge.p0.x) * t;
        const cy = edge.p0.y + (edge.p1.y - edge.p0.y) * t;

        // Add lateral offset (perpendicular to edge direction)
        // Normal is (-dy, dx) of the direction vector
        const nx = -edge.direction.y;
        const ny = edge.direction.x;

        return {
            x: cx + d * nx,
            y: cy + d * ny,
        };
    }

    // ── Node Proximity Check ────────────────────────────────────

    /**
     * Check if current position is near a node endpoint.
     * Returns node_id if near, null otherwise.
     */
    private checkNodeProximity(edge: EdgeGeometry): string | null {
        const threshold = NAV_CONFIG.NODE_PROXIMITY_THRESHOLD;

        if (this.state.s < threshold) {
            return edge.from_node;
        }
        if (edge.length - this.state.s < threshold) {
            return edge.to_node;
        }
        return null;
    }

    // ── Getters ─────────────────────────────────────────────────

    getState(): NavState {
        return { ...this.state };
    }

    isInitialized(): boolean {
        return this.state.initialized;
    }

    getCurrentEdge(): EdgeGeometry | undefined {
        return this.graph.edges.get(this.state.currentEdgeId);
    }

    getGraphData(): ProcessedGraph {
        return this.graph;
    }
}

// ── Math Helpers ──────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
