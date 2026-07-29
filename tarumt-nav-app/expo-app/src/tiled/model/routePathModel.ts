import type { OverlayRouteNode } from '../type';
import { TEST_ROUTE_NODE_IDS } from './demoMapConfig';
import { createPathSegmentsFromPoints } from './pathSegmentModel';

export function createRoutePath(
  nodes: OverlayRouteNode[],
  nodeIds: readonly string[] = TEST_ROUTE_NODE_IDS,
) {
  const nodeById = new Map(nodes.map((node) => [node.nodeId, node]));
  const path: OverlayRouteNode[] = [];

  for (const nodeId of nodeIds) {
    const node = nodeById.get(nodeId);
    if (!node) {
      throw new Error(`Missing test route node: ${nodeId}`);
    }
    path.push(node);
  }

  return path;
}

export function createRoutePathSegments(
  nodes: OverlayRouteNode[],
  nodeIds: readonly string[] = TEST_ROUTE_NODE_IDS,
) {
  return createPathSegmentsFromPoints(createRoutePath(nodes, nodeIds));
}
