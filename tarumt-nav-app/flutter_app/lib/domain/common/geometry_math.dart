import 'dart:math' as math;

import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

double distanceBetweenPoints(OverlayPoint from, OverlayPoint to) {
  final deltaX = (to.screenX - from.screenX).abs();
  final deltaY = (to.screenY - from.screenY).abs();
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

double headingBetweenPoints(OverlayPoint from, OverlayPoint to) {
  return math.atan2(to.screenY - from.screenY, to.screenX - from.screenX) *
      180 /
      math.pi;
}

double clampDouble(double value, double minimum, double maximum) {
  return math.min(math.max(value, minimum), maximum);
}

double lerpDouble(double from, double to, double progress) {
  return from + (to - from) * progress;
}
