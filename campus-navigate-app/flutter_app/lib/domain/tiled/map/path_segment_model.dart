import 'package:indoor_navigation/domain/common/geometry_math.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

List<OverlayPathSegment> createPathSegmentsFromPoints(
  List<OverlayPoint> points,
) {
  final segments = <OverlayPathSegment>[];

  for (var index = 0; index < points.length - 1; index += 1) {
    final from = points[index];
    final to = points[index + 1];
    if (distanceBetweenPoints(from, to) <= 0.001) {
      continue;
    }

    final fromId = from is OverlayRouteNode ? from.nodeId : 'point-$index';
    final toId = to is OverlayRouteNode ? to.nodeId : 'point-${index + 1}';
    segments.add(_createPathSegment('$fromId->$toId', from, to, fromId, toId));
  }

  return segments;
}

OverlayPathSegment _createPathSegment(
  String key,
  OverlayPoint from,
  OverlayPoint to,
  String fromNodeId,
  String toNodeId,
) {
  return OverlayPathSegment(
    fromNodeId: fromNodeId,
    key: key,
    length: distanceBetweenPoints(from, to),
    rotationDegrees: headingBetweenPoints(from, to),
    toNodeId: toNodeId,
    x: from.screenX,
    y: from.screenY,
  );
}
