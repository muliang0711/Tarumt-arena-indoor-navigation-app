import type { BlueMarkerState, OverlayRouteNode, RedMarkerState } from '../type';
import { TEST_ROUTE_NODE_IDS } from './demoMapConfig';

export function createBlueMarkerState(nodes: OverlayRouteNode[]) {
  const startNodeId = TEST_ROUTE_NODE_IDS[0];
  const startNode = nodes.find((node) => node.nodeId === startNodeId);
  if (!startNode) {
    throw new Error(`Missing blue marker route start node: ${startNodeId}`);
  }

  return {
    kind: 'blueMarker' as const,
    routeNodeId: startNode.nodeId,
    tiledX: startNode.tiledX,
    tiledY: startNode.tiledY,
    screenX: startNode.screenX,
    screenY: startNode.screenY,
  };
}

export function createRedMarkerState(
  blueMarker: BlueMarkerState,
): RedMarkerState {
  return {
    headingDegrees: 0,
    kind: 'redMarker',
    tiledX: blueMarker.tiledX + 34,
    tiledY: blueMarker.tiledY + 28,
    screenX: blueMarker.screenX + 34,
    screenY: blueMarker.screenY + 28,
  };
}
