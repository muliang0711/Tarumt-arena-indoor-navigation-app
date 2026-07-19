import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_WRONG_WAY_REROUTE_CONFIG,
  createWrongWayRerouteState,
  evaluateWrongWayReroute,
  findCurrentJunctionNode,
  isHeadingOutsideAllowedDeviation,
  isLegalGraphMovement,
  roundHeadingDegrees,
} from './index';
import type { RouteGraphEdge } from './type';
import type { OverlayRouteNode, RoutePosition } from '../tiled/type';

const graphEdges: RouteGraphEdge[] = [
  { fromNodeId: 'B', toNodeId: 'C' },
  { fromNodeId: 'B', toNodeId: 'A' },
];
const junctionNode = {
  nodeId: 'B',
  type: 'junctions',
};

test('does not start wrong-way timer when heading is normal outside a junction', () => {
  const result = evaluateWrongWayReroute({
    currentNode: { nodeId: 'hall-1', type: 'route-node' },
    expectedHeadingDegrees: 270,
    nowMs: 1400,
    observedHeadingDegrees: 270,
    state: { oppositeHeadingStartedAtMs: 1000 },
  });

  assert.equal(result.shouldSuggestReroute, false);
  assert.equal(result.reason, 'not-at-junction');
  assert.equal(result.isAtJunction, false);
  assert.equal(result.state.oppositeHeadingStartedAtMs, null);
});

test('suggests wrong-way for sustained heading deviation even outside a junction', () => {
  const first = evaluateWrongWayReroute({
    currentNode: { nodeId: 'hall-1', type: 'route-node' },
    expectedHeadingDegrees: 0,
    nowMs: 1000,
    observedHeadingDegrees: 90,
    state: createWrongWayRerouteState(),
  });
  const second = evaluateWrongWayReroute({
    currentNode: { nodeId: 'hall-1', type: 'route-node' },
    expectedHeadingDegrees: 0,
    nowMs: 2000,
    observedHeadingDegrees: 90,
    state: first.state,
  });

  assert.equal(first.shouldSuggestReroute, false);
  assert.equal(first.reason, 'insufficient-opposite-duration');
  assert.equal(first.oppositeHeadingDurationMs, 0);
  assert.equal(second.shouldSuggestReroute, true);
  assert.equal(second.reason, 'opposite-heading');
  assert.equal(second.oppositeHeadingDurationMs, 1000);
});

test('tracks 1000ms wrong-way heading duration before allowing reroute', () => {
  const first = evaluateWrongWayReroute({
    currentNode: junctionNode,
    expectedHeadingDegrees: 0,
    nowMs: 1000,
    observedHeadingDegrees: 90,
    state: createWrongWayRerouteState(),
  });
  const second = evaluateWrongWayReroute({
    currentNode: junctionNode,
    expectedHeadingDegrees: 0,
    nowMs: 1999,
    observedHeadingDegrees: 90,
    state: first.state,
  });
  const third = evaluateWrongWayReroute({
    currentNode: junctionNode,
    expectedHeadingDegrees: 0,
    nowMs: 2000,
    observedHeadingDegrees: 90,
    state: second.state,
  });

  assert.equal(first.shouldSuggestReroute, false);
  assert.equal(first.reason, 'insufficient-opposite-duration');
  assert.equal(second.shouldSuggestReroute, false);
  assert.equal(second.oppositeHeadingDurationMs, 999);
  assert.equal(third.shouldSuggestReroute, true);
  assert.equal(third.reason, 'junction-opposite-heading');
  assert.equal(third.oppositeHeadingDurationMs, 1000);
});

test('does not start wrong-way timer when heading matches an accepted turn heading', () => {
  const result = evaluateWrongWayReroute({
    acceptedExpectedHeadingDegrees: [0, 90],
    currentNode: junctionNode,
    expectedHeadingDegrees: 0,
    nowMs: 2000,
    observedHeadingDegrees: 90,
    state: { oppositeHeadingStartedAtMs: 1000 },
  });

  assert.equal(result.shouldSuggestReroute, false);
  assert.equal(result.reason, 'heading-not-opposite');
  assert.equal(result.state.oppositeHeadingStartedAtMs, null);
});

test('keeps future Wi-Fi and edge checks when those inputs are provided', () => {
  const state = {
    oppositeHeadingStartedAtMs: 1000,
  };

  const result = evaluateWrongWayReroute({
    confidenceList: [{ confidence: 0.9, nodeId: 'A' }],
    currentNode: junctionNode,
    expectedHeadingDegrees: 270,
    graphEdges,
    lastReliableNodeId: 'B',
    nowMs: 2000,
    observedHeadingDegrees: 90,
    routeNodeIds: ['B', 'C'],
    state,
  });

  assert.equal(result.shouldSuggestReroute, true);
  assert.equal(result.reason, 'legal-off-route-movement');
  assert.equal(result.candidateNode?.nodeId, 'A');
  assert.equal(result.isConfidenceOffRoute, true);
  assert.equal(result.isLegalGraphMovement, true);
});

test('does not suggest reroute when the confident node is still on the planned path', () => {
  const result = evaluateWrongWayReroute({
    confidenceList: [{ confidence: 0.9, nodeId: 'C' }],
    currentNode: junctionNode,
    expectedHeadingDegrees: 270,
    graphEdges,
    lastReliableNodeId: 'B',
    nowMs: 2000,
    observedHeadingDegrees: 90,
    routeNodeIds: ['B', 'C'],
    state: { oppositeHeadingStartedAtMs: 1000 },
  });

  assert.equal(result.shouldSuggestReroute, false);
  assert.equal(result.reason, 'confidence-on-route');
});

test('does not suggest reroute for illegal graph jumps like C to A', () => {
  const result = evaluateWrongWayReroute({
    confidenceList: [{ confidence: 0.9, nodeId: 'A' }],
    currentNode: junctionNode,
    expectedHeadingDegrees: 270,
    graphEdges,
    lastReliableNodeId: 'C',
    nowMs: 2000,
    observedHeadingDegrees: 90,
    routeNodeIds: ['B', 'C'],
    state: { oppositeHeadingStartedAtMs: 1000 },
  });

  assert.equal(result.shouldSuggestReroute, false);
  assert.equal(result.reason, 'illegal-graph-jump');
  assert.equal(result.isLegalGraphMovement, false);
});

test('resets wrong-way heading timer when heading returns inside allowed deviation', () => {
  const result = evaluateWrongWayReroute({
    confidenceList: [{ confidence: 0.9, nodeId: 'A' }],
    currentNode: junctionNode,
    expectedHeadingDegrees: 0,
    graphEdges,
    lastReliableNodeId: 'B',
    nowMs: 2000,
    observedHeadingDegrees: 45,
    routeNodeIds: ['B', 'C'],
    state: { oppositeHeadingStartedAtMs: 1000 },
  });

  assert.equal(result.shouldSuggestReroute, false);
  assert.equal(result.reason, 'heading-not-opposite');
  assert.equal(result.state.oppositeHeadingStartedAtMs, null);
});

test('checks allowed heading deviation and legal graph movement helpers', () => {
  assert.equal(
    isHeadingOutsideAllowedDeviation({
      config: {
        ...DEFAULT_WRONG_WAY_REROUTE_CONFIG,
      },
      expectedHeadingDegrees: 0,
      observedHeadingDegrees: 90,
    }),
    true,
  );
  assert.equal(
    isHeadingOutsideAllowedDeviation({
      config: {
        ...DEFAULT_WRONG_WAY_REROUTE_CONFIG,
      },
      expectedHeadingDegrees: 0,
      observedHeadingDegrees: 89,
    }),
    false,
  );
  assert.equal(
    isLegalGraphMovement({
      candidateNodeId: 'A',
      edges: graphEdges,
      fromNodeId: 'B',
    }),
    true,
  );
  assert.equal(
    isLegalGraphMovement({
      candidateNodeId: 'A',
      edges: graphEdges,
      fromNodeId: 'C',
    }),
    false,
  );
});

test('rounds expected heading before checking heading deviation', () => {
  assert.equal(
    roundHeadingDegrees({
      headingDegrees: 268,
      roundDegrees: 90,
    }),
    270,
  );

  const result = evaluateWrongWayReroute({
    currentNode: junctionNode,
    expectedHeadingDegrees: 268,
    nowMs: 2000,
    observedHeadingDegrees: 90,
    state: { oppositeHeadingStartedAtMs: 1000 },
  });

  assert.equal(result.shouldSuggestReroute, true);
  assert.equal(result.reason, 'junction-opposite-heading');
});

test('finds the current junction node only inside the capture radius', () => {
  const position: RoutePosition = {
    distanceAlongRoute: 0,
    headingDegrees: 0,
    screenX: 100,
    screenY: 100,
    segmentIndex: 0,
    tiledX: 0,
    tiledY: 0,
  };
  const routeNodes: OverlayRouteNode[] = [
    {
      id: 1,
      nodeId: 'hall-1',
      screenX: 100,
      screenY: 100,
      tiledX: 0,
      tiledY: 0,
      type: 'route-node',
    },
    {
      id: 2,
      nodeId: 'junction-1',
      screenX: 120,
      screenY: 100,
      tiledX: 20,
      tiledY: 0,
      type: 'junctions',
    },
  ];

  assert.equal(
    findCurrentJunctionNode({
      config: DEFAULT_WRONG_WAY_REROUTE_CONFIG,
      position,
      routeNodes,
    })?.nodeId,
    'junction-1',
  );
  assert.equal(
    findCurrentJunctionNode({
      config: {
        ...DEFAULT_WRONG_WAY_REROUTE_CONFIG,
        junctionCaptureRadiusPixels: 10,
      },
      position,
      routeNodes,
    }),
    null,
  );
});
