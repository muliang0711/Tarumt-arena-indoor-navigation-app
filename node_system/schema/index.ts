/**
 * Navigation Graph Schema
 * 
 * Re-exports all schema types for convenient importing.
 * 
 * @example
 * import { Node, Edge, NodeType } from './schema';
 */

// Node exports
export type {
    Node,
    NodeType,
    NodeTag,
    NodeMetadata
} from './node';

export {
    NODE_DEFAULTS,
    validateNodeForMVP
} from './node';

// Edge exports
export type {
    Edge,
    AccessibilityLevel,
    EdgeMetadata
} from './edge';

export {
    EDGE_DEFAULTS,
    validateEdgeForMVP,
    createBidirectionalEdgePair
} from './edge';
