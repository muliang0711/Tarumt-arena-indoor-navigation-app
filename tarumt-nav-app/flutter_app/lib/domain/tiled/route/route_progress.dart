import 'package:indoor_navigation/domain/common/geometry_math.dart';
import 'package:indoor_navigation/domain/tiled/map/path_segment_model.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

double calculateRouteDistance(List<OverlayPoint> points) {
  var distance = 0.0;

  for (var index = 0; index < points.length - 1; index += 1) {
    distance += distanceBetweenPoints(points[index], points[index + 1]);
  }

  return distance;
}

RoutePosition interpolateRoutePosition(
  List<OverlayPoint> points,
  double distanceAlongRoute,
) {
  if (points.isEmpty) {
    throw StateError('Cannot interpolate an empty route path.');
  }

  final totalDistance = calculateRouteDistance(points);
  final clampedDistance = clampDouble(distanceAlongRoute, 0, totalDistance);
  var traversedDistance = 0.0;

  for (var index = 0; index < points.length - 1; index += 1) {
    final from = points[index];
    final to = points[index + 1];
    final segmentDistance = distanceBetweenPoints(from, to);
    final segmentEndDistance = traversedDistance + segmentDistance;
    if (clampedDistance <= segmentEndDistance || index == points.length - 2) {
      final segmentProgress = segmentDistance == 0
          ? 0.0
          : (clampedDistance - traversedDistance) / segmentDistance;

      return RoutePosition(
        distanceAlongRoute: clampedDistance,
        headingDegrees: headingBetweenPoints(from, to),
        screenX: lerpDouble(from.screenX, to.screenX, segmentProgress),
        screenY: lerpDouble(from.screenY, to.screenY, segmentProgress),
        segmentIndex: index,
        tiledX: lerpDouble(from.tiledX, to.tiledX, segmentProgress),
        tiledY: lerpDouble(from.tiledY, to.tiledY, segmentProgress),
      );
    }

    traversedDistance = segmentEndDistance;
  }

  final lastPoint = points.last;
  return RoutePosition(
    distanceAlongRoute: clampedDistance,
    headingDegrees: 0,
    screenX: lastPoint.screenX,
    screenY: lastPoint.screenY,
    segmentIndex: 0,
    tiledX: lastPoint.tiledX,
    tiledY: lastPoint.tiledY,
  );
}

List<OverlayPathSegment> createRemainingRouteSegments(
  List<OverlayPoint> points,
  double distanceAlongRoute,
) {
  if (points.length < 2) {
    return const <OverlayPathSegment>[];
  }

  final routePosition = interpolateRoutePosition(points, distanceAlongRoute);
  final remainingPoints = <OverlayPoint>[
    routePosition,
    ...points.skip(routePosition.segmentIndex + 1),
  ];

  return createPathSegmentsFromPoints(remainingPoints);
}
