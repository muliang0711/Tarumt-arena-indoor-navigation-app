import 'dart:math' as math;

import 'package:indoor_navigation/domain/common/angle_math.dart';
import 'package:indoor_navigation/domain/common/geometry_math.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/tiled/route/route_progress.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

export 'package:indoor_navigation/domain/config/app_config.dart'
    show RouteTurnGateConfig, defaultRouteTurnGateConfig;

RoutePosition createTurnAwareRoutePosition({
  RouteTurnGateConfig config = defaultRouteTurnGateConfig,
  required double observedHeadingDegrees,
  required List<OverlayPoint> routePath,
  required RoutePosition routePosition,
}) {
  final nextSegmentHeading = _getNextSegmentHeadingIfApproachAllowed(
    config: config,
    observedHeadingDegrees: observedHeadingDegrees,
    routePath: routePath,
    routePosition: routePosition,
  );
  final previousSegment = _getPreviousSegmentIfReverseAllowed(
    config: config,
    observedHeadingDegrees: observedHeadingDegrees,
    routePath: routePath,
    routePosition: routePosition,
  );

  if (nextSegmentHeading != null) {
    return _copyRoutePosition(
      routePosition,
      headingDegrees: nextSegmentHeading,
    );
  }

  if (previousSegment != null) {
    return _copyRoutePosition(
      routePosition,
      headingDegrees: previousSegment.headingDegrees,
      segmentIndex: previousSegment.segmentIndex,
    );
  }

  return routePosition;
}

List<double> createAcceptedRouteHeadingDegrees({
  RouteTurnGateConfig config = defaultRouteTurnGateConfig,
  required List<OverlayPoint> routePath,
  required RoutePosition routePosition,
}) {
  final headings = <double>[routePosition.headingDegrees];
  final nextSegmentHeading = _getNextSegmentHeadingIfNearTurn(
    turnCaptureRadiusPixels: config.turnApproachRadiusPixels,
    routePath: routePath,
    routePosition: routePosition,
  );

  if (nextSegmentHeading != null &&
      !headings.any(
        (heading) =>
            shortestAngleDistanceDegrees(heading, nextSegmentHeading) < 1,
      )) {
    headings.add(nextSegmentHeading);
  }

  return headings;
}

RouteSnapResult constrainEstimateToRouteProgress({
  RouteTurnGateConfig config = defaultRouteTurnGateConfig,
  required double estimateHeadingDegrees,
  required double estimateScreenX,
  required double estimateScreenY,
  required RoutePosition previousPosition,
  required List<OverlayPoint> routePath,
}) {
  final currentSnap = _snapPointToSegment(
    pointX: estimateScreenX,
    pointY: estimateScreenY,
    routePath: routePath,
    segmentIndex: previousPosition.segmentIndex,
  );
  final nextSegment = _getNextSegmentIfTurnAllowed(
    config: config,
    observedHeadingDegrees: estimateHeadingDegrees,
    routePath: routePath,
    routePosition: previousPosition,
  );
  final nextSnap = nextSegment == null
      ? null
      : _snapPointToSegment(
          pointX: estimateScreenX,
          pointY: estimateScreenY,
          routePath: routePath,
          segmentIndex: nextSegment.segmentIndex,
        );
  final previousSegment = _getPreviousSegmentIfReverseAllowed(
    config: config,
    observedHeadingDegrees: estimateHeadingDegrees,
    routePath: routePath,
    routePosition: previousPosition,
  );
  final previousSnap = previousSegment == null
      ? null
      : _snapPointToSegment(
          pointX: estimateScreenX,
          pointY: estimateScreenY,
          routePath: routePath,
          segmentIndex: previousSegment.segmentIndex,
        );

  RouteSnapResult? bestCandidate;
  for (final candidate in <RouteSnapResult?>[
    currentSnap,
    nextSnap,
    previousSnap,
  ]) {
    if (candidate == null) {
      continue;
    }
    final clampedCandidate = _clampTinyRouteProgressNoise(
      candidate,
      previousPosition,
    );
    if (bestCandidate == null ||
        clampedCandidate.driftPixels < bestCandidate.driftPixels) {
      bestCandidate = clampedCandidate;
    }
  }

  return bestCandidate ??
      RouteSnapResult(
        driftPixels: _screenDistance(
          fromX: estimateScreenX,
          fromY: estimateScreenY,
          toX: previousPosition.screenX,
          toY: previousPosition.screenY,
        ),
        position: previousPosition,
      );
}

RouteSnapResult _clampTinyRouteProgressNoise(
  RouteSnapResult candidate,
  RoutePosition previousPosition,
) {
  if (candidate.position.segmentIndex == previousPosition.segmentIndex &&
      (candidate.position.distanceAlongRoute -
                  previousPosition.distanceAlongRoute)
              .abs() <
          0.5) {
    return RouteSnapResult(
      driftPixels: candidate.driftPixels,
      position: previousPosition,
    );
  }

  return candidate;
}

_RouteSegment? _getNextSegmentIfTurnAllowed({
  required RouteTurnGateConfig config,
  required double observedHeadingDegrees,
  required List<OverlayPoint> routePath,
  required RoutePosition routePosition,
}) {
  final nextSegmentIndex = routePosition.segmentIndex + 1;
  final nextSegmentHeading = _getSegmentHeading(routePath, nextSegmentIndex);
  if (nextSegmentHeading == null) {
    return null;
  }

  final currentSegmentEndDistance = _getSegmentEndDistance(
    routePath,
    routePosition.segmentIndex,
  );
  final distanceToTurn =
      currentSegmentEndDistance - routePosition.distanceAlongRoute;
  final isAtTurn = distanceToTurn <= config.turnCaptureRadiusPixels;
  final isFacingNextSegment =
      shortestAngleDistanceDegrees(
        observedHeadingDegrees,
        nextSegmentHeading,
      ) <=
      config.headingToleranceDegrees;

  return isAtTurn && isFacingNextSegment
      ? _RouteSegment(
          headingDegrees: nextSegmentHeading,
          segmentIndex: nextSegmentIndex,
        )
      : null;
}

double? _getNextSegmentHeadingIfApproachAllowed({
  required RouteTurnGateConfig config,
  required double observedHeadingDegrees,
  required List<OverlayPoint> routePath,
  required RoutePosition routePosition,
}) {
  final nextSegmentHeading = _getNextSegmentHeadingIfNearTurn(
    turnCaptureRadiusPixels: config.turnApproachRadiusPixels,
    routePath: routePath,
    routePosition: routePosition,
  );
  if (nextSegmentHeading == null) {
    return null;
  }

  return shortestAngleDistanceDegrees(
            observedHeadingDegrees,
            nextSegmentHeading,
          ) <=
          config.headingToleranceDegrees
      ? nextSegmentHeading
      : null;
}

double? _getNextSegmentHeadingIfNearTurn({
  required double turnCaptureRadiusPixels,
  required List<OverlayPoint> routePath,
  required RoutePosition routePosition,
}) {
  final nextSegmentIndex = routePosition.segmentIndex + 1;
  final nextSegmentHeading = _getSegmentHeading(routePath, nextSegmentIndex);
  if (nextSegmentHeading == null) {
    return null;
  }

  final currentSegmentEndDistance = _getSegmentEndDistance(
    routePath,
    routePosition.segmentIndex,
  );
  final distanceToTurn =
      currentSegmentEndDistance - routePosition.distanceAlongRoute;

  return distanceToTurn <= turnCaptureRadiusPixels ? nextSegmentHeading : null;
}

_RouteSegment? _getPreviousSegmentIfReverseAllowed({
  required RouteTurnGateConfig config,
  required double observedHeadingDegrees,
  required List<OverlayPoint> routePath,
  required RoutePosition routePosition,
}) {
  final previousSegmentIndex = routePosition.segmentIndex - 1;
  final previousSegmentHeading = _getSegmentHeading(
    routePath,
    previousSegmentIndex,
  );
  if (previousSegmentHeading == null) {
    return null;
  }

  final currentSegmentStartDistance = _getSegmentStartDistance(
    routePath,
    routePosition.segmentIndex,
  );
  final distanceToPreviousTurn =
      routePosition.distanceAlongRoute - currentSegmentStartDistance;
  final isAtTurn = distanceToPreviousTurn <= config.turnCaptureRadiusPixels;
  final isFacingBackwardOnPreviousSegment =
      shortestAngleDistanceDegrees(
        observedHeadingDegrees,
        previousSegmentHeading + 180,
      ) <=
      config.headingToleranceDegrees;

  return isAtTurn && isFacingBackwardOnPreviousSegment
      ? _RouteSegment(
          headingDegrees: previousSegmentHeading,
          segmentIndex: previousSegmentIndex,
        )
      : null;
}

RouteSnapResult? _snapPointToSegment({
  required double pointX,
  required double pointY,
  required List<OverlayPoint> routePath,
  required int segmentIndex,
}) {
  if (segmentIndex < 0 || segmentIndex + 1 >= routePath.length) {
    return null;
  }

  final from = routePath[segmentIndex];
  final to = routePath[segmentIndex + 1];
  final segmentDistance = distanceBetweenPoints(from, to);
  if (segmentDistance <= 0.001) {
    return null;
  }

  final segmentProgress = _projectPointProgressOnSegment(
    from: from,
    pointX: pointX,
    pointY: pointY,
    to: to,
  );
  final segmentStartDistance = _getSegmentStartDistance(
    routePath,
    segmentIndex,
  );
  final snappedScreenX = lerpDouble(from.screenX, to.screenX, segmentProgress);
  final snappedScreenY = lerpDouble(from.screenY, to.screenY, segmentProgress);

  return RouteSnapResult(
    driftPixels: _screenDistance(
      fromX: pointX,
      fromY: pointY,
      toX: snappedScreenX,
      toY: snappedScreenY,
    ),
    position: RoutePosition(
      distanceAlongRoute:
          segmentStartDistance + segmentDistance * segmentProgress,
      headingDegrees: headingBetweenPoints(from, to),
      screenX: snappedScreenX,
      screenY: snappedScreenY,
      segmentIndex: segmentIndex,
      tiledX: lerpDouble(from.tiledX, to.tiledX, segmentProgress),
      tiledY: lerpDouble(from.tiledY, to.tiledY, segmentProgress),
    ),
  );
}

double? _getSegmentHeading(List<OverlayPoint> routePath, int segmentIndex) {
  if (segmentIndex < 0 || segmentIndex + 1 >= routePath.length) {
    return null;
  }

  return headingBetweenPoints(
    routePath[segmentIndex],
    routePath[segmentIndex + 1],
  );
}

double _getSegmentStartDistance(
  List<OverlayPoint> routePath,
  int segmentIndex,
) {
  if (segmentIndex <= 0) {
    return 0;
  }

  return calculateRouteDistance(routePath.take(segmentIndex + 1).toList());
}

double _getSegmentEndDistance(List<OverlayPoint> routePath, int segmentIndex) {
  final distance = calculateRouteDistance(
    routePath.take(segmentIndex + 2).toList(),
  );
  return distance != 0 && !distance.isNaN
      ? distance
      : calculateRouteDistance(routePath);
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

double _screenDistance({
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

RoutePosition _copyRoutePosition(
  RoutePosition source, {
  double? headingDegrees,
  int? segmentIndex,
}) {
  return RoutePosition(
    distanceAlongRoute: source.distanceAlongRoute,
    headingDegrees: headingDegrees ?? source.headingDegrees,
    screenX: source.screenX,
    screenY: source.screenY,
    segmentIndex: segmentIndex ?? source.segmentIndex,
    tiledX: source.tiledX,
    tiledY: source.tiledY,
  );
}

final class _RouteSegment {
  const _RouteSegment({
    required this.headingDegrees,
    required this.segmentIndex,
  });

  final double headingDegrees;
  final int segmentIndex;
}
