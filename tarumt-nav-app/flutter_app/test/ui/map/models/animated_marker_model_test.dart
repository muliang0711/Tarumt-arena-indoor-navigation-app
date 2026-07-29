import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/ui/map/models/animated_marker_model.dart';

void main() {
  test('compensates at 260px/s inside exact 120-520ms bounds', () {
    expect(
      calculateLinearCompensationDurationMs(
        currentLeft: 0,
        currentTop: 0,
        nextLeft: 0,
        nextTop: 0,
      ),
      120,
    );
    expect(
      calculateLinearCompensationDurationMs(
        currentLeft: 0,
        currentTop: 0,
        nextLeft: 52,
        nextTop: 0,
      ),
      200,
    );
    expect(
      calculateLinearCompensationDurationMs(
        currentLeft: 0,
        currentTop: 0,
        nextLeft: 260,
        nextTop: 0,
      ),
      520,
    );
  });

  test('marker heading also takes the shortest rotation', () {
    expect(closestMarkerHeadingTarget(350, 10), 370);
    expect(closestMarkerHeadingTarget(10, 350), -10);
  });
}
