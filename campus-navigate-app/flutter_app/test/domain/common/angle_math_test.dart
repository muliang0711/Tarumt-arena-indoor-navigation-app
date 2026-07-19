import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/common/angle_math.dart';

void main() {
  group('angle math', () {
    test('normalizes wrapped and negative headings', () {
      expect(normalizeDegrees(-10), 350);
      expect(normalizeDegrees(370), 10);
      expect(normalizeDegrees(720), 0);
    });

    test('finds the shortest distance across zero degrees', () {
      expect(shortestAngleDistanceDegrees(350, 10), 20);
      expect(shortestAngleDistanceDegrees(10, 350), 20);
    });

    test('calculates a circular mean around zero degrees', () {
      expect(circularMeanDegrees([350, 10]), closeTo(0, 1e-12));
      expect(circularMeanDegrees(const []), 0);
    });

    test('rounds headings using the TypeScript convention', () {
      expect(roundHeadingDegrees(headingDegrees: 350, roundDegrees: 90), 0);
      expect(roundHeadingDegrees(headingDegrees: -10, roundDegrees: 0), 350);
      expect(roundHeadingDegrees(headingDegrees: -45, roundDegrees: 90), 0);
    });
  });
}
