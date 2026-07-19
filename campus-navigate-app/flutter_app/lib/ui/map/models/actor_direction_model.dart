import 'package:indoor_navigation/domain/common/angle_math.dart';
import 'package:indoor_navigation/ui/map/models/actor_models.dart';

const Map<ActorDirection, double> _directionCenterDegrees = {
  ActorDirection.down: 90,
  ActorDirection.left: 180,
  ActorDirection.right: 0,
  ActorDirection.up: 270,
};

ActorDirection actorDirectionFromHeading(double headingDegrees) {
  final normalizedHeading = normalizeDegrees(headingDegrees);
  if (normalizedHeading >= 315 || normalizedHeading < 45) {
    return ActorDirection.right;
  }
  if (normalizedHeading < 135) {
    return ActorDirection.down;
  }
  if (normalizedHeading < 225) {
    return ActorDirection.left;
  }
  return ActorDirection.up;
}

ActorDirection actorDirectionWithHysteresis({
  required ActorDirection currentDirection,
  required double headingDegrees,
  double hysteresisDegrees = 10,
}) {
  final safeHysteresis = hysteresisDegrees < 0 ? 0.0 : hysteresisDegrees;
  final distanceFromCurrentDirection = shortestAngleDistanceDegrees(
    headingDegrees,
    _directionCenterDegrees[currentDirection]!,
  );
  return distanceFromCurrentDirection <= 45 + safeHysteresis
      ? currentDirection
      : actorDirectionFromHeading(headingDegrees);
}
