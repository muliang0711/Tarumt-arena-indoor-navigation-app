import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/navigation/route_traffic_resolver.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/domain/traffic/route_traffic.dart';

void main() {
  test('matches physical edges in either direction and applies thresholds', () {
    const segments = <OverlayPathSegment>[
      OverlayPathSegment(
        fromNodeId: 'a',
        key: 'a->b',
        length: 10,
        rotationDegrees: 0,
        toNodeId: 'b',
        x: 0,
        y: 0,
      ),
      OverlayPathSegment(
        fromNodeId: 'b',
        key: 'b->c',
        length: 10,
        rotationDegrees: 0,
        toNodeId: 'c',
        x: 10,
        y: 0,
      ),
      OverlayPathSegment(
        fromNodeId: 'c',
        key: 'c->d',
        length: 10,
        rotationDegrees: 0,
        toNodeId: 'd',
        x: 20,
        y: 0,
      ),
      OverlayPathSegment(
        fromNodeId: 'd',
        key: 'd->e',
        length: 10,
        rotationDegrees: 0,
        toNodeId: 'e',
        x: 30,
        y: 0,
      ),
    ];

    final result = const RouteTrafficResolver().resolve(
      segments: segments,
      occupancies: const <EdgeOccupancy>[
        EdgeOccupancy(fromNodeId: 'b', toNodeId: 'a', activeUsers: 2),
        EdgeOccupancy(fromNodeId: 'b', toNodeId: 'c', activeUsers: 3),
        EdgeOccupancy(fromNodeId: 'c', toNodeId: 'd', activeUsers: 6),
        EdgeOccupancy(fromNodeId: 'e', toNodeId: 'd', activeUsers: 10),
      ],
    );

    expect(result['a->b'], RouteTrafficLevel.clear);
    expect(result['b->c'], RouteTrafficLevel.moderate);
    expect(result['c->d'], RouteTrafficLevel.busy);
    expect(result['d->e'], RouteTrafficLevel.congested);
  });
}
