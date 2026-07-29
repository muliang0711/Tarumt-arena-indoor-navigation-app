import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_api.dart';
import 'package:indoor_navigation/application/view_models/wifi_positioning_test_lab_view_model.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_node_mapping.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_validation_catalog.dart';
import 'package:indoor_navigation/infrastructure/wifi/manual_wifi_scan_manager.dart';
import 'package:indoor_navigation/ui/settings/settings_screen.dart';
import 'package:indoor_navigation/ui/settings/wifi_positioning_test_lab.dart';

import '../../support/fakes/fake_clock.dart';

void main() {
  testWidgets('hides the Test Lab unless manual mode injected it', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: SettingsScreen()));

    expect(find.byKey(SettingsScreenKeys.screen), findsOneWidget);
    expect(find.byKey(WifiPositioningTestLabKeys.panel), findsNothing);
  });

  testWidgets('shows node buttons and runs a recorded sample with one tap', (
    tester,
  ) async {
    final clock = FakeClock(initialNowMs: 1000);
    final manager = ManualWifiScanManager(clock: clock);
    final api = _FakeApi(responseNodeId: 'node-1');
    final viewModel = _viewModel(api: api, clock: clock, manager: manager);
    await tester.pumpWidget(
      MaterialApp(home: SettingsScreen(wifiTestLabViewModel: viewModel)),
    );

    expect(find.byType(TextFormField), findsNothing);
    expect(
      find.byKey(WifiPositioningTestLabKeys.node('node-1')),
      findsOneWidget,
    );
    expect(
      find.byKey(WifiPositioningTestLabKeys.node('node-2')),
      findsOneWidget,
    );
    expect(find.text('unmapped-location'), findsNothing);

    await tester.tap(find.byKey(WifiPositioningTestLabKeys.node('node-1')));
    await tester.pump();

    expect(api.request?.readings.single.rssi, -55);
    expect(manager.readings.single.rssi, -55);
    expect(find.textContaining('MATCH'), findsOneWidget);
    expect(find.textContaining('Expected: node-1'), findsOneWidget);
    expect(find.textContaining('Predicted: node-1'), findsOneWidget);
    expect(find.textContaining('scan 1 · 1 APs'), findsOneWidget);
    await viewModel.dispose();
  });

  testWidgets('shows a mismatch without treating it as a request error', (
    tester,
  ) async {
    final clock = FakeClock(initialNowMs: 1000);
    final viewModel = _viewModel(
      api: _FakeApi(responseNodeId: 'node-2'),
      clock: clock,
      manager: ManualWifiScanManager(clock: clock),
    );
    await tester.pumpWidget(
      MaterialApp(home: SettingsScreen(wifiTestLabViewModel: viewModel)),
    );

    await tester.tap(find.byKey(WifiPositioningTestLabKeys.node('node-1')));
    await tester.pump();

    expect(find.textContaining('MISMATCH'), findsOneWidget);
    expect(find.textContaining('Predicted: node-2'), findsOneWidget);
    await viewModel.dispose();
  });
}

WifiPositioningTestLabViewModel _viewModel({
  required WifiPositioningApi api,
  required FakeClock clock,
  required ManualWifiScanManager manager,
}) => WifiPositioningTestLabViewModel(
  api: api,
  clock: clock,
  mappingRegistry: WifiNodeMappingRegistry(
    floorId: 'floor-2',
    mappings: const {'node-1': 'node-1', 'node-2': 'node-2'},
    unmappedServerNodes: const {'unmapped-location': 'No map node.'},
  ),
  pickIndex: (_) => 0,
  scanController: manager,
  validationCatalog: WifiValidationCatalog(<WifiValidationSample>[
    _sample(locationId: 'node-1', bssidSuffix: '01', rssi: -55),
    _sample(locationId: 'node-2', bssidSuffix: '02', rssi: -72),
    _sample(locationId: 'unmapped-location', bssidSuffix: '03', rssi: -80),
  ]),
);

WifiValidationSample _sample({
  required String bssidSuffix,
  required String locationId,
  required int rssi,
}) => WifiValidationSample(
  locationId: locationId,
  orientation: 'unknown',
  readings: <WifiValidationAccessPoint>[
    WifiValidationAccessPoint(
      bssid: 'AA:BB:CC:DD:EE:$bssidSuffix',
      frequencyMhz: 2412,
      rssi: rssi,
    ),
  ],
  scanId: 1,
  sessionId: 'test-session',
  timestampMs: 1000,
);

final class _FakeApi implements WifiPositioningApi {
  _FakeApi({required this.responseNodeId});

  final String responseNodeId;
  WifiPositioningRequest? request;

  @override
  Future<WifiPositioningResponse> findClosestNode(
    WifiPositioningRequest request,
  ) async {
    this.request = request;
    return WifiPositioningResponse(serverNodeId: responseNodeId);
  }
}
