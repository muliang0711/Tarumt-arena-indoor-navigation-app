/**
 * Edge Schema Definition
 * 
 * Edges represent connections between nodes - the paths users can walk.
 * This is the true skeleton of the navigation graph.
 */

/**
 * Accessibility level for the edge
 */
export type AccessibilityLevel =
    | 'full'          // 完全无障碍
    | 'limited'       // 部分无障碍（如有坡道但较陡）
    | 'none';         // 无法通行（如只有楼梯）

/**
 * Edge metadata interface for extensibility
 */
export interface EdgeMetadata {
    /** Custom key-value pairs for future needs */
    [key: string]: unknown;
}

/**
 * Main Edge interface
 */
export interface Edge {
    // ═══════════════════════════════════════════════════════════════
    // 🔴 REQUIRED FIELDS (MVP must have these)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Unique identifier for the edge.
     * Format: "E_{sequence}" or "E_{from}_{to}" e.g., "E_001" or "E_N1_N2"
     * 
     * ⚠️ Required for:
     * - Edge management
     * - Debugging
     * - Future updates
     */
    edge_id: string;

    /**
     * Source node ID.
     * Must reference an existing node_id in the Node table.
     * 
     * ⚠️ CRITICAL: This is half of the graph skeleton.
     */
    from_node: string;

    /**
     * Destination node ID.
     * Must reference an existing node_id in the Node table.
     * 
     * ⚠️ CRITICAL: This is the other half of the graph skeleton.
     */
    to_node: string;

    /**
     * Whether the edge can be traversed in both directions.
     * 
     * ⚠️ CRITICAL: Must be explicitly set, never assumed.
     * 
     * @example
     * - true:  Regular corridor (可双向通行)
     * - false: One-way door, escalator (单向门/扶梯)
     * 
     * For stairs:
     * - Usually true, but could be false for emergency exits
     */
    bidirectional: boolean;

    /**
     * Weight for path calculation.
     * 
     * ⚠️ CRITICAL: Cannot be null, even if you don't know the real value.
     * 
     * MVP acceptable values:
     * - 1: Default, all edges equal
     * - 1.5: Stairs (slightly more effort)
     * - 0.5: Elevator (faster)
     * 
     * Future: Can be calculated from distance_m + time_s
     * 
     * ❌ weight = null will break pathfinding!
     */
    weight: number;

    // ═══════════════════════════════════════════════════════════════
    // 🟢 OPTIONAL FIELDS (can be null/empty for MVP)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Physical distance in meters.
     * 
     * ⚠️ Can be null for MVP.
     * 
     * Why it's okay to skip now:
     * - Wi-Fi positioning error > measurement error
     * - Can be batch-measured later
     * - weight = 1 works for MVP
     * 
     * When to add:
     * - When you need accurate ETAs
     * - When optimizing for actual walking distance
     */
    distance_m?: number | null;

    /**
     * Estimated traversal time in seconds.
     * 
     * ⚠️ Can be null for MVP.
     * 
     * Why it's okay to skip now:
     * - Can be derived from distance_m later
     * - time_s = distance_m / walking_speed
     * 
     * When to add:
     * - For elevators (wait time)
     * - For congested areas
     */
    time_s?: number | null;

    /**
     * Accessibility level of this edge.
     * 
     * ⚠️ Can be null for MVP.
     * 
     * When to add:
     * - When implementing wheelchair routing
     * - When implementing elderly-friendly routes
     * 
     * @default null (not evaluated)
     */
    accessibility?: AccessibilityLevel | null;

    /**
     * Whether this edge is active in the navigation graph.
     * 
     * ⚠️ Can be omitted for MVP.
     * 
     * Useful for:
     * - Temporary closures
     * - Construction
     * - Time-based restrictions
     * 
     * @default true
     */
    enabled?: boolean;

    /**
     * Extensible metadata object.
     * 
     * ⚠️ Can be {} or null for MVP.
     * 
     * Reserved for future attributes like:
     * - Operating hours
     * - Crowd density
     * - Scenic route flag
     */
    metadata?: EdgeMetadata | null;
}

// ═══════════════════════════════════════════════════════════════
// Default values for optional fields
// ═══════════════════════════════════════════════════════════════

export const EDGE_DEFAULTS: Partial<Edge> = {
    distance_m: null,
    time_s: null,
    accessibility: null,
    enabled: true,
    metadata: null,
};

// ═══════════════════════════════════════════════════════════════
// Validation helper
// ═══════════════════════════════════════════════════════════════

/**
 * Validates that an edge has all required fields for MVP
 */
export function validateEdgeForMVP(edge: Partial<Edge>): edge is Edge {
    return (
        typeof edge.edge_id === 'string' && edge.edge_id.length > 0 &&
        typeof edge.from_node === 'string' && edge.from_node.length > 0 &&
        typeof edge.to_node === 'string' && edge.to_node.length > 0 &&
        typeof edge.bidirectional === 'boolean' &&
        typeof edge.weight === 'number' && edge.weight > 0
    );
}

// ═══════════════════════════════════════════════════════════════
// Helper for creating bidirectional edges
// ═══════════════════════════════════════════════════════════════

/**
 * Creates a pair of edges for bidirectional connection.
 * Use this when bidirectional=false but you want both directions.
 */
export function createBidirectionalEdgePair(
    baseEdgeId: string,
    nodeA: string,
    nodeB: string,
    weight: number = 1
): [Edge, Edge] {
    return [
        {
            edge_id: `${baseEdgeId}_AB`,
            from_node: nodeA,
            to_node: nodeB,
            bidirectional: false,
            weight,
        },
        {
            edge_id: `${baseEdgeId}_BA`,
            from_node: nodeB,
            to_node: nodeA,
            bidirectional: false,
            weight,
        },
    ];
}
