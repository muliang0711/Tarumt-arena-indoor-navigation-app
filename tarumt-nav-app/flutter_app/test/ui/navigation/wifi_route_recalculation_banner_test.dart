import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_pdr_fusion_engine.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/ui/navigation/wifi_route_recalculation_banner.dart';

void main() {
  testWidgets('shows a non-blocking recalculation progress message', (
    tester,
  ) async {
    await _pump(tester, WifiCorrectionVisualPhase.recalculating);

    expect(find.text('Location updated'), findsOneWidget);
    expect(
      find.text('Recalculating route from your trusted Wi-Fi position…'),
      findsOneWidget,
    );
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('confirms when the replacement route is ready', (tester) async {
    await _pump(tester, WifiCorrectionVisualPhase.routeReady);

    expect(find.text('New route ready'), findsOneWidget);
    expect(
      find.text('Navigation is continuing from your trusted Wi-Fi position.'),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.route), findsOneWidget);
  });
}

Future<void> _pump(WidgetTester tester, WifiCorrectionVisualPhase phase) {
  return tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Center(
          child: WifiRouteRecalculationBanner(
            correction: WifiCorrectionVisualState(
              fromPosition: _position,
              kind: WifiCorrectionKind.teleport,
              phase: phase,
              recalculatesRoute: true,
              sequence: 1,
              toPosition: _position,
            ),
          ),
        ),
      ),
    ),
  );
}

const _position = RoutePosition(
  distanceAlongRoute: 0,
  headingDegrees: 0,
  screenX: 0,
  screenY: 0,
  segmentIndex: 0,
  tiledX: 0,
  tiledY: 0,
);
