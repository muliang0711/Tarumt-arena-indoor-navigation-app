import type {
  MovementRouteGraph,
  RouteEdge,
  RouteNode,
} from '../shared';

export type NavigationDestinationId = 'node_2' | 'node_3' | 'node_4';
export type NavigationRouteStatus = 'idle' | 'ready' | 'no-route';

export type HighlightedRoute = {
  nodeIds: string[];
  edges: RouteEdge[];
  totalWeight: number;
};

export type NavigationDebugState = {
  originNodeId: string;
  selectedDestinationId: NavigationDestinationId;
  routeStatus: NavigationRouteStatus;
  highlightedPath: HighlightedRoute | null;
  showUnwalkableOverlay: boolean;
};

const DESTINATION_IDS: readonly NavigationDestinationId[] = [
  'node_2',
  'node_3',
  'node_4',
];

function nodeId(node: RouteNode): string | null {
  return node.node_id ?? node.id ?? null;
}

function routeNodeMap(routeGraph: MovementRouteGraph): Map<string, RouteNode> {
  return new Map(
    routeGraph.nodes.flatMap((node) => {
      const id = nodeId(node);
      return id ? [[id, node] as const] : [];
    }),
  );
}

function edgeWeight(
  edge: RouteEdge,
  nodes: ReadonlyMap<string, RouteNode>,
): number {
  if (edge.weight !== undefined && edge.weight >= 0) {
    return edge.weight;
  }
  if (edge.distance_m !== undefined && edge.distance_m >= 0) {
    return edge.distance_m;
  }
  const from = nodes.get(edge.from_node);
  const to = nodes.get(edge.to_node);
  return from && to
    ? Math.hypot(
        to.position.x - from.position.x,
        to.position.y - from.position.y,
      )
    : Number.POSITIVE_INFINITY;
}

export function getSelectableDestinations(routeGraph: MovementRouteGraph) {
  const availableNodeIds = new Set(
    routeGraph.nodes.map(nodeId).filter((id): id is string => id !== null),
  );
  return DESTINATION_IDS.map((destinationId) => ({
    nodeId: destinationId,
    available: availableNodeIds.has(destinationId),
  }));
}

export function createNavigationDebugState(
  originNodeId: string,
  _routeGraph: MovementRouteGraph,
): NavigationDebugState {
  return {
    originNodeId,
    selectedDestinationId: 'node_4',
    routeStatus: 'idle',
    highlightedPath: null,
    showUnwalkableOverlay: false,
  };
}

export function findShortestRoute(
  routeGraph: MovementRouteGraph,
  originNodeId: string,
  destinationNodeId: string,
): HighlightedRoute | null {
  const nodes = routeNodeMap(routeGraph);
  if (!nodes.has(originNodeId) || !nodes.has(destinationNodeId)) {
    return null;
  }

  const adjacency = new Map<string, { nodeId: string; edge: RouteEdge; weight: number }[]>();
  for (const edge of routeGraph.edges) {
    if (edge.enabled === false || !nodes.has(edge.from_node) || !nodes.has(edge.to_node)) {
      continue;
    }
    const weight = edgeWeight(edge, nodes);
    if (!Number.isFinite(weight)) {
      continue;
    }
    adjacency.set(edge.from_node, [
      ...(adjacency.get(edge.from_node) ?? []),
      { nodeId: edge.to_node, edge, weight },
    ]);
    if (edge.bidirectional === true) {
      adjacency.set(edge.to_node, [
        ...(adjacency.get(edge.to_node) ?? []),
        { nodeId: edge.from_node, edge, weight },
      ]);
    }
  }

  const best = new Map<string, { weight: number; hops: number }>([
    [originNodeId, { weight: 0, hops: 0 }],
  ]);
  const previous = new Map<string, { nodeId: string; edge: RouteEdge }>();
  const unsettled = new Set(nodes.keys());

  while (unsettled.size > 0) {
    const currentNodeId = [...unsettled].reduce<string | null>((selected, candidate) => {
      const candidateCost = best.get(candidate);
      if (!candidateCost) {
        return selected;
      }
      if (!selected) {
        return candidate;
      }
      const selectedCost = best.get(selected);
      return !selectedCost ||
        candidateCost.weight < selectedCost.weight ||
        (candidateCost.weight === selectedCost.weight &&
          candidateCost.hops < selectedCost.hops)
        ? candidate
        : selected;
    }, null);

    if (!currentNodeId) {
      break;
    }
    unsettled.delete(currentNodeId);
    if (currentNodeId === destinationNodeId) {
      break;
    }

    const currentCost = best.get(currentNodeId);
    if (!currentCost) {
      continue;
    }
    for (const neighbor of adjacency.get(currentNodeId) ?? []) {
      if (!unsettled.has(neighbor.nodeId)) {
        continue;
      }
      const candidate = {
        weight: currentCost.weight + neighbor.weight,
        hops: currentCost.hops + 1,
      };
      const known = best.get(neighbor.nodeId);
      if (
        !known ||
        candidate.weight < known.weight ||
        (candidate.weight === known.weight && candidate.hops < known.hops)
      ) {
        best.set(neighbor.nodeId, candidate);
        previous.set(neighbor.nodeId, {
          nodeId: currentNodeId,
          edge: neighbor.edge,
        });
      }
    }
  }

  const destinationCost = best.get(destinationNodeId);
  if (!destinationCost) {
    return null;
  }

  const nodeIds = [destinationNodeId];
  const edges: RouteEdge[] = [];
  let currentNodeId = destinationNodeId;
  while (currentNodeId !== originNodeId) {
    const step = previous.get(currentNodeId);
    if (!step) {
      return null;
    }
    nodeIds.unshift(step.nodeId);
    edges.unshift(step.edge);
    currentNodeId = step.nodeId;
  }

  return {
    nodeIds,
    edges,
    totalWeight: destinationCost.weight,
  };
}

export function calculateNavigationRoute(
  state: NavigationDebugState,
  routeGraph: MovementRouteGraph,
): NavigationDebugState {
  const highlightedPath = findShortestRoute(
    routeGraph,
    state.originNodeId,
    state.selectedDestinationId,
  );
  return {
    ...state,
    routeStatus: highlightedPath ? 'ready' : 'no-route',
    highlightedPath,
  };
}

export function selectNavigationDestination(
  state: NavigationDebugState,
  selectedDestinationId: NavigationDestinationId,
  routeGraph: MovementRouteGraph,
): NavigationDebugState {
  const selectedState = {
    ...state,
    selectedDestinationId,
  };
  return state.routeStatus === 'idle'
    ? selectedState
    : calculateNavigationRoute(selectedState, routeGraph);
}

export function clearNavigationRoute(
  state: NavigationDebugState,
): NavigationDebugState {
  return {
    ...state,
    routeStatus: 'idle',
    highlightedPath: null,
  };
}

export function toggleUnwalkableOverlay(
  state: NavigationDebugState,
): NavigationDebugState {
  return {
    ...state,
    showUnwalkableOverlay: !state.showUnwalkableOverlay,
  };
}
