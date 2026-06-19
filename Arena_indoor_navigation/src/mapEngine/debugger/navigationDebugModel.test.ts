import assert from 'node:assert/strict';
import test from 'node:test';

import type { MovementRouteGraph } from '../shared';
import {
  calculateNavigationRoute,
  clearNavigationRoute,
  createNavigationDebugState,
  getSelectableDestinations,
  selectNavigationDestination,
} from './navigationDebugModel';

const routeGraph: MovementRouteGraph = {
  nodes: [
    { node_id: 'node_1', position: { x: 4.8, y: 5.2 } },
    { node_id: 'node_2', position: { x: 4.8, y: 4 } },
    { node_id: 'node_3', position: { x: 8, y: 4 } },
    { node_id: 'node_4', position: { x: 10.4, y: 4 } },
  ],
  edges: [
    {
      edge_id: 'node_1_to_node_2',
      from_node: 'node_1',
      to_node: 'node_2',
      bidirectional: true,
      weight: 1.2,
      enabled: true,
    },
    {
      edge_id: 'node_2_to_node_3',
      from_node: 'node_2',
      to_node: 'node_3',
      bidirectional: true,
      weight: 3.2,
      enabled: true,
    },
    {
      edge_id: 'node_2_to_node_4',
      from_node: 'node_2',
      to_node: 'node_4',
      bidirectional: true,
      weight: 5.6,
      enabled: true,
    },
    {
      edge_id: 'node_3_to_node_4',
      from_node: 'node_3',
      to_node: 'node_4',
      bidirectional: true,
      weight: 2.4,
      enabled: true,
    },
  ],
};

test('uses Bob spawn node as the initial route origin and exposes Nodes 2-4', () => {
  const state = createNavigationDebugState('node_1', routeGraph);

  assert.equal(state.originNodeId, 'node_1');
  assert.equal(state.selectedDestinationId, 'node_4');
  assert.deepEqual(getSelectableDestinations(routeGraph), [
    { nodeId: 'node_2', available: true },
    { nodeId: 'node_3', available: true },
    { nodeId: 'node_4', available: true },
  ]);
});

test('calculates the expected graph path to each selectable destination', () => {
  const initial = createNavigationDebugState('node_1', routeGraph);

  const toNode2 = calculateNavigationRoute(
    selectNavigationDestination(initial, 'node_2', routeGraph),
    routeGraph,
  );
  const toNode3 = calculateNavigationRoute(
    selectNavigationDestination(initial, 'node_3', routeGraph),
    routeGraph,
  );
  const toNode4 = calculateNavigationRoute(initial, routeGraph);

  assert.deepEqual(toNode2.highlightedPath?.nodeIds, ['node_1', 'node_2']);
  assert.deepEqual(toNode3.highlightedPath?.nodeIds, ['node_1', 'node_2', 'node_3']);
  assert.deepEqual(toNode4.highlightedPath?.nodeIds, ['node_1', 'node_2', 'node_4']);
});

test('Node 1 to Node 4 includes Node 2 as the L-shaped turn', () => {
  const state = calculateNavigationRoute(
    createNavigationDebugState('node_1', routeGraph),
    routeGraph,
  );

  assert.deepEqual(
    state.highlightedPath?.edges.map((edge) => edge.edge_id),
    ['node_1_to_node_2', 'node_2_to_node_4'],
  );
});

test('switching destination replaces the highlighted path and clear removes it', () => {
  const toNode4 = calculateNavigationRoute(
    createNavigationDebugState('node_1', routeGraph),
    routeGraph,
  );
  const toNode3 = selectNavigationDestination(toNode4, 'node_3', routeGraph);
  const cleared = clearNavigationRoute(toNode3);

  assert.deepEqual(toNode3.highlightedPath?.nodeIds, ['node_1', 'node_2', 'node_3']);
  assert.equal(toNode3.routeStatus, 'ready');
  assert.equal(cleared.highlightedPath, null);
  assert.equal(cleared.routeStatus, 'idle');
  assert.equal(cleared.selectedDestinationId, 'node_3');
});

test('reports no route without mutating Bob position or the graph', () => {
  const disconnected: MovementRouteGraph = {
    nodes: routeGraph.nodes,
    edges: [],
  };
  const bobPosition = { x: 4.8, y: 5.2 };
  const positionBefore = { ...bobPosition };
  const graphBefore = structuredClone(disconnected);

  const result = calculateNavigationRoute(
    createNavigationDebugState('node_1', disconnected),
    disconnected,
  );

  assert.equal(result.routeStatus, 'no-route');
  assert.equal(result.highlightedPath, null);
  assert.deepEqual(bobPosition, positionBefore);
  assert.deepEqual(disconnected, graphBefore);
});
