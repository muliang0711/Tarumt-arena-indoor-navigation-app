import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_coordinator_state.dart';
import 'package:indoor_navigation/ui/navigation/wifi_positioning_status_banner.dart';

void main() {
  testWidgets('hides healthy positioning states', (tester) async {
    await _pump(tester, WifiPositioningPhase.ready);

    expect(find.byKey(WifiPositioningStatusBannerKeys.banner), findsNothing);
  });

  testWidgets('explains permission recovery and forwards the action', (
    tester,
  ) async {
    var retryCount = 0;
    await _pump(
      tester,
      WifiPositioningPhase.permissionPermanentlyDenied,
      onRetry: () => retryCount += 1,
    );

    expect(find.text('Permission blocked'), findsOneWidget);
    expect(
      find.text('Enable precise location permission in Android Settings.'),
      findsOneWidget,
    );
    await tester.tap(find.byKey(WifiPositioningStatusBannerKeys.retry));
    expect(retryCount, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shows automatic throttle recovery without a retry button', (
    tester,
  ) async {
    await _pump(tester, WifiPositioningPhase.throttled);

    expect(find.text('Wi-Fi scan cooling down'), findsOneWidget);
    expect(find.byKey(WifiPositioningStatusBannerKeys.retry), findsNothing);
  });

  testWidgets('keeps network failure compact at 320 pixels', (tester) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await _pump(tester, WifiPositioningPhase.networkUnavailable);

    expect(find.text('Positioning network unavailable'), findsOneWidget);
    expect(find.byType(WifiPositioningStatusBanner), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('does not present rejected readings as a map mapping fault', (
    tester,
  ) async {
    await _pump(tester, WifiPositioningPhase.readingsRejected);

    expect(find.text('Wi-Fi sample not recognized'), findsOneWidget);
    expect(find.text('Wi-Fi map needs attention'), findsNothing);
  });
}

Future<void> _pump(
  WidgetTester tester,
  WifiPositioningPhase phase, {
  VoidCallback? onRetry,
}) {
  return tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Center(
          child: WifiPositioningStatusBanner(
            onRetry: onRetry ?? () {},
            state: WifiPositioningCoordinatorState(
              access: null,
              lastFix: null,
              phase: phase,
              retryAtMs: null,
            ),
          ),
        ),
      ),
    ),
  );
}
