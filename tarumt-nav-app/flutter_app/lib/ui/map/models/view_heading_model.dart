double closestViewHeadingTarget(double currentHeading, double nextHeading) {
  final wrappedDifference = (nextHeading - currentHeading) % 360;
  final delta = ((wrappedDifference + 540) % 360) - 180;
  return currentHeading + delta;
}

double resolveUserFacingHeadingDegrees({
  required double lastObservedHeadingDegrees,
  required double? observedHeadingDegrees,
}) {
  return observedHeadingDegrees ?? lastObservedHeadingDegrees;
}
