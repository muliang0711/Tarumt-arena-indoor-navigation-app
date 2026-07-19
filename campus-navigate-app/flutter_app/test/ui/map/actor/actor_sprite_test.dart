import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/ui/map/actor/actor_sprite.dart';
import 'package:indoor_navigation/ui/map/actor/user_presence_marker.dart';
import 'package:indoor_navigation/ui/map/actor/user_view_cone.dart';

void main() {
  testWidgets('walks only beyond 0.25px, loops at 110ms, and idles at 600ms', (
    tester,
  ) async {
    await _pumpSprite(tester, x: 0);
    expect(_assetName(tester), endsWith('idle_right.png'));

    await _pumpSprite(tester, x: 0.25);
    expect(_assetName(tester), endsWith('idle_right.png'));

    await _pumpSprite(tester, x: 0.251);
    expect(_assetName(tester), endsWith('run_right_1.png'));
    await tester.pump(const Duration(milliseconds: 110));
    expect(_assetName(tester), endsWith('run_right_2.png'));

    await tester.pump(const Duration(milliseconds: 489));
    expect(_assetName(tester), contains('run_right_'));
    await tester.pump(const Duration(milliseconds: 1));
    expect(_assetName(tester), endsWith('idle_right.png'));
  });

  testWidgets('widget facing direction uses the ten-degree hysteresis', (
    tester,
  ) async {
    await _pumpSprite(tester, x: 0);
    expect(_assetName(tester), endsWith('idle_right.png'));

    await _pumpSprite(tester, x: 0, heading: 54);
    expect(_assetName(tester), endsWith('idle_right.png'));
    await _pumpSprite(tester, x: 0, heading: 56);
    expect(_assetName(tester), endsWith('idle_down.png'));
  });

  testWidgets('user presence shows cone and holds last observed heading', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(
        UserPresenceMarker(observedHeadingDegrees: 100, position: _position(0)),
      ),
    );
    expect(find.byType(UserViewCone), findsOneWidget);
    expect(_assetName(tester), endsWith('idle_down.png'));

    await tester.pumpWidget(_host(UserPresenceMarker(position: _position(0))));
    expect(find.byType(UserViewCone), findsNothing);
    expect(_assetName(tester), endsWith('idle_down.png'));
  });

  testWidgets('view cone uses the dependency-free custom painter', (
    tester,
  ) async {
    await tester.pumpWidget(_host(const UserViewCone(headingDegrees: 350)));

    expect(find.byKey(const ValueKey('user-view-cone-paint')), findsOneWidget);
    final paint = tester.widget<CustomPaint>(
      find.byKey(const ValueKey('user-view-cone-paint')),
    );
    final painter = paint.painter! as ViewConePainter;
    expect(painter.fieldOfViewDegrees, 60);
    expect(painter.length, 96);

    await tester.pumpWidget(_host(const UserViewCone(headingDegrees: 10)));
    await tester.pump(const Duration(milliseconds: 180));
    expect(tester.takeException(), isNull);
  });
}

Future<void> _pumpSprite(
  WidgetTester tester, {
  double heading = 0,
  required double x,
}) {
  return tester.pumpWidget(
    _host(ActorSprite(facingHeadingDegrees: heading, position: _position(x))),
  );
}

Widget _host(Widget child) {
  return MaterialApp(
    home: Scaffold(
      body: Stack(clipBehavior: Clip.none, children: [child]),
    ),
  );
}

RoutePosition _position(double x) {
  return RoutePosition(
    distanceAlongRoute: x,
    headingDegrees: 0,
    screenX: x,
    screenY: 0,
    segmentIndex: 0,
    tiledX: x,
    tiledY: 0,
  );
}

String _assetName(WidgetTester tester) {
  final image = tester.widget<Image>(find.byType(Image));
  return (image.image as AssetImage).assetName;
}
