import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/common/angle_math.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/reroute/logic/reroute.dart';
import 'package:indoor_navigation/domain/reroute/reroute_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

void main() {
  group('confidence ranking', () {
    test('returns the highest confidence and preserves the first tie', () {
      const firstTop = WifiPositionConfidence(confidence: 0.9, nodeId: 'A');
      const tiedTop = WifiPositionConfidence(confidence: 0.9, nodeId: 'B');

      expect(
        identical(
          getTopConfidenceNode(const <WifiPositionConfidence>[
            WifiPositionConfidence(confidence: 0.5, nodeId: 'low'),
            firstTop,
            tiedTop,
          ]),
          firstTop,
        ),
        isTrue,
      );
      expect(getTopConfidenceNode(const <WifiPositionConfidence>[]), isNull);
    });

    test('preserves JavaScript reduction order around NaN confidence', () {
      const first = WifiPositionConfidence(
        confidence: double.nan,
        nodeId: 'nan',
      );
      expect(
        getTopConfidenceNode(const <WifiPositionConfidence>[
          first,
          WifiPositionConfidence(confidence: 1, nodeId: 'finite'),
        ]),
        same(first),
      );
    });
  });

  test('uses inclusive heading deviation and wrap-around distance', () {
    expect(
      isHeadingOutsideAllowedDeviation(
        config: defaultWrongWayRerouteConfig,
        expectedHeadingDegrees: 0,
        observedHeadingDegrees: 90,
      ),
      isTrue,
    );
    expect(
      isHeadingOutsideAllowedDeviation(
        config: defaultWrongWayRerouteConfig,
        expectedHeadingDegrees: 0,
        observedHeadingDegrees: 89,
      ),
      isFalse,
    );
    expect(
      isOppositeHeading(
        config: defaultWrongWayRerouteConfig,
        expectedHeadingDegrees: 350,
        observedHeadingDegrees: 80,
      ),
      isTrue,
    );
    expect(roundHeadingDegrees(headingDegrees: 268, roundDegrees: 90), 270);
  });

  group('junction capture', () {
    const position = RoutePosition(
      distanceAlongRoute: 0,
      headingDegrees: 0,
      screenX: 100,
      screenY: 100,
      segmentIndex: 0,
      tiledX: 0,
      tiledY: 0,
    );
    const firstJunction = OverlayRouteNode(
      id: 2,
      nodeId: 'junction-1',
      screenX: 120,
      screenY: 100,
      tiledX: 20,
      tiledY: 0,
      type: ' Junctions ',
    );

    test('finds nearest matching junction only inside capture radius', () {
      final result = findCurrentJunctionNode(
        config: defaultWrongWayRerouteConfig,
        position: position,
        routeNodes: const <OverlayRouteNode>[
          OverlayRouteNode(
            id: 1,
            nodeId: 'hall-1',
            screenX: 100,
            screenY: 100,
            tiledX: 0,
            tiledY: 0,
            type: 'route-node',
          ),
          firstJunction,
        ],
      );
      final outside = findCurrentJunctionNode(
        config: _config(junctionCaptureRadiusPixels: 10),
        position: position,
        routeNodes: const <OverlayRouteNode>[firstJunction],
      );

      expect(result?.nodeId, 'junction-1');
      expect(outside, isNull);
      expect(
        isJunctionNodeType(
          config: defaultWrongWayRerouteConfig,
          nodeType: ' JUNCTIONS ',
        ),
        isTrue,
      );
    });

    test('includes the capture boundary and preserves nearest ties', () {
      const tied = OverlayRouteNode(
        id: 3,
        nodeId: 'junction-2',
        screenX: 80,
        screenY: 100,
        tiledX: -20,
        tiledY: 0,
        type: 'junctions',
      );
      final result = findCurrentJunctionNode(
        config: _config(junctionCaptureRadiusPixels: 20),
        position: position,
        routeNodes: const <OverlayRouteNode>[firstJunction, tied],
      );

      expect(result, same(firstJunction));
    });
  });

  test('checks route membership and undirected legal graph movement', () {
    const edges = <RouteGraphEdge>[
      RouteGraphEdge(fromNodeId: 'B', toNodeId: 'C'),
      RouteGraphEdge(fromNodeId: 'B', toNodeId: 'A'),
    ];

    expect(isNodeOnRoute(nodeId: 'B', routeNodeIds: const ['B', 'C']), isTrue);
    expect(isNodeOnRoute(nodeId: 'b', routeNodeIds: const ['B', 'C']), isFalse);
    expect(
      isLegalGraphMovement(candidateNodeId: 'A', edges: edges, fromNodeId: 'B'),
      isTrue,
    );
    expect(
      isLegalGraphMovement(candidateNodeId: 'B', edges: edges, fromNodeId: 'A'),
      isTrue,
    );
    expect(
      isLegalGraphMovement(candidateNodeId: 'A', edges: edges, fromNodeId: 'C'),
      isFalse,
    );
  });
}

WrongWayRerouteConfig _config({double junctionCaptureRadiusPixels = 36}) {
  return WrongWayRerouteConfig(
    allowedHeadingDeviationDegrees: 90,
    confidenceThreshold: 0.65,
    expectedHeadingRoundDegrees: 90,
    junctionCaptureRadiusPixels: junctionCaptureRadiusPixels,
    junctionNodeType: 'junctions',
    minimumOppositeHeadingDurationMs: 1000,
    wrongWayCheckIntervalMs: 1000,
  );
}
