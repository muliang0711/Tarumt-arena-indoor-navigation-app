/**
 * Node Schema Definition
 * 
 * Nodes represent "decision points" in the navigation graph - 
 * places where a user needs to make a choice about direction.
 * 
 * @example Corridor junction, stairs entrance, elevator, room entrance
 */

/**
 * Node types - the semantic classification of each node.
 * This is the MOST IMPORTANT field for future extensibility.
 * ALL routing logic should use node.type, never node.id directly.
 */
export type NodeType = 
  | 'corridor_turn'    // 走廊转弯点
  | 'junction'         // 多路交叉口
  | 'stairs'           // 楼梯
  | 'elevator'         // 电梯
  | 'toilet'           // 厕所入口
  | 'exit'             // 出口
  | 'room'             // 房间入口
  | 'entrance';        // 建筑入口

/**
 * Tags for additional node attributes (optional, for future features)
 */
export type NodeTag = 
  | 'accessible'       // 无障碍
  | 'male'             // 男厕所
  | 'female'           // 女厕所
  | 'emergency'        // 紧急出口
  | 'restricted';      // 限制进入

/**
 * Node metadata interface for extensibility
 */
export interface NodeMetadata {
  /** Custom key-value pairs for future needs */
  [key: string]: unknown;
}

/**
 * Main Node interface
 */
export interface Node {
  // ═══════════════════════════════════════════════════════════════
  // 🔴 REQUIRED FIELDS (MVP must have these)
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Unique identifier for the node.
   * Format: "N_{floor}_{sequence}" e.g., "N_1_001"
   * 
   * ⚠️ CRITICAL: This is the topology anchor point.
   * - All Edges depend on this
   * - All path planning depends on this
   * - Cannot be null or empty
   */
  node_id: string;

  /**
   * Floor identifier.
   * Even if you only have one floor now, ALWAYS fill this.
   * 
   * ⚠️ Required for:
   * - Cross-floor logic (elevators, stairs)
   * - Future floor expansion without refactoring
   */
  floor_id: number;

  /**
   * X coordinate (can be coarse, but must be consistent).
   * 
   * Acceptable values:
   * - Grid coordinates: 0, 1, 2, 3
   * - Scaled: 10, 20, 30
   * - Real meters (if measured)
   * 
   * ⚠️ Required for:
   * - Snap to nearest node
   * - Distance calculations
   * 
   * ❌ NOT acceptable: null, random, inconsistent scale
   */
  x: number;

  /**
   * Y coordinate (can be coarse, but must be consistent).
   * Same rules as x coordinate.
   */
  y: number;

  /**
   * Semantic type of the node.
   * 
   * ⚠️ CRITICAL: This is the future expansion gateway.
   * All feature logic should use type, not node_id.
   * 
   * @example
   * // ✅ CORRECT
   * if (node.type === 'toilet') { ... }
   * 
   * // ❌ WRONG
   * if (node.node_id === 'N_12') { ... }
   */
  type: NodeType;

  // ═══════════════════════════════════════════════════════════════
  // 🟢 OPTIONAL FIELDS (can be null/empty for MVP)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Semantic tags for advanced features.
   * 
   * ⚠️ Can be empty for MVP.
   * Add tags when implementing:
   * - Accessibility routing
   * - Gender-specific facilities
   * - Emergency routing
   * 
   * @default []
   */
  tags?: NodeTag[];

  /**
   * Human-readable name for UI display.
   * 
   * ⚠️ Can be null for MVP.
   * Only needed when showing node names to users.
   * 
   * @example "Main Entrance", "3F Men's Restroom"
   */
  name?: string | null;

  /**
   * Whether this node is active in the navigation graph.
   * 
   * ⚠️ Can be omitted for MVP.
   * Useful for temporarily disabling nodes during construction.
   * 
   * @default true
   */
  enabled?: boolean;

  /**
   * Extensible metadata object.
   * 
   * ⚠️ Can be {} or null for MVP.
   * Reserved for future custom attributes like:
   * - Opening hours
   * - Capacity
   * - Photos
   */
  metadata?: NodeMetadata | null;
}

// ═══════════════════════════════════════════════════════════════
// Default values for optional fields
// ═══════════════════════════════════════════════════════════════

export const NODE_DEFAULTS: Partial<Node> = {
  tags: [],
  name: null,
  enabled: true,
  metadata: null,
};

// ═══════════════════════════════════════════════════════════════
// Validation helper
// ═══════════════════════════════════════════════════════════════

/**
 * Validates that a node has all required fields for MVP
 */
export function validateNodeForMVP(node: Partial<Node>): node is Node {
  return (
    typeof node.node_id === 'string' && node.node_id.length > 0 &&
    typeof node.floor_id === 'number' &&
    typeof node.x === 'number' &&
    typeof node.y === 'number' &&
    typeof node.type === 'string' && node.type.length > 0
  );
}
