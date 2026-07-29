import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_pdr_fusion_engine.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_engine.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';
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
      fix: _fix(nodeId: 'node-b', observedAtMs: 1000),
      pixelsPerMeter: 10,
      trustedNode: _node(nodeId: 'node-b', screenX: 15),
    );

    expect(decision.kind, WifiCorrectionKind.smooth);
    expect(decision.driftMeters, 1.5);
  });

  test('accepts a single far fix immediately as a teleport correction', () {
    final engine = WifiPdrFusionEngine();
    final node = _node(nodeId: 'node-b', screenX: 80);

    final decision = engine.evaluate(
      currentPosition: _current,
      fix: _fix(nodeId: 'node-b', observedAtMs: 1000),
      pixelsPerMeter: 10,
      trustedNode: node,
    );

    expect(decision.kind, WifiCorrectionKind.teleport);
    expect(decision.driftMeters, 8);
  });

  test('treats a mapped destination fix as immediately authoritative', () {
    final engine = WifiPdrFusionEngine();
    final destination = _node(nodeId: 'destination', screenX: 10);

    final decision = engine.evaluate(
      currentPosition: _current,
      fix: _fix(nodeId: 'destination', observedAtMs: 1000),
      pixelsPerMeter: 10,
      trustedNode: destination,
    );

    expect(decision.kind, WifiCorrectionKind.smooth);
    expect(decision.fix.localNodeId, 'destination');
  });

  test('uses the teleport threshold only to classify the animation', () {
    final engine = WifiPdrFusionEngine(
      config: const WifiPdrFusionConfig(teleportThresholdMeters: 3),
    );

    final decision = engine.evaluate(
      currentPosition: _current,
      fix: _fix(nodeId: 'node-b', observedAtMs: 1000),
      pixelsPerMeter: 10,
      trustedNode: _node(nodeId: 'node-b', screenX: 30),
    );

    expect(decision.kind, WifiCorrectionKind.smooth);
  });

  test('treats the current segment start as a consistent no-op', () {
    final decision = WifiPdrFusionEngine().evaluate(
      currentPosition: const RoutePosition(
        distanceAlongRoute: 25,
        headingDegrees: 0,
        screenX: 25,
        screenY: 0,
        segmentIndex: 0,
        tiledX: 25,
        tiledY: 0,
      ),
      fix: _fix(nodeId: 'node-a', observedAtMs: 1000),
      pixelsPerMeter: 10,
      routePath: const <OverlayRouteNode>[
        _routeNodeA,
        _routeNodeB,
        _routeNodeC,
      ],
      trustedNode: _routeNodeA,
    );

    expect(decision.disposition, WifiCorrectionDisposition.noOpConsistent);
    expect(decision.shouldApply, isFalse);
  });

  test('defers an earlier route node unless wrong-way is detected', () {
    const current = RoutePosition(
      distanceAlongRoute: 125,
      headingDegrees: 0,
      screenX: 125,
      screenY: 0,
      segmentIndex: 1,
      tiledX: 125,
      tiledY: 0,
    );
    const route = <OverlayRouteNode>[_routeNodeA, _routeNodeB, _routeNodeC];
    final engine = WifiPdrFusionEngine();

    final forwardDecision = engine.evaluate(
      currentPosition: current,
      fix: _fix(nodeId: 'node-a', observedAtMs: 1000),
      pixelsPerMeter: 10,
      routePath: route,
      trustedNode: _routeNodeA,
    );
    final wrongWayDecision = engine.evaluate(
      currentPosition: current,
      fix: _fix(nodeId: 'node-a', observedAtMs: 2000),
      pixelsPerMeter: 10,
      routePath: route,
      trustedNode: _routeNodeA,
      wrongWayDetected: true,
    );

    expect(
      forwardDecision.disposition,
      WifiCorrectionDisposition.deferBackward,
    );
    expect(wrongWayDecision.disposition, WifiCorrectionDisposition.apply);
  });
}

WifiPositionFix _fix({required String nodeId, required int observedAtMs}) {
  return WifiPositionFix(
    floorId: 'floor-2',
    localNodeId: nodeId,
    observedAtMs: observedAtMs,
    readingTier: WifiPositioningReadingTier.fresh,
    readingCount: 3,
    scanSource: WifiScanBatchSource.active,
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

const _routeNodeA = OverlayRouteNode(
  id: 1,
  nodeId: 'node-a',
  screenX: 0,
  screenY: 0,
  tiledX: 0,
  tiledY: 0,
  type: 'navigation',
);

const _routeNodeB = OverlayRouteNode(
  id: 2,
  nodeId: 'node-b',
  screenX: 100,
  screenY: 0,
  tiledX: 100,
  tiledY: 0,
  type: 'navigation',
);

const _routeNodeC = OverlayRouteNode(
  id: 3,
  nodeId: 'node-c',
  screenX: 200,
  screenY: 0,
  tiledX: 200,
  tiledY: 0,
  type: 'navigation',
);
