import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_coordinator_state.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_engine.dart';
import 'package:indoor_navigation/application/ports/export/wifi_diagnostic_exporter.dart';
import 'package:indoor_navigation/application/ports/logging/wifi_diagnostic_log.dart';
import 'package:indoor_navigation/application/ports/time/clock.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';
import 'package:indoor_navigation/application/view_models/wifi_diagnostics_view_model.dart';
import 'package:indoor_navigation/ui/navigation/wifi_positioning_diagnostics_overlay.dart';

void main() {
  testWidgets('shows cooldown diagnostics and forwards a manual scan', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    var retryCount = 0;
    final exporter = _FakeWifiDiagnosticExporter();
    final diagnosticsViewModel = WifiDiagnosticsViewModel(
      clock: const _FixedClock(2000),
      exporter: exporter,
      log: const NoopWifiDiagnosticLog(),
    );
    addTearDown(diagnosticsViewModel.dispose);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: WifiPositioningDiagnosticsOverlay(
            diagnosticsViewModel: diagnosticsViewModel,
            nowMs: () => 2000,
            onRetry: () => retryCount += 1,
            state: const WifiPositioningCoordinatorState(
              access: WifiScanAccessState(
                locationServicesEnabled: true,
                permission: WifiScanPermissionStatus.granted,
                platformSupport: WifiScanPlatformSupport.supported,
                wifiEnabled: true,
              ),
              lastAttemptAtMs: 1000,
              lastErrorMessage: 'Android scan cooldown is active.',
              lastFix: WifiPositionFix(
                floorId: 'floor-2',
                localNodeId: 'node-3',
                observedAtMs: 1000,
                readingTier: WifiPositioningReadingTier.fresh,
                readingCount: 7,
                scanSource: WifiScanBatchSource.active,
                serverNodeId: '3',
              ),
              phase: WifiPositioningPhase.throttled,
              retryAtMs: 6000,
              scanDiagnostics: WifiPositioningScanDiagnostics(
                activeScanCooldownUntilMs: 32000,
                batchCompletedAtMs: 1500,
                latestReadingObservedAtMs: 1250,
                nextPositioningCheckAtMs: 6000,
                readingCount: 9,
                requestActiveScan: false,
                source: WifiScanBatchSource.cached,
              ),
            ),
            child: ColoredBox(color: Colors.black),
          ),
        ),
      ),
    );

    expect(find.byKey(WifiPositioningDiagnosticsKeys.panel), findsNothing);
    await tester.tap(find.byKey(WifiPositioningDiagnosticsKeys.open));
    await tester.pump();

    expect(find.text('Android Wi-Fi diagnostics'), findsOneWidget);
    expect(find.text('Hardware cooldown'), findsNWidgets(2));
    expect(find.text('Receiver cache check'), findsOneWidget);
    expect(find.text('Cached receiver batch'), findsOneWidget);
    expect(find.text('30s remaining'), findsOneWidget);
    expect(find.text('500ms'), findsOneWidget);
    expect(find.text('750ms'), findsOneWidget);
    expect(find.text('Locked'), findsOneWidget);
    expect(find.text('granted'), findsOneWidget);
    expect(find.text('4s'), findsOneWidget);
    expect(find.text('node-3'), findsOneWidget);
    expect(find.text('9'), findsOneWidget);
    expect(find.text('0'), findsOneWidget);
    expect(find.text('Android scan cooldown is active.'), findsOneWidget);

    await tester.ensureVisible(
      find.byKey(WifiPositioningDiagnosticsKeys.retry),
    );
    await tester.tap(find.byKey(WifiPositioningDiagnosticsKeys.retry));
    expect(retryCount, 1);

    await tester.ensureVisible(
      find.byKey(WifiPositioningDiagnosticsKeys.export),
    );
    await tester.tap(find.byKey(WifiPositioningDiagnosticsKeys.export));
    await tester.pump();
    expect(exporter.requests, hasLength(1));
    expect(exporter.requests.single.fileName, contains('wifi-diagnostics-'));
    expect(find.text('Diagnostic file exported.'), findsOneWidget);

    await tester.ensureVisible(
      find.byKey(WifiPositioningDiagnosticsKeys.close),
    );
    await tester.tap(find.byKey(WifiPositioningDiagnosticsKeys.close));
    await tester.pump();
    expect(find.byKey(WifiPositioningDiagnosticsKeys.panel), findsNothing);
    expect(tester.takeException(), isNull);
  });
}

final class _FakeWifiDiagnosticExporter implements WifiDiagnosticExporter {
  final List<WifiDiagnosticExportRequest> requests = [];

  @override
  Future<WifiDiagnosticExportStatus> export(
    WifiDiagnosticExportRequest request,
  ) async {
    requests.add(request);
    return WifiDiagnosticExportStatus.success;
  }
}

final class _FixedClock implements Clock {
  const _FixedClock(this.value);

  final int value;

  @override
  int nowMs() => value;
}
