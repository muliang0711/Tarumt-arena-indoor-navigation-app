enum WrongWayRerouteReason {
  confidenceOnRoute('confidence-on-route'),
  headingNotOpposite('heading-not-opposite'),
  illegalGraphJump('illegal-graph-jump'),
  insufficientConfidence('insufficient-confidence'),
  insufficientOppositeDuration('insufficient-opposite-duration'),
  junctionOppositeHeading('junction-opposite-heading'),
  legalOffRouteMovement('legal-off-route-movement'),
  notAtJunction('not-at-junction'),
  oppositeHeading('opposite-heading');

  const WrongWayRerouteReason(this.wireValue);
  final String wireValue;
}

final class RouteGraphEdge {
  const RouteGraphEdge({required this.fromNodeId, required this.toNodeId});

  final String fromNodeId;
  final String toNodeId;
}

final class WifiPositionConfidence {
  const WifiPositionConfidence({
    required this.confidence,
    required this.nodeId,
  });

  final double confidence;
  final String nodeId;
}

final class WrongWayRerouteConfig {
  const WrongWayRerouteConfig({
    required this.allowedHeadingDeviationDegrees,
    required this.confidenceThreshold,
    required this.expectedHeadingRoundDegrees,
    required this.junctionCaptureRadiusPixels,
    required this.junctionNodeType,
    required this.minimumOppositeHeadingDurationMs,
    required this.wrongWayCheckIntervalMs,
  });

  final double allowedHeadingDeviationDegrees;
  final double confidenceThreshold;
  final double expectedHeadingRoundDegrees;
  final double junctionCaptureRadiusPixels;
  final String junctionNodeType;
  final int minimumOppositeHeadingDurationMs;
  final int wrongWayCheckIntervalMs;
}

final class WrongWayRerouteState {
  const WrongWayRerouteState({required this.oppositeHeadingStartedAtMs});

  final int? oppositeHeadingStartedAtMs;
}

final class CurrentRouteNode {
  const CurrentRouteNode({required this.nodeId, required this.type});

  final String nodeId;
  final String type;
}

final class WrongWayRerouteResult {
  const WrongWayRerouteResult({
    required this.candidateNode,
    required this.currentNode,
    required this.isConfidenceOffRoute,
    required this.isAtJunction,
    required this.isHeadingOpposite,
    required this.isLegalGraphMovement,
    required this.oppositeHeadingDurationMs,
    required this.reason,
    required this.shouldSuggestReroute,
    required this.state,
  });

  final WifiPositionConfidence? candidateNode;
  final CurrentRouteNode? currentNode;
  final bool isConfidenceOffRoute;
  final bool isAtJunction;
  final bool isHeadingOpposite;
  final bool isLegalGraphMovement;
  final int oppositeHeadingDurationMs;
  final WrongWayRerouteReason reason;
  final bool shouldSuggestReroute;
  final WrongWayRerouteState state;
}
