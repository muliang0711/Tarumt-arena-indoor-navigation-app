import 'dart:math' as math;

import 'package:indoor_navigation/domain/common/angle_math.dart';

double magnetometerToHeadingDegrees({required double x, required double y}) {
  return normalizeDegrees(math.atan2(y, x) * 180 / math.pi);
}

/// Converts iOS CoreMotion `attitude.yaw` into the degree unit expected by PDR.
///
/// The Expo implementation forwarded radians as degrees. Correcting that unit
/// mismatch is an explicitly approved migration parity exception.
double coreMotionYawRadiansToHeadingDegrees(double yawRadians) {
  return normalizeDegrees(yawRadians * 180 / math.pi);
}
