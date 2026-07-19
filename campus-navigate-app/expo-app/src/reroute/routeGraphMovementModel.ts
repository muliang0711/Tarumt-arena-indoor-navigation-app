import type { RouteGraphEdge } from './type';

export function isNodeOnRoute(input: {
  nodeId: string;
  routeNodeIds: readonly string[];
}) {
  return input.routeNodeIds.includes(input.nodeId);
}

export function isLegalGraphMovement(input: {
  candidateNodeId: string;
  edges: readonly RouteGraphEdge[];
  fromNodeId: string;
}) {
  return input.edges.some(
    (edge) =>
      (edge.fromNodeId === input.fromNodeId &&
        edge.toNodeId === input.candidateNodeId) ||
      (edge.toNodeId === input.fromNodeId &&
        edge.fromNodeId === input.candidateNodeId),
  );
}
