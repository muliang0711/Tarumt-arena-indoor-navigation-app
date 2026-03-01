// ═══════════════════════════════════════════════════════════════
//  Particle Filter v1 — Multi-hypothesis corridor navigation
//
//  Solves three problems:
//  1) No deadlock at forks  — particles spread across all branches
//  2) Wrong-edge recovery   — correct-edge particles gain weight,
//                              wrong ones die in resampling
//  3) Off-path tolerance    — path bonus is soft (×3), not hard
//
//  Inputs: step events, heading, turn events, planned path
//  No magnetometer required.
// ═══════════════════════════════════════════════════════════════

import { NAV_CONFIG, SIGMA_RAD } from '../config/navigationConfig';
import { wrapAngle } from '../services/SensorService';
import type { ProcessedGraph, EdgeGeometry, Point } from '../types';

// ── Particle State ──────────────────────────────────────────

export interface Particle {
    edgeId: string;
    s: number;          // [0, edgeLength] along the edge
    direction: 1 | -1;  // +1 = heading P0→P1, −1 = heading P1→P0
    heading: number;     // this particle's heading estimate (rad)
    weight: number;
}

// ── PF Output ───────────────────────────────────────────────

export interface PFState {
    /** Edge with the highest total particle weight */
    bestEdgeId: string;
    /** Weighted mean s on the best edge */
    bestS: number;
    /** Weighted mean heading across all particles */
    heading: number;
    /** Weighted centroid position in world (meters) */
    position: Point;
    /** Node ID if best position is near a node, else null */
    nearNode: string | null;
    /** Effective sample size (for debug) */
    nEff: number;
    /** Per-edge weight distribution (for debug) */
    edgeWeights: Map<string, number>;
}

// ═══════════════════════════════════════════════════════════════
//  ParticleFilter Class
// ═══════════════════════════════════════════════════════════════

export class ParticleFilter {
    private particles: Particle[] = [];
    private graph: ProcessedGraph;
    private pathEdgeIds: Set<string> = new Set();
    private N: number;

    constructor(graph: ProcessedGraph) {
        this.graph = graph;
        this.N = NAV_CONFIG.PF_NUM_PARTICLES;
    }

    // ── Path ────────────────────────────────────────────────────

    setPlannedPath(edgeIds: string[]): void {
        this.pathEdgeIds = new Set(edgeIds);
    }

    clearPlannedPath(): void {
        this.pathEdgeIds.clear();
    }

    // ── Initialization ──────────────────────────────────────────

    /**
     * Spawn N particles at a node, spread across adjacent edges
     * with slight heading noise for diversity.
     */
    initialize(nodeId: string, preferredEdgeId?: string): boolean {
        const adj = this.graph.adjacency.get(nodeId);
        if (!adj || adj.edges.length === 0) return false;

        const edges = adj.edges
            .map(eid => this.graph.edges.get(eid))
            .filter(Boolean) as EdgeGeometry[];

        this.particles = [];
        const perEdge = Math.ceil(this.N / edges.length);

        for (const edge of edges) {
            const isFrom = edge.from_node === nodeId;
            const dir: 1 | -1 = isFrom ? 1 : -1;
            const baseHeading = isFrom ? edge.angle : wrapAngle(edge.angle + Math.PI);
            const s = isFrom ? 0 : edge.length;

            // How many particles for this edge?
            // Give more to preferred/path edges
            let count = perEdge;
            if (preferredEdgeId && edge.edge_id === preferredEdgeId) {
                count = Math.ceil(this.N * 0.4); // 40% on preferred
            } else if (this.pathEdgeIds.has(edge.edge_id)) {
                count = Math.ceil(this.N * 0.3); // 30% on path edges
            }

            for (let i = 0; i < count && this.particles.length < this.N; i++) {
                this.particles.push({
                    edgeId: edge.edge_id,
                    s,
                    direction: dir,
                    heading: wrapAngle(baseHeading + gaussianRandom(0, NAV_CONFIG.PF_HEADING_NOISE_SIGMA)),
                    weight: 1.0 / this.N,
                });
            }
        }

        // Fill remaining if needed
        while (this.particles.length < this.N) {
            const edge = edges[0];
            const isFrom = edge.from_node === nodeId;
            this.particles.push({
                edgeId: edge.edge_id,
                s: isFrom ? 0 : edge.length,
                direction: isFrom ? 1 : -1,
                heading: wrapAngle((isFrom ? edge.angle : wrapAngle(edge.angle + Math.PI))
                    + gaussianRandom(0, NAV_CONFIG.PF_HEADING_NOISE_SIGMA)),
                weight: 1.0 / this.N,
            });
        }

        return true;
    }

    // ── Core: Propagate + Reweight + Resample ──────────────────

    /**
     * Process a step event: propagate all particles, reweight, resample.
     * Returns the fused state estimate.
     */
    update(stepLength: number, sensorHeading: number): PFState {
        // 1. Propagate each particle
        for (let i = 0; i < this.particles.length; i++) {
            this.propagateParticle(this.particles[i], stepLength, sensorHeading);
        }

        // 2. Compute weights
        this.computeWeights(sensorHeading);

        // 3. Normalize weights
        this.normalizeWeights();

        // 4. Resample if needed
        const nEff = this.effectiveSampleSize();
        if (nEff < this.N * NAV_CONFIG.PF_RESAMPLE_THRESHOLD) {
            this.systematicResample();
        }

        // 5. Compute output
        return this.computeOutput(nEff);
    }

    /**
     * Handle a turn event: inject explorer particles at nearby nodes
     * to ensure edge diversity. This is the key to wrong-edge recovery.
     */
    handleTurnEvent(sensorHeading: number): void {
        const numExplorers = Math.ceil(this.N * NAV_CONFIG.PF_EXPLORER_RATIO);

        // Find particles that are near nodes
        const nearNodeParticles = this.particles.filter(p => {
            const edge = this.graph.edges.get(p.edgeId);
            if (!edge) return false;
            return p.s < NAV_CONFIG.NODE_PROXIMITY_THRESHOLD
                || edge.length - p.s < NAV_CONFIG.NODE_PROXIMITY_THRESHOLD;
        });

        if (nearNodeParticles.length === 0) return;

        // Pick the most common near-node
        const nodeCount = new Map<string, number>();
        for (const p of nearNodeParticles) {
            const edge = this.graph.edges.get(p.edgeId);
            if (!edge) continue;
            const nodeId = p.s < NAV_CONFIG.NODE_PROXIMITY_THRESHOLD
                ? edge.from_node : edge.to_node;
            nodeCount.set(nodeId, (nodeCount.get(nodeId) ?? 0) + 1);
        }

        let bestNode = '';
        let bestCount = 0;
        for (const [nid, cnt] of nodeCount) {
            if (cnt > bestCount) { bestCount = cnt; bestNode = nid; }
        }
        if (!bestNode) return;

        // Inject explorer particles on adjacent edges at this node
        const adj = this.graph.adjacency.get(bestNode);
        if (!adj) return;

        const adjEdges = adj.edges
            .map(eid => this.graph.edges.get(eid))
            .filter(Boolean) as EdgeGeometry[];

        // Replace the lowest-weight particles with explorers
        const sorted = [...this.particles].map((p, i) => ({ p, i }));
        sorted.sort((a, b) => a.p.weight - b.p.weight);

        let injected = 0;
        for (let k = 0; k < sorted.length && injected < numExplorers; k++) {
            const idx = sorted[k].i;
            const edge = adjEdges[injected % adjEdges.length];
            const isFrom = edge.from_node === bestNode;

            this.particles[idx] = {
                edgeId: edge.edge_id,
                s: isFrom ? 0 : edge.length,
                direction: isFrom ? 1 : -1,
                heading: wrapAngle(sensorHeading + gaussianRandom(0, NAV_CONFIG.PF_HEADING_NOISE_SIGMA * 2)),
                weight: 1.0 / this.N,
            };
            injected++;
        }
    }

    // ── Propagation ─────────────────────────────────────────────

    private propagateParticle(p: Particle, stepLength: number, sensorHeading: number): void {
        const edge = this.graph.edges.get(p.edgeId);
        if (!edge) return;

        // Add noise to step length
        const noisyStep = Math.max(0, stepLength + gaussianRandom(0, NAV_CONFIG.PF_STEP_NOISE_SIGMA));

        // Add noise to this particle's heading
        p.heading = wrapAngle(p.heading + gaussianRandom(0, NAV_CONFIG.PF_HEADING_NOISE_SIGMA));

        // Blend particle heading toward sensor heading (soft coupling)
        // This ensures particles don't diverge too far from the actual sensor
        const sensorDiff = wrapAngle(sensorHeading - p.heading);
        p.heading = wrapAngle(p.heading + 0.3 * sensorDiff);

        // Heading correction toward edge direction
        const effectiveAngle = p.direction === 1
            ? edge.angle
            : wrapAngle(edge.angle + Math.PI);
        const edgeDiff = wrapAngle(p.heading - effectiveAngle);
        p.heading = wrapAngle(p.heading - NAV_CONFIG.HEADING_CORRECTION_ALPHA * edgeDiff);

        // Project step onto edge
        const angleDiff = wrapAngle(p.heading - effectiveAngle);
        const deltaS = noisyStep * Math.cos(angleDiff) * p.direction;

        p.s += deltaS;

        // Handle edge transition if s goes out of bounds
        if (p.s < 0) {
            const overshoot = -p.s;
            this.transitionAtNode(p, edge.from_node, overshoot);
        } else if (p.s > edge.length) {
            const overshoot = p.s - edge.length;
            this.transitionAtNode(p, edge.to_node, overshoot);
        }
    }

    /**
     * When a particle reaches a node, probabilistically choose
     * the next edge based on heading alignment + path bonus.
     */
    private transitionAtNode(p: Particle, nodeId: string, overshoot: number): void {
        const adj = this.graph.adjacency.get(nodeId);
        if (!adj || adj.edges.length === 0) {
            // Dead-end: clamp to edge boundary
            const edge = this.graph.edges.get(p.edgeId);
            if (edge) p.s = clamp(p.s, 0, edge.length);
            return;
        }

        // Score each adjacent edge
        const candidates: Array<{ edge: EdgeGeometry; isFrom: boolean; score: number }> = [];
        for (const eid of adj.edges) {
            const edge = this.graph.edges.get(eid);
            if (!edge) continue;

            const isFrom = edge.from_node === nodeId;
            const candidateAngle = isFrom ? edge.angle : wrapAngle(edge.angle + Math.PI);
            const angleDiff = wrapAngle(p.heading - candidateAngle);

            // Heading alignment score (Gaussian)
            let score = Math.exp(-(angleDiff * angleDiff) / (2 * SIGMA_RAD * SIGMA_RAD));

            // Path bonus
            if (this.pathEdgeIds.has(edge.edge_id)) {
                score *= NAV_CONFIG.PATH_BONUS_MULTIPLIER;
            }

            // Small floor to ensure no edge has zero probability
            score = Math.max(score, 0.01);

            candidates.push({ edge, isFrom, score });
        }

        // Sample one edge based on scores (roulette wheel)
        const totalScore = candidates.reduce((sum, c) => sum + c.score, 0);
        let r = Math.random() * totalScore;
        let chosen = candidates[0];
        for (const c of candidates) {
            r -= c.score;
            if (r <= 0) { chosen = c; break; }
        }

        // Place particle on the chosen edge
        p.edgeId = chosen.edge.edge_id;
        if (chosen.isFrom) {
            p.s = clamp(overshoot, 0, chosen.edge.length);
            p.direction = 1;
        } else {
            p.s = clamp(chosen.edge.length - overshoot, 0, chosen.edge.length);
            p.direction = -1;
        }
    }

    // ── Weight Computation ──────────────────────────────────────

    private computeWeights(sensorHeading: number): void {
        for (const p of this.particles) {
            const edge = this.graph.edges.get(p.edgeId);
            if (!edge) { p.weight = NAV_CONFIG.PF_MIN_WEIGHT; continue; }

            // How well does this particle's heading match its edge direction?
            const effectiveAngle = p.direction === 1
                ? edge.angle
                : wrapAngle(edge.angle + Math.PI);
            const angleDiff = wrapAngle(p.heading - effectiveAngle);
            const alignment = Math.exp(-(angleDiff * angleDiff) / (2 * SIGMA_RAD * SIGMA_RAD));

            // How well does this particle's heading match the sensor heading?
            const sensorDiff = wrapAngle(p.heading - sensorHeading);
            const sensorMatch = Math.exp(-(sensorDiff * sensorDiff) / (2 * SIGMA_RAD * SIGMA_RAD));

            // Path bonus (soft, not hard filter)
            const pathBonus = this.pathEdgeIds.has(p.edgeId)
                ? NAV_CONFIG.PATH_BONUS_MULTIPLIER : 1.0;

            p.weight = Math.max(
                alignment * sensorMatch * pathBonus,
                NAV_CONFIG.PF_MIN_WEIGHT
            );
        }
    }

    private normalizeWeights(): void {
        const total = this.particles.reduce((sum, p) => sum + p.weight, 0);
        if (total > 0) {
            for (const p of this.particles) {
                p.weight /= total;
            }
        } else {
            // All zero — reset to uniform
            const uniform = 1.0 / this.N;
            for (const p of this.particles) {
                p.weight = uniform;
            }
        }
    }

    private effectiveSampleSize(): number {
        const sumSq = this.particles.reduce((sum, p) => sum + p.weight * p.weight, 0);
        return sumSq > 0 ? 1.0 / sumSq : 0;
    }

    // ── Systematic Resampling ───────────────────────────────────

    private systematicResample(): void {
        const newParticles: Particle[] = [];
        const cumWeights: number[] = [];
        let cumSum = 0;

        for (const p of this.particles) {
            cumSum += p.weight;
            cumWeights.push(cumSum);
        }

        const step = 1.0 / this.N;
        let r = Math.random() * step;
        let j = 0;

        for (let i = 0; i < this.N; i++) {
            while (j < cumWeights.length - 1 && cumWeights[j] < r) {
                j++;
            }
            // Clone the particle (important: new object, not reference)
            newParticles.push({
                edgeId: this.particles[j].edgeId,
                s: this.particles[j].s,
                direction: this.particles[j].direction,
                heading: this.particles[j].heading,
                weight: 1.0 / this.N,
            });
            r += step;
        }

        this.particles = newParticles;
    }

    // ── Output Computation ──────────────────────────────────────

    private computeOutput(nEff: number): PFState {
        // Accumulate weight per edge
        const edgeWeights = new Map<string, number>();
        for (const p of this.particles) {
            edgeWeights.set(p.edgeId, (edgeWeights.get(p.edgeId) ?? 0) + p.weight);
        }

        // Best edge = highest total weight
        let bestEdgeId = '';
        let bestEdgeWeight = 0;
        for (const [eid, w] of edgeWeights) {
            if (w > bestEdgeWeight) {
                bestEdgeWeight = w;
                bestEdgeId = eid;
            }
        }

        // Weighted mean s on best edge
        let weightedS = 0;
        let weightSumBest = 0;
        for (const p of this.particles) {
            if (p.edgeId === bestEdgeId) {
                weightedS += p.s * p.weight;
                weightSumBest += p.weight;
            }
        }
        const bestS = weightSumBest > 0 ? weightedS / weightSumBest : 0;

        // Weighted mean heading (all particles)
        let sinSum = 0, cosSum = 0;
        for (const p of this.particles) {
            sinSum += Math.sin(p.heading) * p.weight;
            cosSum += Math.cos(p.heading) * p.weight;
        }
        const heading = Math.atan2(sinSum, cosSum);

        // Weighted centroid world position (all particles)
        let wx = 0, wy = 0;
        for (const p of this.particles) {
            const pos = this.particleWorldPos(p);
            wx += pos.x * p.weight;
            wy += pos.y * p.weight;
        }
        const position: Point = { x: wx, y: wy };

        // Near-node check on best edge
        const bestEdge = this.graph.edges.get(bestEdgeId);
        let nearNode: string | null = null;
        if (bestEdge) {
            const threshold = NAV_CONFIG.NODE_PROXIMITY_THRESHOLD;
            if (bestS < threshold) nearNode = bestEdge.from_node;
            else if (bestEdge.length - bestS < threshold) nearNode = bestEdge.to_node;
        }

        return {
            bestEdgeId,
            bestS,
            heading,
            position,
            nearNode,
            nEff,
            edgeWeights,
        };
    }

    private particleWorldPos(p: Particle): Point {
        const edge = this.graph.edges.get(p.edgeId);
        if (!edge) return { x: 0, y: 0 };
        const t = edge.length > 0 ? p.s / edge.length : 0;
        return {
            x: edge.p0.x + (edge.p1.x - edge.p0.x) * t,
            y: edge.p0.y + (edge.p1.y - edge.p0.y) * t,
        };
    }

    // ── Debug Accessors ─────────────────────────────────────────

    getParticles(): readonly Particle[] {
        return this.particles;
    }

    getParticleCount(): number {
        return this.particles.length;
    }
}

// ── Math Helpers ──────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

/** Box-Muller transform for Gaussian random numbers */
function gaussianRandom(mean: number, stdDev: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10)))
        * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
}
