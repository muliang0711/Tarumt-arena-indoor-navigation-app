import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/navigation/logic/navigation_instruction.dart';
import 'package:indoor_navigation/domain/navigation/navigation_models.dart';
import 'package:indoor_navigation/domain/simulation/simulation_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

void main() {
  test('derives straight, right, and left from screen-coordinate geometry', () {
    expect(
      getNavigationInstruction(
        routePath: _route(const <(double, double)>[(0, 0), (10, 0), (20, 0)]),
        segmentIndex: 0,
        status: SimulationStatus.moving,
      ),
      NavigationTurn.straight,
    );
    expect(
      getNavigationInstruction(
        routePath: _route(const <(double, double)>[(0, 0), (10, 0), (10, 10)]),
        segmentIndex: 0,
        status: SimulationStatus.moving,
      ),
      NavigationTurn.right,
    );
    expect(
      getNavigationInstruction(
        routePath: _route(const <(double, double)>[(0, 0), (10, 0), (10, -10)]),
        segmentIndex: 0,
        status: SimulationStatus.moving,
      ),
      NavigationTurn.left,
    );
  });

  test('treats cross products strictly below 0.001 as straight', () {
    final belowGate = _route(const <(double, double)>[
      (0, 0),
      (1, 0),
      (2, 0.000999),
    ]);
    final atGate = _route(const <(double, double)>[(0, 0), (1, 0), (2, 0.001)]);

    expect(
      getNavigationInstruction(
        routePath: belowGate,
        segmentIndex: 0,
        status: SimulationStatus.moving,
      ),
      NavigationTurn.straight,
    );
    expect(
      getNavigationInstruction(
        routePath: atGate,
        segmentIndex: 0,
        status: SimulationStatus.moving,
      ),
      NavigationTurn.right,
    );
  });

  test('returns arrived for arrived status or a terminal segment', () {
    final route = _route(const <(double, double)>[(0, 0), (10, 0), (10, 10)]);

    expect(
      getNavigationInstruction(
        routePath: route,
        segmentIndex: 0,
        status: SimulationStatus.arrived,
      ),
      NavigationTurn.arrived,
    );
    expect(
      getNavigationInstruction(
        routePath: route,
        segmentIndex: 2,
        status: SimulationStatus.moving,
      ),
      NavigationTurn.arrived,
    );
  });

  test('returns straight when current or next geometry is unavailable', () {
    final route = _route(const <(double, double)>[(0, 0), (10, 0)]);

    expect(
      getNavigationInstruction(
        routePath: route,
        segmentIndex: 0,
        status: SimulationStatus.ready,
      ),
      NavigationTurn.straight,
    );
    expect(
      getNavigationInstruction(
        routePath: route,
        segmentIndex: -1,
        status: SimulationStatus.moving,
      ),
      NavigationTurn.straight,
    );
  });

  test('returns arrived for an empty route', () {
    expect(
      getNavigationInstruction(
        routePath: const <OverlayRouteNode>[],
        segmentIndex: 0,
        status: SimulationStatus.ready,
      ),
      NavigationTurn.arrived,
    );
  });
}

List<OverlayRouteNode> _route(List<(double, double)> coordinates) {
  return <OverlayRouteNode>[
    for (var index = 0; index < coordinates.length; index += 1)
      OverlayRouteNode(
        id: index,
        nodeId: 'node-$index',
        screenX: coordinates[index].$1,
        screenY: coordinates[index].$2,
        tiledX: coordinates[index].$1,
        tiledY: coordinates[index].$2,
        type: 'route-node',
      ),
  ];
}
