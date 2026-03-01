// ═══════════════════════════════════════════════════════════════
//  Types — Indoor Navigation System
// ═══════════════════════════════════════════════════════════════

/** Node types from the existing schema */
export type NodeType =
    | 'corridor_turn'
    | 'junction'
    | 'stairs'
    | 'elevator'
    | 'toilet'
    | 'exit'
    | 'room'
    | 'entrance';

/** Raw node from mvp_system_data.json */
export interface RawNode {
    node_id: string;
    floor_id: number;
    x: number;
    y: number;
    type: NodeType;
    name?: string;
}

/** Raw edge from mvp_system_data.json */
export interface RawEdge {
    edge_id: string;
    from_node: string;
    to_node: string;
    bidirectional: boolean;
    weight: number;
    distance_m?: number | null;
}

/** Raw graph data from JSON */
export interface RawGraphData {
    nodes: RawNode[];
    edges: RawEdge[];
}

/** Pre-computed edge geometry for navigation */
export interface EdgeGeometry {
    edge_id: string;
    from_node: string;
    to_node: string;
    /** Start point in meters */
    p0: Point;
    /** End point in meters */
    p1: Point;
    /** Edge length in meters */
    length: number;
    /** Edge direction angle in radians (P0 → P1) */
    angle: number;
    /** Unit direction vector */
    direction: Point;
    /** Corridor half-width in meters */
    halfWidth: number;
}

/** Simple 2D point */
export interface Point {
    x: number;
    y: number;
}

/** Adjacency entry: which edges connect at a node */
export interface NodeAdjacency {
    node_id: string;
    /** Edge IDs that touch this node */
    edges: string[];
}

/** Processed graph with all pre-computed data */
export interface ProcessedGraph {
    nodes: Map<string, RawNode>;
    edges: Map<string, EdgeGeometry>;
    adjacency: Map<string, NodeAdjacency>;
}

/** Navigation state — position on the graph */
export interface NavState {
    /** Current edge the user is on */
    currentEdgeId: string;
    /** Distance along edge from P0 (meters) */
    s: number;
    /** Lateral offset from centerline (meters) */
    d: number;
    /** Walking direction: +1 = towards P1, -1 = towards P0 */
    direction: 1 | -1;
    /** Current world heading (radians) */
    heading: number;
    /** Total step count */
    stepCount: number;
    /** Current world position (meters) */
    position: Point;
    /** Whether the user is near a node (within threshold) */
    nearNode: string | null;
    /** Is the navigation initialized? */
    initialized: boolean;
}

/** Sensor data snapshot */
export interface SensorData {
    accelerometer: { x: number; y: number; z: number } | null;
    gyroscope: { x: number; y: number; z: number } | null;
    heading: number;
    stepCount: number;
}

/** Debug info for overlay */
export interface DebugInfo {
    sensorData: SensorData;
    navState: NavState | null;
    turnDetected: boolean;
    lastTurnAngle: number;
    fps: number;
}
