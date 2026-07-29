import 'dart:math' as math;

import 'package:indoor_navigation/domain/common/javascript_number.dart';

double normalizeDegrees(double degrees) => ((degrees % 360) + 360) % 360;

double shortestAngleDistanceDegrees(double from, double to) {
  final difference = (normalizeDegrees(from) - normalizeDegrees(to)).abs();
  return math.min(difference, 360 - difference);
}

double circularMeanDegrees(Iterable<double> degrees) {
  if (degrees.isEmpty) {
    return 0;
  }

  var x = 0.0;
  var y = 0.0;
  for (final heading in degrees) {
    final radians = normalizeDegrees(heading) * math.pi / 180;
    x += math.cos(radians);
    y += math.sin(radians);
  }

  return normalizeDegrees(math.atan2(y, x) * 180 / math.pi);
}

double roundHeadingDegrees({
  required double headingDegrees,
  required double roundDegrees,
}) {
  if (roundDegrees <= 0) {
    return normalizeDegrees(headingDegrees);
  }

  return normalizeDegrees(
    javascriptRound(headingDegrees / roundDegrees) * roundDegrees,
  );
}
