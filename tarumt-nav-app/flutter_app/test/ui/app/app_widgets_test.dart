import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/view_models/view_model_models.dart';
import 'package:indoor_navigation/domain/simulation/simulation_models.dart';
import 'package:indoor_navigation/ui/app/app.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

void main() {
  testWidgets('AppHeader shows exact copy and forwards every action', (
    tester,
  ) async {
    final modes = <IndoorNavigationMode>[];
    var zoomInCount = 0;
    var zoomOutCount = 0;

    await _pumpAtSize(
      tester,
      const Size(320, 640),
      AppHeader(
        distanceRemainingPixels: 123.6,
        mode: IndoorNavigationMode.navigate,
        onModeChange: modes.add,
        onZoomIn: () => zoomInCount += 1,
        onZoomOut: () => zoomOutCount += 1,
        status: SimulationStatus.moving,
        zoomPercent: 125,
      ),
    );

    expect(find.text('Tiled Map Phase 1'), findsOneWidget);
    expect(find.text('moving - 124px left'), findsOneWidget);
    expect(find.text('Navigate'), findsOneWidget);
    expect(find.text('Edges'), findsOneWidget);
    expect(find.text('125%'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.tap(find.byKey(AppHeader.edgesButtonKey));
    await tester.tap(find.byKey(ZoomControls.zoomOutButtonKey));
    await tester.tap(find.byKey(ZoomControls.zoomInButtonKey));
    expect(modes, [IndoorNavigationMode.edges]);
    expect(zoomOutCount, 1);
    expect(zoomInCount, 1);
  });

  testWidgets('AppHeader switches to Edge editor copy', (tester) async {
    await _pumpAtSize(
      tester,
      const Size(390, 844),
      AppHeader(
        distanceRemainingPixels: 999,
        mode: IndoorNavigationMode.edges,
        onModeChange: (_) {},
        onZoomIn: () {},
        onZoomOut: () {},
        status: SimulationStatus.paused,
        zoomPercent: 100,
      ),
    );

    expect(find.text('Edge JSON editor'), findsOneWidget);
    expect(find.textContaining('px left'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('SimulationControls stays narrow-safe and forwards callbacks', (
    tester,
  ) async {
    final calls = <String>[];
    await _pumpAtSize(
      tester,
      const Size(320, 640),
      SimulationControls(
        onPause: () => calls.add('pause'),
        onReset: () => calls.add('reset'),
        onStart: () => calls.add('start'),
        onStepForward: () => calls.add('step'),
      ),
    );

    expect(find.text('Start'), findsOneWidget);
    expect(find.text('Pause'), findsOneWidget);
    expect(find.text('Step'), findsOneWidget);
    expect(find.text('Reset'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.tap(find.byKey(SimulationControls.startButtonKey));
    await tester.tap(find.byKey(SimulationControls.pauseButtonKey));
    await tester.tap(find.byKey(SimulationControls.stepButtonKey));
    await tester.tap(find.byKey(SimulationControls.resetButtonKey));
    expect(calls, ['start', 'pause', 'step', 'reset']);
  });
}

Future<void> _pumpAtSize(WidgetTester tester, Size size, Widget child) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  await tester.pumpWidget(
    MaterialApp(
      theme: createIndoorNavigationTheme(),
      home: Scaffold(
        body: Align(alignment: Alignment.topCenter, child: child),
      ),
    ),
  );
}
