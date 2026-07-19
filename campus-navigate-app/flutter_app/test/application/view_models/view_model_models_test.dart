import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/view_models/view_model_models.dart';

void main() {
  test('preserves the App.tsx mode and zoom contracts', () {
    expect(IndoorNavigationMode.values, <IndoorNavigationMode>[
      IndoorNavigationMode.edges,
      IndoorNavigationMode.navigate,
    ]);
    expect(indoorNavigationZoomSteps, <double>[0.5, 0.75, 1, 1.25, 1.5, 2]);
    expect(indoorNavigationDefaultZoomIndex, 2);
    expect(indoorNavigationZoomAt(indoorNavigationDefaultZoomIndex), 1);
    expect(() => indoorNavigationZoomAt(-1), throwsRangeError);
    expect(() => indoorNavigationZoomAt(6), throwsRangeError);
  });
}
