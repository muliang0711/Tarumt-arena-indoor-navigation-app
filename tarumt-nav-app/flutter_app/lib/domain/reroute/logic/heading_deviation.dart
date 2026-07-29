import 'package:indoor_navigation/domain/common/angle_math.dart';
import 'package:indoor_navigation/domain/reroute/reroute_models.dart';

bool isHeadingOutsideAllowedDeviation({
  required WrongWayRerouteConfig config,
  required double expectedHeadingDegrees,
  required double observedHeadingDegrees,
}) {
  return shortestAngleDistanceDegrees(
        expectedHeadingDegrees,
        observedHeadingDegrees,
      ) >=
      config.allowedHeadingDeviationDegrees;
}

bool isOppositeHeading({
  required WrongWayRerouteConfig config,
  required double expectedHeadingDegrees,
  required double observedHeadingDegrees,
}) {
  return isHeadingOutsideAllowedDeviation(
    config: config,
    expectedHeadingDegrees: expectedHeadingDegrees,
    observedHeadingDegrees: observedHeadingDegrees,
  );
}
