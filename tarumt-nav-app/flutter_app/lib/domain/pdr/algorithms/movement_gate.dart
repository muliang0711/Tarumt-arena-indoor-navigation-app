import 'package:indoor_navigation/domain/common/angle_math.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';

bool shouldMoveForHeading({
  required PdrPipelineConfig config,
  required double desiredHeadingDegrees,
  required double observedHeadingDegrees,
}) {
  return getRouteMovementDirection(
        config: config,
        desiredHeadingDegrees: desiredHeadingDegrees,
        observedHeadingDegrees: observedHeadingDegrees,
      ) !=
      RouteMovementDirection.blocked;
}

RouteMovementDirection getRouteMovementDirection({
  required PdrPipelineConfig config,
  required double desiredHeadingDegrees,
  required double observedHeadingDegrees,
}) {
  final forwardDistance = shortestAngleDistanceDegrees(
    observedHeadingDegrees,
    desiredHeadingDegrees,
  );
  final backwardDistance = shortestAngleDistanceDegrees(
    observedHeadingDegrees,
    normalizeDegrees(desiredHeadingDegrees + 180),
  );

  if (forwardDistance <= config.movementHeadingToleranceDegrees) {
    return RouteMovementDirection.forward;
  }
  if (backwardDistance <= config.movementHeadingToleranceDegrees) {
    return RouteMovementDirection.backward;
  }
  return RouteMovementDirection.blocked;
}
