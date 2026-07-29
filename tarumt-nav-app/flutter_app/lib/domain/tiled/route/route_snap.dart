import 'dart:math' as math;

import 'package:indoor_navigation/domain/common/geometry_math.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

RouteSnapResult snapPointToRoute({
  required List<OverlayPoint> routePath,
  required double screenX,
  required double screenY,
}) {
  if (routePath.isEmpty) {
    throw StateError('Cannot snap to an empty route path.');
  }

  if (routePath.length == 1) {
    final onlyPoint = routePath.single;
    return RouteSnapResult(
      driftPixels: _distanceToScreenPoint(
        fromX: screenX,
        fromY: screenY,
        toX: onlyPoint.screenX,
        toY: onlyPoint.screenY,
      ),
      position: RoutePosition(
        distanceAlongRoute: 0,
        headingDegrees: 0,
        screenX: onlyPoint.screenX,
        screenY: onlyPoint.screenY,
        segmentIndex: 0,
        tiledX: onlyPoint.tiledX,
        tiledY: onlyPoint.tiledY,
      ),
    );
  }

  RouteSnapResult? bestSnap;
  var traversedDistance = 0.0;

  for (var index = 0; index < routePath.length - 1; index += 1) {
    final from = routePath[index];
    final to = routePath[index + 1];
    final segmentDistance = distanceBetweenPoints(from, to);
    if (segmentDistance <= 0.001) {
      continue;
    }

    final segmentProgress = _projectPointProgressOnSegment(
      from: from,
      pointX: screenX,
      pointY: screenY,
      to: to,
    );
    final snappedScreenX = lerpDouble(
      from.screenX,
      to.screenX,
      segmentProgress,
    );
    final snappedScreenY = lerpDouble(
      from.screenY,
      to.screenY,
      segmentProgress,
    );
    final driftPixels = _distanceToScreenPoint(
      fromX: screenX,
      fromY: screenY,
      toX: snappedScreenX,
      toY: snappedScreenY,
    );
    final candidate = RouteSnapResult(
      driftPixels: driftPixels,
      position: RoutePosition(
        distanceAlongRoute:
            traversedDistance + segmentDistance * segmentProgress,
        headingDegrees: headingBetweenPoints(from, to),
        screenX: snappedScreenX,
        screenY: snappedScreenY,
        segmentIndex: index,
        tiledX: lerpDouble(from.tiledX, to.tiledX, segmentProgress),
        tiledY: lerpDouble(from.tiledY, to.tiledY, segmentProgress),
      ),
    );

    if (bestSnap == null || candidate.driftPixels < bestSnap.driftPixels) {
      bestSnap = candidate;
    }

    traversedDistance += segmentDistance;
  }

  if (bestSnap == null) {
    throw StateError('Cannot snap to a route path without valid segments.');
  }

  return bestSnap;
}

double _projectPointProgressOnSegment({
  required OverlayPoint from,
  required double pointX,
  required double pointY,
  required OverlayPoint to,
}) {
  final segmentX = to.screenX - from.screenX;
  final segmentY = to.screenY - from.screenY;
  final relativePointX = pointX - from.screenX;
  final relativePointY = pointY - from.screenY;
  final segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared <= 0.001) {
    return 0;
  }

  return clampDouble(
    (relativePointX * segmentX + relativePointY * segmentY) /
        segmentLengthSquared,
    0,
    1,
  );
}

double _distanceToScreenPoint({
  required double fromX,
  required double fromY,
  required double toX,
  required double toY,
}) {
  final deltaX = (toX - fromX).abs();
  final deltaY = (toY - fromY).abs();
  if (deltaX.isInfinite || deltaY.isInfinite) {
    return double.infinity;
  }
  if (deltaX.isNaN || deltaY.isNaN) {
    return double.nan;
  }
  final largest = math.max(deltaX, deltaY);
  if (largest == 0) {
    return largest;
  }

  final scaledX = deltaX / largest;
  final scaledY = deltaY / largest;
  return largest * math.sqrt(scaledX * scaledX + scaledY * scaledY);
}
