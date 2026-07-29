import 'package:indoor_navigation/domain/common/angle_math.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/reroute/logic/confidence_list.dart';
import 'package:indoor_navigation/domain/reroute/logic/heading_deviation.dart';
import 'package:indoor_navigation/domain/reroute/logic/junction_position.dart';
import 'package:indoor_navigation/domain/reroute/logic/route_graph_movement.dart';
import 'package:indoor_navigation/domain/reroute/reroute_models.dart';

WrongWayRerouteState createWrongWayRerouteState() {
  return const WrongWayRerouteState(oppositeHeadingStartedAtMs: null);
}

WrongWayRerouteResult evaluateWrongWayReroute({
  List<double>? acceptedExpectedHeadingDegrees,
  List<WifiPositionConfidence>? confidenceList,
  WrongWayRerouteConfig config = defaultWrongWayRerouteConfig,
  CurrentRouteNode? currentNode,
  required double expectedHeadingDegrees,
  List<RouteGraphEdge>? graphEdges,
  String? lastReliableNodeId,
  required int nowMs,
  required double observedHeadingDegrees,
  List<String>? routeNodeIds,
  required WrongWayRerouteState state,
}) {
  final isAtJunction =
      currentNode != null &&
      isJunctionNodeType(config: config, nodeType: currentNode.type);
  final acceptedHeadings =
      acceptedExpectedHeadingDegrees != null &&
          acceptedExpectedHeadingDegrees.isNotEmpty
      ? acceptedExpectedHeadingDegrees
      : <double>[expectedHeadingDegrees];
  final isHeadingOpposite = acceptedHeadings.every(
    (headingDegrees) => isHeadingOutsideAllowedDeviation(
      config: config,
      expectedHeadingDegrees: roundHeadingDegrees(
        headingDegrees: headingDegrees,
        roundDegrees: config.expectedHeadingRoundDegrees,
      ),
      observedHeadingDegrees: observedHeadingDegrees,
    ),
  );
  final oppositeHeadingStartedAtMs = isHeadingOpposite
      ? state.oppositeHeadingStartedAtMs ?? nowMs
      : null;
  final nextState = WrongWayRerouteState(
    oppositeHeadingStartedAtMs: oppositeHeadingStartedAtMs,
  );
  final oppositeHeadingDurationMs = oppositeHeadingStartedAtMs == null
      ? 0
      : nowMs - oppositeHeadingStartedAtMs;
  final resolvedConfidenceList =
      confidenceList ?? const <WifiPositionConfidence>[];
  final resolvedRouteNodeIds = routeNodeIds ?? const <String>[];
  final resolvedGraphEdges = graphEdges ?? const <RouteGraphEdge>[];
  final candidateNode = getTopConfidenceNode(resolvedConfidenceList);
  final shouldCheckConfidence = resolvedConfidenceList.isNotEmpty;
  final shouldCheckGraphMovement =
      resolvedGraphEdges.isNotEmpty &&
      candidateNode != null &&
      lastReliableNodeId != null &&
      lastReliableNodeId.isNotEmpty;
  final isConfidentEnough =
      candidateNode != null &&
      candidateNode.confidence >= config.confidenceThreshold;
  final isConfidenceOffRoute =
      candidateNode != null &&
      !isNodeOnRoute(
        nodeId: candidateNode.nodeId,
        routeNodeIds: resolvedRouteNodeIds,
      );
  final isLegalOffRouteMovement =
      shouldCheckGraphMovement &&
      isLegalGraphMovement(
        candidateNodeId: candidateNode.nodeId,
        edges: resolvedGraphEdges,
        fromNodeId: lastReliableNodeId,
      );

  if (!isAtJunction && !isHeadingOpposite) {
    return _createResult(
      candidateNode: candidateNode,
      currentNode: currentNode,
      isAtJunction: isAtJunction,
      isConfidenceOffRoute: isConfidenceOffRoute,
      isHeadingOpposite: isHeadingOpposite,
      isLegalGraphMovement: false,
      oppositeHeadingDurationMs: oppositeHeadingDurationMs,
      reason: WrongWayRerouteReason.notAtJunction,
      shouldSuggestReroute: false,
      state: nextState,
    );
  }

  if (!isHeadingOpposite) {
    return _createResult(
      candidateNode: candidateNode,
      currentNode: currentNode,
      isAtJunction: isAtJunction,
      isConfidenceOffRoute: isConfidenceOffRoute,
      isHeadingOpposite: isHeadingOpposite,
      isLegalGraphMovement: isLegalOffRouteMovement,
      oppositeHeadingDurationMs: oppositeHeadingDurationMs,
      reason: WrongWayRerouteReason.headingNotOpposite,
      shouldSuggestReroute: false,
      state: nextState,
    );
  }

  if (oppositeHeadingDurationMs < config.minimumOppositeHeadingDurationMs) {
    return _createResult(
      candidateNode: candidateNode,
      currentNode: currentNode,
      isAtJunction: isAtJunction,
      isConfidenceOffRoute: isConfidenceOffRoute,
      isHeadingOpposite: isHeadingOpposite,
      isLegalGraphMovement: isLegalOffRouteMovement,
      oppositeHeadingDurationMs: oppositeHeadingDurationMs,
      reason: WrongWayRerouteReason.insufficientOppositeDuration,
      shouldSuggestReroute: false,
      state: nextState,
    );
  }

  if (!isAtJunction) {
    return _createResult(
      candidateNode: candidateNode,
      currentNode: currentNode,
      isAtJunction: isAtJunction,
      isConfidenceOffRoute: isConfidenceOffRoute,
      isHeadingOpposite: isHeadingOpposite,
      isLegalGraphMovement: false,
      oppositeHeadingDurationMs: oppositeHeadingDurationMs,
      reason: WrongWayRerouteReason.oppositeHeading,
      shouldSuggestReroute: true,
      state: nextState,
    );
  }

  if (!shouldCheckConfidence) {
    return _createResult(
      candidateNode: candidateNode,
      currentNode: currentNode,
      isAtJunction: isAtJunction,
      isConfidenceOffRoute: isConfidenceOffRoute,
      isHeadingOpposite: isHeadingOpposite,
      isLegalGraphMovement: false,
      oppositeHeadingDurationMs: oppositeHeadingDurationMs,
      reason: WrongWayRerouteReason.junctionOppositeHeading,
      shouldSuggestReroute: true,
      state: nextState,
    );
  }

  if (!isConfidentEnough) {
    return _createResult(
      candidateNode: candidateNode,
      currentNode: currentNode,
      isAtJunction: isAtJunction,
      isConfidenceOffRoute: isConfidenceOffRoute,
      isHeadingOpposite: isHeadingOpposite,
      isLegalGraphMovement: isLegalOffRouteMovement,
      oppositeHeadingDurationMs: oppositeHeadingDurationMs,
      reason: WrongWayRerouteReason.insufficientConfidence,
      shouldSuggestReroute: false,
      state: nextState,
    );
  }

  if (!isConfidenceOffRoute) {
    return _createResult(
      candidateNode: candidateNode,
      currentNode: currentNode,
      isAtJunction: isAtJunction,
      isConfidenceOffRoute: isConfidenceOffRoute,
      isHeadingOpposite: isHeadingOpposite,
      isLegalGraphMovement: isLegalOffRouteMovement,
      oppositeHeadingDurationMs: oppositeHeadingDurationMs,
      reason: WrongWayRerouteReason.confidenceOnRoute,
      shouldSuggestReroute: false,
      state: nextState,
    );
  }

  if (shouldCheckGraphMovement && !isLegalOffRouteMovement) {
    return _createResult(
      candidateNode: candidateNode,
      currentNode: currentNode,
      isAtJunction: isAtJunction,
      isConfidenceOffRoute: isConfidenceOffRoute,
      isHeadingOpposite: isHeadingOpposite,
      isLegalGraphMovement: false,
      oppositeHeadingDurationMs: oppositeHeadingDurationMs,
      reason: WrongWayRerouteReason.illegalGraphJump,
      shouldSuggestReroute: false,
      state: nextState,
    );
  }

  return _createResult(
    candidateNode: candidateNode,
    currentNode: currentNode,
    isAtJunction: isAtJunction,
    isConfidenceOffRoute: isConfidenceOffRoute,
    isHeadingOpposite: isHeadingOpposite,
    isLegalGraphMovement: shouldCheckGraphMovement
        ? isLegalOffRouteMovement
        : false,
    oppositeHeadingDurationMs: oppositeHeadingDurationMs,
    reason: shouldCheckGraphMovement
        ? WrongWayRerouteReason.legalOffRouteMovement
        : WrongWayRerouteReason.junctionOppositeHeading,
    shouldSuggestReroute: true,
    state: nextState,
  );
}

WrongWayRerouteResult _createResult({
  required WifiPositionConfidence? candidateNode,
  required CurrentRouteNode? currentNode,
  required bool isAtJunction,
  required bool isConfidenceOffRoute,
  required bool isHeadingOpposite,
  required bool isLegalGraphMovement,
  required int oppositeHeadingDurationMs,
  required WrongWayRerouteReason reason,
  required bool shouldSuggestReroute,
  required WrongWayRerouteState state,
}) {
  return WrongWayRerouteResult(
    candidateNode: candidateNode,
    currentNode: currentNode,
    isConfidenceOffRoute: isConfidenceOffRoute,
    isAtJunction: isAtJunction,
    isHeadingOpposite: isHeadingOpposite,
    isLegalGraphMovement: isLegalGraphMovement,
    oppositeHeadingDurationMs: oppositeHeadingDurationMs,
    reason: reason,
    shouldSuggestReroute: shouldSuggestReroute,
    state: state,
  );
}
