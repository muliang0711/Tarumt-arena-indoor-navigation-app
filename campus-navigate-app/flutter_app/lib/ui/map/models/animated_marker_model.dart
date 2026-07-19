import 'dart:math' as math;

import 'package:indoor_navigation/ui/map/models/view_heading_model.dart';

const int markerMinimumDurationMs = 120;
const int markerMaximumDurationMs = 520;
const double markerCompensationPixelsPerSecond = 260;

int calculateLinearCompensationDurationMs({
  required double currentLeft,
  required double currentTop,
  int maximumDurationMs = markerMaximumDurationMs,
  int minimumDurationMs = markerMinimumDurationMs,
  required double nextLeft,
  required double nextTop,
  double pixelsPerSecond = markerCompensationPixelsPerSecond,
}) {
  final distancePixels = math.sqrt(
    math.pow(nextLeft - currentLeft, 2) + math.pow(nextTop - currentTop, 2),
  );
  final rawDurationMs = distancePixels / math.max(1, pixelsPerSecond) * 1000;
  return rawDurationMs.round().clamp(minimumDurationMs, maximumDurationMs);
}

double closestMarkerHeadingTarget(double currentHeading, double nextHeading) {
  return closestViewHeadingTarget(currentHeading, nextHeading);
}
