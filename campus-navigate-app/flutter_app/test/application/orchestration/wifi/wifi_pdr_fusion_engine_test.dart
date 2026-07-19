import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_pdr_fusion_engine.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_engine.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

const _current = RoutePosition(
  distanceAlongRoute: 0,
  headingDegrees: 90,
  screenX: 0,
  screenY: 0,
  segmentIndex: 0,
  tiledX: 0,
  tiledY: 0,
);

void main() {
  test('accepts a nearby trusted fix immediately as a smooth correction', () {
    final engine = WifiPdrFusionEngine();

    final decision = engine.evaluate(
      currentPosition: _current,
      destinationNodeId: 'destination',
      fix: _fix(nodeId: 'node-b', observedAtMs: 1000),
      pixelsPerMeter: 10,
      trustedNode: _node(nodeId: 'node-b', screenX: 15),
    );

    expect(decision.status, WifiCorrectionDecisionStatus.accepted);
    expect(decision.kind, WifiCorrectionKind.smooth);
    expect(decision.driftMeters, 1.5);
    expect(engine.isAwaitingConfirmation, isFalse);
  });

  test('requires two matching fixes before a teleport correction', () {
    final engine = WifiPdrFusionEngine();
    final node = _node(nodeId: 'node-b', screenX: 80);

    final first = engine.evaluate(
      currentPosition: _current,
      destinationNodeId: 'destination',
      fix: _fix(nodeId: 'node-b', observedAtMs: 1000),
      pixelsPerMeter: 10,
      trustedNode: node,
    );
    final second = engine.evaluate(
      currentPosition: _current,
      destinationNodeId: 'destination',
      fix: _fix(nodeId: 'node-b', observedAtMs: 6000),
      pixelsPerMeter: 10,
      trustedNode: node,
    );

    expect(first.status, WifiCorrectionDecisionStatus.pendingConfirmation);
    expect(first.kind, WifiCorrectionKind.teleport);
    expect(second.status, WifiCorrectionDecisionStatus.accepted);
    expect(second.kind, WifiCorrectionKind.teleport);
    expect(engine.isAwaitingConfirmation, isFalse);
  });

  test('never ends navigation from a single destination prediction', () {
    final engine = WifiPdrFusionEngine();
    final destination = _node(nodeId: 'destination', screenX: 10);

    final first = engine.evaluate(
      currentPosition: _current,
      destinationNodeId: 'destination',
      fix: _fix(nodeId: 'destination', observedAtMs: 1000),
      pixelsPerMeter: 10,
      trustedNode: destination,
    );
    final second = engine.evaluate(
      currentPosition: _current,
      destinationNodeId: 'destination',
      fix: _fix(nodeId: 'destination', observedAtMs: 5000),
      pixelsPerMeter: 10,
      trustedNode: destination,
    );

    expect(first.status, WifiCorrectionDecisionStatus.pendingConfirmation);
    expect(first.kind, WifiCorrectionKind.smooth);
    expect(second.status, WifiCorrectionDecisionStatus.accepted);
  });

  test('a different or expired result replaces pending confidence', () {
    final engine = WifiPdrFusionEngine();

    for (final entry in <({String nodeId, int observedAtMs})>[
      (nodeId: 'node-b', observedAtMs: 1000),
      (nodeId: 'node-c', observedAtMs: 5000),
      (nodeId: 'node-c', observedAtMs: 25000),
    ]) {
      final decision = engine.evaluate(
        currentPosition: _current,
        destinationNodeId: 'destination',
        fix: _fix(nodeId: entry.nodeId, observedAtMs: entry.observedAtMs),
        pixelsPerMeter: 10,
        trustedNode: _node(nodeId: entry.nodeId, screenX: 80),
      );
      expect(decision.status, WifiCorrectionDecisionStatus.pendingConfirmation);
    }
  });
}

WifiPositionFix _fix({required String nodeId, required int observedAtMs}) {
  return WifiPositionFix(
    floorId: 'floor-2',
    localNodeId: nodeId,
    observedAtMs: observedAtMs,
    readingCount: 3,
    serverNodeId: nodeId,
  );
}

OverlayRouteNode _node({required String nodeId, required double screenX}) {
  return OverlayRouteNode(
    id: nodeId.hashCode,
    nodeId: nodeId,
    screenX: screenX,
    screenY: 0,
    tiledX: screenX,
    tiledY: 0,
    type: 'navigation',
  );
}
