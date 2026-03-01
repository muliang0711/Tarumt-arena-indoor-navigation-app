// ═══════════════════════════════════════════════════════════════
//  Navigation Engine — Now backed by Particle Filter v1
//
//  External API is unchanged. Internally delegates to PF.
// ═══════════════════════════════════════════════════════════════

import { NAV_CONFIG } from '../config/navigationConfig';
import { getGraph } from '../data/mapData';
import { ParticleFilter, type PFState } from './ParticleFilter';
import type {
    NavState,
    ProcessedGraph,
    EdgeGeometry,
    Point,
} from '../types';

export class NavigationEngine {
    private graph: ProcessedGraph;
    private pf: ParticleFilter;
    private state: NavState;
    private stepCount: number = 0;
    private lastPFState: PFState | null = null;

    constructor() {
        this.graph = getGraph();
        this.pf = new ParticleFilter(this.graph);
        this.state = this.createEmptyState();
    }

    // ── Path Management ─────────────────────────────────────────

    setPlannedPath(edgeIds: string[]): void {
        this.pf.setPlannedPath(edgeIds);
    }

    clearPlannedPath(): void {
        this.pf.clearPlannedPath();
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
     * Spawns PF particles spread across adjacent edges.
     */
    initializeAtNode(nodeId: string): boolean {
        // Find preferred first edge (on path if possible)
        const adj = this.graph.adjacency.get(nodeId);
        if (!adj || adj.edges.length === 0) return false;

        let preferredEdge: string | undefined;
        for (const eid of adj.edges) {
            // will be set if path is already loaded
            preferredEdge = eid; // default to first
            break;
        }

        const ok = this.pf.initialize(nodeId, preferredEdge);
        if (!ok) return false;

        this.stepCount = 0;

        // Compute initial state from PF
        const node = this.graph.nodes.get(nodeId);
        if (node) {
            const scale = NAV_CONFIG.METERS_PER_GRID_UNIT;
            this.state = {
                currentEdgeId: adj.edges[0],
                s: 0,
                d: 0,
                direction: 1,
                heading: 0,
                stepCount: 0,
                position: { x: node.x * scale, y: node.y * scale },
                nearNode: nodeId,
                initialized: true,
            };
        }

        return true;
    }

    /**
     * Initialize at a specific edge and position.
     * For PF, we init at the nearest node then propagate.
     */
    initializeAtEdge(edgeId: string, s: number, heading: number): boolean {
        const edge = this.graph.edges.get(edgeId);
        if (!edge) return false;

        // Init at the closer node
        const nodeId = s < edge.length / 2 ? edge.from_node : edge.to_node;
        return this.initializeAtNode(nodeId);
    }

    // ── Core: Process a Step ────────────────────────────────────

    processStep(stepLength: number, heading: number): NavState {
        if (!this.state.initialized) return this.state;

        this.stepCount++;

        // Run PF update
        const pfState = this.pf.update(stepLength, heading);
        this.lastPFState = pfState;

        // Convert PF output to NavState
        const bestEdge = this.graph.edges.get(pfState.bestEdgeId);
        const dir: 1 | -1 = bestEdge
            ? (Math.cos(pfState.heading - bestEdge.angle) >= 0 ? 1 : -1)
            : 1;

        this.state = {
            currentEdgeId: pfState.bestEdgeId,
            s: pfState.bestS,
            d: 0,
            direction: dir,
            heading: pfState.heading,
            stepCount: this.stepCount,
            position: pfState.position,
            nearNode: pfState.nearNode,
            initialized: true,
        };

        return { ...this.state };
    }

    // ── Core: Handle Turn ──────────────────────────────────────

    handleTurn(deltaYaw: number, heading: number): NavState {
        if (!this.state.initialized) return this.state;

        // PF handles turns by injecting explorer particles
        this.pf.handleTurnEvent(heading);

        return { ...this.state };
    }

    // ── Getters ────────────────────────────────────────────────

    getState(): NavState { return { ...this.state }; }
    isInitialized(): boolean { return this.state.initialized; }
    getCurrentEdge(): EdgeGeometry | undefined {
        return this.graph.edges.get(this.state.currentEdgeId);
    }
    getGraphData(): ProcessedGraph { return this.graph; }

    /** PF-specific: get particle data for debug visualization */
    getParticles() { return this.pf.getParticles(); }
    getLastPFState() { return this.lastPFState; }
}
