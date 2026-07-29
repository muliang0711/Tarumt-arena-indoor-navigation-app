import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/ui/map/models/view_cone_model.dart';

void main() {
  test('creates a symmetric 60-degree fan facing right', () {
    final geometry = createViewConeGeometry(
      fieldOfViewDegrees: 60,
      length: 100,
    );

    expect(
      geometry.path,
      'M 100 100 L 186.603 50 A 100 100 0 0 1 186.603 150 Z',
    );
    expect(geometry.size, 200);
  });

  test('clamps invalid field of view and length inputs', () {
    expect(createViewConeGeometry(fieldOfViewDegrees: 0, length: 0).size, 2);
    expect(
      createViewConeGeometry(fieldOfViewDegrees: 360, length: 20).path,
      startsWith('M 20 20 '),
    );
  });
}
