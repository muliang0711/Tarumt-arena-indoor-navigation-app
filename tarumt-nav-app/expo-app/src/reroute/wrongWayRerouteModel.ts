import { getTopConfidenceNode } from './confidenceListModel';
import { isHeadingOutsideAllowedDeviation } from './headingDeviationModel';
import { roundHeadingDegrees } from './headingRoundModel';
import { isJunctionNodeType } from './junctionPositionModel';
import {
  isLegalGraphMovement,
  isNodeOnRoute,
} from './routeGraphMovementModel';
import type {
  RouteGraphEdge,
  WifiPositionConfidence,
  WrongWayRerouteConfig,
  WrongWayRerouteResult,
  WrongWayRerouteState,
} from './type';
import { DEFAULT_WRONG_WAY_REROUTE_CONFIG } from './wrongWayRerouteConfig';

export function createWrongWayRerouteState(): WrongWayRerouteState {
  return {
    oppositeHeadingStartedAtMs: null,
  };
}

export function evaluateWrongWayReroute(input: {
  acceptedExpectedHeadingDegrees?: readonly number[];
  confidenceList?: readonly WifiPositionConfidence[];
  config?: Partial<WrongWayRerouteConfig>;
  currentNode?:
    | {
        nodeId: string;
        type: string;
      }
    | null;
  expectedHeadingDegrees: number;
  graphEdges?: readonly RouteGraphEdge[];
  lastReliableNodeId?: string | null;
  nowMs: number;
  observedHeadingDegrees: number;
  routeNodeIds?: readonly string[];
  state: WrongWayRerouteState;
}): WrongWayRerouteResult {
  const config = {
    ...DEFAULT_WRONG_WAY_REROUTE_CONFIG,
    ...input.config,
  };
  const currentNode = input.currentNode ?? null;
  const isAtJunction =
    !!currentNode &&
    isJunctionNodeType({
      config,
      node: currentNode,
    });
  const acceptedExpectedHeadingDegrees =
    input.acceptedExpectedHeadingDegrees &&
    input.acceptedExpectedHeadingDegrees.length > 0
      ? input.acceptedExpectedHeadingDegrees
      : [input.expectedHeadingDegrees];
  const isHeadingOpposite = acceptedExpectedHeadingDegrees.every(
    (headingDegrees) =>
      isHeadingOutsideAllowedDeviation({
        config,
        expectedHeadingDegrees: roundHeadingDegrees({
          headingDegrees,
          roundDegrees: config.expectedHeadingRoundDegrees,
        }),
        observedHeadingDegrees: input.observedHeadingDegrees,
      }),
  );
  const oppositeHeadingStartedAtMs = isHeadingOpposite
    ? input.state.oppositeHeadingStartedAtMs ?? input.nowMs
    : null;
  const nextState = {
    oppositeHeadingStartedAtMs,
  };
  const oppositeHeadingDurationMs =
    oppositeHeadingStartedAtMs === null
      ? 0
      : input.nowMs - oppositeHeadingStartedAtMs;
  const confidenceList = input.confidenceList ?? [];
  const routeNodeIds = input.routeNodeIds ?? [];
  const graphEdges = input.graphEdges ?? [];
  const candidateNode = getTopConfidenceNode(confidenceList);
  const shouldCheckConfidence = confidenceList.length > 0;
  const shouldCheckGraphMovement =
    graphEdges.length > 0 && !!candidateNode && !!input.lastReliableNodeId;
  const isConfidentEnough =
    !!candidateNode && candidateNode.confidence >= config.confidenceThreshold;
  const isConfidenceOffRoute =
    !!candidateNode &&
    !isNodeOnRoute({
      nodeId: candidateNode.nodeId,
      routeNodeIds,
    });
  const isLegalOffRouteMovement =
    shouldCheckGraphMovement &&
    isLegalGraphMovement({
      candidateNodeId: candidateNode.nodeId,
      edges: graphEdges,
      fromNodeId: input.lastReliableNodeId ?? '',
    });

  if (!isAtJunction && !isHeadingOpposite) {
    return createResult({
      candidateNode,
      currentNode,
      isAtJunction,
      isConfidenceOffRoute,
      isHeadingOpposite,
      isLegalGraphMovement: false,
      oppositeHeadingDurationMs,
      reason: 'not-at-junction',
      shouldSuggestReroute: false,
      state: nextState,
    });
  }

  if (!isHeadingOpposite) {
    return createResult({
      candidateNode,
      currentNode,
      isAtJunction,
      isConfidenceOffRoute,
      isHeadingOpposite,
      isLegalGraphMovement: isLegalOffRouteMovement,
      oppositeHeadingDurationMs,
      reason: 'heading-not-opposite',
      shouldSuggestReroute: false,
      state: nextState,
    });
  }

  if (oppositeHeadingDurationMs < config.minimumOppositeHeadingDurationMs) {
    return createResult({
      candidateNode,
      currentNode,
      isAtJunction,
      isConfidenceOffRoute,
      isHeadingOpposite,
      isLegalGraphMovement: isLegalOffRouteMovement,
      oppositeHeadingDurationMs,
      reason: 'insufficient-opposite-duration',
      shouldSuggestReroute: false,
      state: nextState,
    });
  }

  if (!isAtJunction) {
    return createResult({
      candidateNode,
      currentNode,
      isAtJunction,
      isConfidenceOffRoute,
      isHeadingOpposite,
      isLegalGraphMovement: false,
      oppositeHeadingDurationMs,
      reason: 'opposite-heading',
      shouldSuggestReroute: true,
      state: nextState,
    });
  }

  if (!shouldCheckConfidence) {
    return createResult({
      candidateNode,
      currentNode,
      isAtJunction,
      isConfidenceOffRoute,
      isHeadingOpposite,
      isLegalGraphMovement: false,
      oppositeHeadingDurationMs,
      reason: 'junction-opposite-heading',
      shouldSuggestReroute: true,
      state: nextState,
    });
  }

  if (!isConfidentEnough) {
    return createResult({
      candidateNode,
      currentNode,
      isAtJunction,
      isConfidenceOffRoute,
      isHeadingOpposite,
      isLegalGraphMovement: isLegalOffRouteMovement,
      oppositeHeadingDurationMs,
      reason: 'insufficient-confidence',
      shouldSuggestReroute: false,
      state: nextState,
    });
  }

  if (!isConfidenceOffRoute) {
    return createResult({
      candidateNode,
      currentNode,
      isAtJunction,
      isConfidenceOffRoute,
      isHeadingOpposite,
      isLegalGraphMovement: isLegalOffRouteMovement,
      oppositeHeadingDurationMs,
      reason: 'confidence-on-route',
      shouldSuggestReroute: false,
      state: nextState,
    });
  }

  if (shouldCheckGraphMovement && !isLegalOffRouteMovement) {
    return createResult({
      candidateNode,
      currentNode,
      isAtJunction,
      isConfidenceOffRoute,
      isHeadingOpposite,
      isLegalGraphMovement: false,
      oppositeHeadingDurationMs,
      reason: 'illegal-graph-jump',
      shouldSuggestReroute: false,
      state: nextState,
    });
  }

  return createResult({
    candidateNode,
    currentNode,
    isAtJunction,
    isConfidenceOffRoute,
    isHeadingOpposite,
    isLegalGraphMovement: shouldCheckGraphMovement
      ? isLegalOffRouteMovement
      : false,
    oppositeHeadingDurationMs,
    reason: shouldCheckGraphMovement
      ? 'legal-off-route-movement'
      : 'junction-opposite-heading',
    shouldSuggestReroute: true,
    state: nextState,
  });
}

function createResult(input: WrongWayRerouteResult): WrongWayRerouteResult {
  return input;
}
