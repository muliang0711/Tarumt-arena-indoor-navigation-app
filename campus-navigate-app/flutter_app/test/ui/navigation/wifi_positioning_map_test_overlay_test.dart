import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_api.dart';
import 'package:indoor_navigation/application/view_models/wifi_positioning_test_lab_view_model.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_node_mapping.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_validation_catalog.dart';
import 'package:indoor_navigation/infrastructure/wifi/manual_wifi_scan_manager.dart';
import 'package:indoor_navigation/ui/navigation/wifi_positioning_map_test_overlay.dart';
import 'package:indoor_navigation/ui/settings/wifi_positioning_test_lab.dart';

import '../../support/fakes/fake_clock.dart';

void main() {
  testWidgets('decorates any map with removable collapsed test controls', (
    tester,
  ) async {
    final clock = FakeClock(initialNowMs: 1000);
    final api = _FakeApi();
    var sampleReadyCount = 0;
    final viewModel = WifiPositioningTestLabViewModel(
      api: api,
      clock: clock,
      mappingRegistry: WifiNodeMappingRegistry(
        floorId: 'floor-2',
        mappings: const {'node-1': 'node-1'},
        unmappedServerNodes: const {},
      ),
      pickIndex: (_) => 0,
      scanController: ManualWifiScanManager(clock: clock),
      validationCatalog: WifiValidationCatalog(<WifiValidationSample>[
        WifiValidationSample(
          locationId: 'node-1',
          orientation: 'unknown',
          readings: const <WifiValidationAccessPoint>[
            WifiValidationAccessPoint(
              bssid: 'AA:BB:CC:DD:EE:FF',
              frequencyMhz: 2412,
              rssi: -55,
            ),
          ],
          scanId: 1,
          sessionId: 'test-session',
          timestampMs: 1,
        ),
      ]),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: WifiPositioningMapTestOverlay(
            onSampleReady: () => sampleReadyCount += 1,
            viewModel: viewModel,
            child: const ColoredBox(
              key: ValueKey<String>('fake-map'),
              color: Colors.blue,
            ),
          ),
        ),
      ),
    );

    expect(find.byKey(const ValueKey<String>('fake-map')), findsOneWidget);
    expect(find.byKey(WifiPositioningMapTestOverlayKeys.open), findsOneWidget);
    expect(
      find.byKey(WifiPositioningMapTestOverlayKeys.expanded),
      findsNothing,
    );

    await tester.tap(find.byKey(WifiPositioningMapTestOverlayKeys.open));
    await tester.pump();
    expect(
      find.byKey(WifiPositioningMapTestOverlayKeys.expanded),
      findsOneWidget,
    );

    await tester.tap(find.byKey(WifiPositioningTestLabKeys.node('node-1')));
    await tester.pump();
    expect(api.request?.readings.single.rssi, -55);
    expect(sampleReadyCount, 1);
    expect(find.textContaining('MATCH'), findsOneWidget);

    await tester.tap(find.byKey(WifiPositioningMapTestOverlayKeys.close));
    await tester.pump();
    expect(
      find.byKey(WifiPositioningMapTestOverlayKeys.expanded),
      findsNothing,
    );
    expect(find.byKey(WifiPositioningMapTestOverlayKeys.open), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
    await viewModel.dispose();
  });
}

final class _FakeApi implements WifiPositioningApi {
  WifiPositioningRequest? request;

  @override
  Future<WifiPositioningResponse> findClosestNode(
    WifiPositioningRequest request,
  ) async {
    this.request = request;
    return WifiPositioningResponse(serverNodeId: 'node-1');
  }
}
