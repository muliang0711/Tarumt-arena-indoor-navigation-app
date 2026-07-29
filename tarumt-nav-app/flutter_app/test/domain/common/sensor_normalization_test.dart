import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/common/sensor_normalization.dart';

void main() {
  test('converts magnetometer x/y into normalized heading degrees', () {
    expect(magnetometerToHeadingDegrees(x: 1, y: 0), 0);
    expect(magnetometerToHeadingDegrees(x: 0, y: 1), 90);
    expect(magnetometerToHeadingDegrees(x: 0, y: -1), 270);
  });

  test('applies the approved CoreMotion radians-to-degrees correction', () {
    expect(coreMotionYawRadiansToHeadingDegrees(math.pi / 2), 90);
    expect(coreMotionYawRadiansToHeadingDegrees(-math.pi / 2), 270);
  });
}
