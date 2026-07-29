import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/map_graph/map_graph.dart';

void main() {
  const revision =
      'sha256:9ce75cc7224ccc08e343761fb981c1625ca1b58231db1eb9c7270f1cf0a7865b';

  test('bundled graph is byte-identical to the canonical contract', () {
    final canonical = File(
      '../contracts/maps/main-campus/map-graph-bundle.v1.json',
    ).readAsBytesSync();
    final bundled = File(
      'assets/maps/main_campus.map-graph.v1.json',
    ).readAsBytesSync();
    expect(bundled, canonical);
  });

  test('parses canonical floor and validates a connected route', () {
    final bundle = const MapGraphParser().parse(
      File('assets/maps/main_campus.map-graph.v1.json').readAsStringSync(),
    );

    expect(bundle.mapId, 'main-campus');
    expect(bundle.mapRevision, revision);
    expect(bundle.floors, hasLength(1));
    expect(bundle.floor('floor-2').nodes, hasLength(22));
    expect(
      bundle.isConnectedRoute(
        originNodeId: 'node-21',
        destinationNodeId: 'node-17',
        plannedEdgeIds: const [
          'edge-node-1-node-21',
          'edge-node-1-node-2',
          'edge-node-15-node-2',
          'edge-node-14-node-15',
          'edge-node-14-node-13',
          'edge-node-13-node-12',
          'edge-node-12-node-16',
          'edge-node-17-node-16',
        ],
      ),
      isTrue,
    );
  });

  test('rejects a disconnected planned route', () {
    final bundle = const MapGraphParser().parse(
      File('assets/maps/main_campus.map-graph.v1.json').readAsStringSync(),
    );

    expect(
      bundle.isConnectedRoute(
        originNodeId: 'node-21',
        destinationNodeId: 'node-17',
        plannedEdgeIds: const ['edge-node-17-node-16'],
      ),
      isFalse,
    );
  });
}
