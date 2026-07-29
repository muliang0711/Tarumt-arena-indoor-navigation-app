import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/common/geometry_math.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

void main() {
  const origin = OverlayPoint(screenX: 0, screenY: 0, tiledX: 0, tiledY: 0);

  test('preserves geometry helper behavior', () {
    const point = OverlayPoint(screenX: 3, screenY: 4, tiledX: 3, tiledY: 4);

    expect(distanceBetweenPoints(origin, point), 5);
    expect(headingBetweenPoints(origin, point), closeTo(53.130102354, 1e-9));
    expect(clampDouble(11, 0, 10), 10);
    expect(lerpDouble(10, 20, 0.25), 12.5);
  });

  test('matches Math.hypot for very large finite coordinates', () {
    const point = OverlayPoint(
      screenX: 1e308,
      screenY: 1e308,
      tiledX: 0,
      tiledY: 0,
    );

    expect(distanceBetweenPoints(origin, point).isFinite, isTrue);
    expect(
      distanceBetweenPoints(origin, point),
      closeTo(1.414213562e308, 1e299),
    );
  });
}
