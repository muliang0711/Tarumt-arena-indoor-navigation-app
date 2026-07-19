import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/ui/map/models/view_heading_model.dart';

void main() {
  test('uses observed heading and otherwise holds the last observation', () {
    expect(
      resolveUserFacingHeadingDegrees(
        lastObservedHeadingDegrees: 12,
        observedHeadingDegrees: 37,
      ),
      37,
    );
    expect(
      resolveUserFacingHeadingDegrees(
        lastObservedHeadingDegrees: 37,
        observedHeadingDegrees: null,
      ),
      37,
    );
  });

  test('selects shortest rotation across the zero-degree boundary', () {
    expect(closestViewHeadingTarget(350, 10), 370);
    expect(closestViewHeadingTarget(10, 350), -10);
    expect(closestViewHeadingTarget(30, 60), 60);
  });
}
