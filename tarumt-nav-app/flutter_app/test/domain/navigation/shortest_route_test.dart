import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/edge_editor/edge_editor_models.dart';
import 'package:indoor_navigation/domain/navigation/logic/shortest_route.dart';

void main() {
  test('finds the shortest undirected route using stable edge order', () {
    final edges = [
      _edge('a-b', 'a', 'b', 2),
      _edge('b-d', 'b', 'd', 5),
      _edge('a-c', 'a', 'c', 3),
      _edge('c-d', 'c', 'd', 1),
    ];

    expect(
      findShortestRouteNodeIds(
        destinationNodeId: 'd',
        edges: edges,
        startNodeId: 'a',
      ),
      ['a', 'c', 'd'],
    );
    expect(
      findShortestRouteNodeIds(
        destinationNodeId: 'a',
        edges: edges,
        startNodeId: 'd',
      ),
      ['d', 'c', 'a'],
    );
  });

  test('returns a single-node route and rejects unreachable destinations', () {
    final edges = [_edge('a-b', 'a', 'b', 2)];

    expect(
      findShortestRouteNodeIds(
        destinationNodeId: 'a',
        edges: edges,
        startNodeId: 'a',
      ),
      ['a'],
    );
    expect(
      () => findShortestRouteNodeIds(
        destinationNodeId: 'z',
        edges: edges,
        startNodeId: 'a',
      ),
      throwsStateError,
    );
  });
}

RouteGraphEdgeExport _edge(String id, String from, String to, double distance) {
  return RouteGraphEdgeExport(distance: distance, from: from, id: id, to: to);
}
