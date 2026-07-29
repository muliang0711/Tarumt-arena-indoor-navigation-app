import 'package:indoor_navigation/domain/presence/presence_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/domain/traffic/route_traffic.dart';

final class RouteTrafficResolver {
  const RouteTrafficResolver();

  Map<String, RouteTrafficLevel> resolve({
    required Iterable<OverlayPathSegment> segments,
    required Iterable<EdgeOccupancy> occupancies,
  }) {
    final activeUsersByEdge = <String, int>{
      for (final occupancy in occupancies)
        _edgeKey(occupancy.fromNodeId, occupancy.toNodeId):
            occupancy.activeUsers,
    };
    return <String, RouteTrafficLevel>{
      for (final segment in segments)
        segment.key: levelFor(
          activeUsersByEdge[_edgeKey(segment.fromNodeId, segment.toNodeId)] ??
              0,
        ),
    };
  }

  RouteTrafficLevel levelFor(int activeUsers) {
    if (activeUsers >= 10) return RouteTrafficLevel.congested;
    if (activeUsers >= 6) return RouteTrafficLevel.busy;
    if (activeUsers >= 3) return RouteTrafficLevel.moderate;
    return RouteTrafficLevel.clear;
  }
}

String _edgeKey(String firstNodeId, String secondNodeId) {
  final first = firstNodeId.trim();
  final second = secondNodeId.trim();
  return first.compareTo(second) <= 0
      ? '$first\u0000$second'
      : '$second\u0000$first';
}
