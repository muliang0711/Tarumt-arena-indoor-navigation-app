import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/reroute/logic/wrong_way_reroute.dart';
import 'package:indoor_navigation/domain/reroute/reroute_models.dart';

const graphEdges = <RouteGraphEdge>[
  RouteGraphEdge(fromNodeId: 'B', toNodeId: 'C'),
  RouteGraphEdge(fromNodeId: 'B', toNodeId: 'A'),
];
const junctionNode = CurrentRouteNode(nodeId: 'B', type: 'junctions');

void main() {
  test('normal heading outside junction resets timer', () {
    final result = evaluateWrongWayReroute(
      currentNode: const CurrentRouteNode(nodeId: 'hall-1', type: 'route-node'),
      expectedHeadingDegrees: 270,
      nowMs: 1400,
      observedHeadingDegrees: 270,
      state: const WrongWayRerouteState(oppositeHeadingStartedAtMs: 1000),
    );

    _expectReason(result, WrongWayRerouteReason.notAtJunction, suggest: false);
    expect(result.isAtJunction, isFalse);
    expect(result.state.oppositeHeadingStartedAtMs, isNull);
  });

  test('sustained opposite heading outside junction suggests reroute', () {
    final first = evaluateWrongWayReroute(
      currentNode: const CurrentRouteNode(nodeId: 'hall-1', type: 'route-node'),
      expectedHeadingDegrees: 0,
      nowMs: 1000,
      observedHeadingDegrees: 90,
      state: createWrongWayRerouteState(),
    );
    final second = evaluateWrongWayReroute(
      currentNode: const CurrentRouteNode(nodeId: 'hall-1', type: 'route-node'),
      expectedHeadingDegrees: 0,
      nowMs: 2000,
      observedHeadingDegrees: 90,
      state: first.state,
    );

    _expectReason(
      first,
      WrongWayRerouteReason.insufficientOppositeDuration,
      suggest: false,
    );
    expect(first.oppositeHeadingDurationMs, 0);
    _expectReason(second, WrongWayRerouteReason.oppositeHeading, suggest: true);
    expect(second.oppositeHeadingDurationMs, 1000);
  });

  test('timer is continuous and minimum duration boundary is inclusive', () {
    final first = evaluateWrongWayReroute(
      currentNode: junctionNode,
      expectedHeadingDegrees: 0,
      nowMs: 1000,
      observedHeadingDegrees: 90,
      state: createWrongWayRerouteState(),
    );
    final second = evaluateWrongWayReroute(
      currentNode: junctionNode,
      expectedHeadingDegrees: 0,
      nowMs: 1999,
      observedHeadingDegrees: 90,
      state: first.state,
    );
    final third = evaluateWrongWayReroute(
      currentNode: junctionNode,
      expectedHeadingDegrees: 0,
      nowMs: 2000,
      observedHeadingDegrees: 90,
      state: second.state,
    );

    _expectReason(
      second,
      WrongWayRerouteReason.insufficientOppositeDuration,
      suggest: false,
    );
    expect(second.oppositeHeadingDurationMs, 999);
    _expectReason(
      third,
      WrongWayRerouteReason.junctionOppositeHeading,
      suggest: true,
    );
    expect(third.oppositeHeadingDurationMs, 1000);
  });

  test('accepted turn heading resets opposite timer', () {
    final result = evaluateWrongWayReroute(
      acceptedExpectedHeadingDegrees: const <double>[0, 90],
      currentNode: junctionNode,
      expectedHeadingDegrees: 0,
      nowMs: 2000,
      observedHeadingDegrees: 90,
      state: const WrongWayRerouteState(oppositeHeadingStartedAtMs: 1000),
    );

    _expectReason(
      result,
      WrongWayRerouteReason.headingNotOpposite,
      suggest: false,
    );
    expect(result.state.oppositeHeadingStartedAtMs, isNull);
  });

  test('empty accepted heading list falls back to expected heading', () {
    final result = evaluateWrongWayReroute(
      acceptedExpectedHeadingDegrees: const <double>[],
      currentNode: junctionNode,
      expectedHeadingDegrees: 0,
      nowMs: 2000,
      observedHeadingDegrees: 90,
      state: const WrongWayRerouteState(oppositeHeadingStartedAtMs: 1000),
    );

    expect(result.isHeadingOpposite, isTrue);
    _expectReason(
      result,
      WrongWayRerouteReason.junctionOppositeHeading,
      suggest: true,
    );
  });

  test('legal confident off-route movement suggests reroute', () {
    final result = _evaluateWithConfidence(
      candidate: const WifiPositionConfidence(confidence: 0.9, nodeId: 'A'),
      lastReliableNodeId: 'B',
    );

    _expectReason(
      result,
      WrongWayRerouteReason.legalOffRouteMovement,
      suggest: true,
    );
    expect(result.candidateNode?.nodeId, 'A');
    expect(result.isConfidenceOffRoute, isTrue);
    expect(result.isLegalGraphMovement, isTrue);
  });

  test('confident node on planned route does not suggest reroute', () {
    final result = _evaluateWithConfidence(
      candidate: const WifiPositionConfidence(confidence: 0.9, nodeId: 'C'),
      lastReliableNodeId: 'B',
    );

    _expectReason(
      result,
      WrongWayRerouteReason.confidenceOnRoute,
      suggest: false,
    );
  });

  test('illegal graph jump does not suggest reroute', () {
    final result = _evaluateWithConfidence(
      candidate: const WifiPositionConfidence(confidence: 0.9, nodeId: 'A'),
      lastReliableNodeId: 'C',
    );

    _expectReason(
      result,
      WrongWayRerouteReason.illegalGraphJump,
      suggest: false,
    );
    expect(result.isLegalGraphMovement, isFalse);
  });

  test('confidence threshold is inclusive and below threshold is rejected', () {
    final below = _evaluateWithConfidence(
      candidate: const WifiPositionConfidence(confidence: 0.649, nodeId: 'A'),
      lastReliableNodeId: 'B',
    );
    final boundary = _evaluateWithConfidence(
      candidate: const WifiPositionConfidence(confidence: 0.65, nodeId: 'A'),
      lastReliableNodeId: 'B',
    );

    _expectReason(
      below,
      WrongWayRerouteReason.insufficientConfidence,
      suggest: false,
    );
    _expectReason(
      boundary,
      WrongWayRerouteReason.legalOffRouteMovement,
      suggest: true,
    );
  });

  test('off-route confidence without graph inputs uses junction reason', () {
    final result = evaluateWrongWayReroute(
      confidenceList: const <WifiPositionConfidence>[
        WifiPositionConfidence(confidence: 0.9, nodeId: 'A'),
      ],
      currentNode: junctionNode,
      expectedHeadingDegrees: 270,
      nowMs: 2000,
      observedHeadingDegrees: 90,
      routeNodeIds: const <String>['B', 'C'],
      state: const WrongWayRerouteState(oppositeHeadingStartedAtMs: 1000),
    );

    _expectReason(
      result,
      WrongWayRerouteReason.junctionOppositeHeading,
      suggest: true,
    );
    expect(result.isLegalGraphMovement, isFalse);
  });

  test('empty last reliable node does not enable graph checking', () {
    final result = _evaluateWithConfidence(
      candidate: const WifiPositionConfidence(confidence: 0.9, nodeId: 'A'),
      lastReliableNodeId: '',
    );

    _expectReason(
      result,
      WrongWayRerouteReason.junctionOppositeHeading,
      suggest: true,
    );
  });

  test('rounds every accepted expected heading before deviation check', () {
    final result = evaluateWrongWayReroute(
      acceptedExpectedHeadingDegrees: const <double>[268, 2],
      currentNode: junctionNode,
      expectedHeadingDegrees: 0,
      nowMs: 2000,
      observedHeadingDegrees: 180,
      state: const WrongWayRerouteState(oppositeHeadingStartedAtMs: 1000),
    );

    expect(result.isHeadingOpposite, isTrue);
    _expectReason(
      result,
      WrongWayRerouteReason.junctionOppositeHeading,
      suggest: true,
    );
  });

  test('current node junction type matching trims and ignores case', () {
    final result = evaluateWrongWayReroute(
      currentNode: const CurrentRouteNode(nodeId: 'B', type: ' JUNCTIONS '),
      expectedHeadingDegrees: 270,
      nowMs: 2000,
      observedHeadingDegrees: 90,
      state: const WrongWayRerouteState(oppositeHeadingStartedAtMs: 1000),
    );

    expect(result.isAtJunction, isTrue);
  });
}

WrongWayRerouteResult _evaluateWithConfidence({
  required WifiPositionConfidence candidate,
  required String? lastReliableNodeId,
}) {
  return evaluateWrongWayReroute(
    confidenceList: <WifiPositionConfidence>[candidate],
    currentNode: junctionNode,
    expectedHeadingDegrees: 270,
    graphEdges: graphEdges,
    lastReliableNodeId: lastReliableNodeId,
    nowMs: 2000,
    observedHeadingDegrees: 90,
    routeNodeIds: const <String>['B', 'C'],
    state: const WrongWayRerouteState(oppositeHeadingStartedAtMs: 1000),
  );
}

void _expectReason(
  WrongWayRerouteResult result,
  WrongWayRerouteReason reason, {
  required bool suggest,
}) {
  expect(result.reason, reason);
  expect(result.shouldSuggestReroute, suggest);
}
