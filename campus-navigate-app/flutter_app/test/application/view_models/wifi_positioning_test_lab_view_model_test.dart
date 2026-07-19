import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_api.dart';
import 'package:indoor_navigation/application/view_models/wifi_positioning_test_lab_view_model.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_node_mapping.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_validation_catalog.dart';
import 'package:indoor_navigation/infrastructure/wifi/manual_wifi_scan_manager.dart';

import '../../support/fakes/fake_clock.dart';

void main() {
  test('randomly selects one node sample, sends it, and retains it', () async {
    final clock = FakeClock(initialNowMs: 1234);
    final api = _FakeApi(responseNodeId: 'node-1');
    final controller = ManualWifiScanManager(clock: clock);
    final viewModel = _viewModel(
      api: api,
      clock: clock,
      controller: controller,
      pickIndex: (_) => 1,
    );

    await viewModel.submitRandomSample('node-1');

    expect(viewModel.selectableNodeIds, ['node-1', 'node-2', 'node-12']);
    expect(controller.readings.single.bssid, 'AA:BB:CC:DD:EE:02');
    expect(controller.readings.single.rssi, -72);
    expect(api.request?.timestampMs, 1234);
    expect(api.request?.readings.single.observedAtMs, 1234);
    expect(api.request?.readings.single.rssi, -72);
    expect(viewModel.state.phase, WifiPositioningTestLabPhase.success);
    expect(viewModel.state.expectedNodeId, 'node-1');
    expect(viewModel.state.predictedServerNodeId, 'node-1');
    expect(viewModel.state.localNodeId, 'node-1');
    expect(viewModel.state.sampleScanId, 2);
    expect(viewModel.state.readingCount, 1);
    expect(viewModel.state.predictionMatches, isTrue);
    await viewModel.dispose();
  });

  test('reports a valid but incorrect KNN prediction as a mismatch', () async {
    final clock = FakeClock(initialNowMs: 1234);
    final viewModel = _viewModel(
      api: _FakeApi(responseNodeId: 'node-2'),
      clock: clock,
      controller: ManualWifiScanManager(clock: clock),
      pickIndex: (_) => 0,
    );

    await viewModel.submitRandomSample('node-1');

    expect(viewModel.state.phase, WifiPositioningTestLabPhase.success);
    expect(viewModel.state.expectedNodeId, 'node-1');
    expect(viewModel.state.predictedServerNodeId, 'node-2');
    expect(viewModel.state.predictionMatches, isFalse);
    await viewModel.dispose();
  });

  test('resetSession clears retained readings and test diagnostics', () async {
    final clock = FakeClock(initialNowMs: 1234);
    final controller = ManualWifiScanManager(clock: clock);
    final viewModel = _viewModel(
      api: _FakeApi(responseNodeId: 'node-1'),
      clock: clock,
      controller: controller,
      pickIndex: (_) => 0,
    );

    await viewModel.submitRandomSample('node-1');
    viewModel.resetSession();

    expect(controller.readings, isEmpty);
    expect(viewModel.state.phase, WifiPositioningTestLabPhase.idle);
    expect(viewModel.state.expectedNodeId, isNull);
    await viewModel.dispose();
  });

  test('keeps sample diagnostics for API and mapping failures', () async {
    final clock = FakeClock(initialNowMs: 1234);
    final apiFailure = _viewModel(
      api: _FakeApi(
        error: const WifiPositioningApiException(
          code: WifiPositioningApiErrorCode.validationRejected,
          message: 'Rejected.',
          statusCode: 422,
        ),
      ),
      clock: clock,
      controller: ManualWifiScanManager(clock: clock),
      pickIndex: (_) => 0,
    );

    await apiFailure.submitRandomSample('node-1');
    expect(apiFailure.state.phase, WifiPositioningTestLabPhase.failure);
    expect(apiFailure.state.errorMessage, 'Rejected. (HTTP 422)');
    expect(apiFailure.state.expectedNodeId, 'node-1');
    expect(apiFailure.state.sampleScanId, 1);

    final mappingFailure = _viewModel(
      api: _FakeApi(responseNodeId: 'unknown'),
      clock: clock,
      controller: ManualWifiScanManager(clock: clock),
      pickIndex: (_) => 0,
    );
    await mappingFailure.submitRandomSample('node-1');
    expect(mappingFailure.state.phase, WifiPositioningTestLabPhase.failure);
    expect(mappingFailure.state.predictedServerNodeId, 'unknown');
    expect(mappingFailure.state.errorMessage, contains('absent'));

    await apiFailure.dispose();
    await mappingFailure.dispose();
  });

  test('rejects locations that are not mapped selectable nodes', () async {
    final clock = FakeClock(initialNowMs: 1234);
    final viewModel = _viewModel(
      api: _FakeApi(responseNodeId: 'node-1'),
      clock: clock,
      controller: ManualWifiScanManager(clock: clock),
      pickIndex: (_) => 0,
    );

    await expectLater(
      viewModel.submitRandomSample('unmapped-location'),
      throwsArgumentError,
    );
    await viewModel.dispose();
  });
}

WifiPositioningTestLabViewModel _viewModel({
  required WifiPositioningApi api,
  required FakeClock clock,
  required ManualWifiScanManager controller,
  required WifiValidationIndexPicker pickIndex,
}) => WifiPositioningTestLabViewModel(
  api: api,
  clock: clock,
  mappingRegistry: WifiNodeMappingRegistry(
    floorId: 'floor-2',
    mappings: const {
      'node-1': 'node-1',
      'node-2': 'node-2',
      'node-12': 'node-12',
      'node-20': 'node-20',
    },
    unmappedServerNodes: const {
      'unmapped-location': 'No corresponding map node.',
    },
  ),
  pickIndex: pickIndex,
  scanController: controller,
  validationCatalog: _catalog(),
);

WifiValidationCatalog _catalog() =>
    WifiValidationCatalog(<WifiValidationSample>[
      _sample(locationId: 'node-1', scanId: 1, bssidSuffix: '01', rssi: -55),
      _sample(locationId: 'node-1', scanId: 2, bssidSuffix: '02', rssi: -72),
      _sample(locationId: 'node-2', scanId: 1, bssidSuffix: '03', rssi: -60),
      _sample(locationId: 'node-12', scanId: 1, bssidSuffix: '04', rssi: -65),
      _sample(
        locationId: 'unmapped-location',
        scanId: 1,
        bssidSuffix: '05',
        rssi: -70,
      ),
    ]);

WifiValidationSample _sample({
  required String bssidSuffix,
  required String locationId,
  required int rssi,
  required int scanId,
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
  scanId: scanId,
  sessionId: 'test-session',
  timestampMs: 1000 + scanId,
);

final class _FakeApi implements WifiPositioningApi {
  _FakeApi({this.error, this.responseNodeId});

  final Object? error;
  final String? responseNodeId;
  WifiPositioningRequest? request;

  @override
  Future<WifiPositioningResponse> findClosestNode(
    WifiPositioningRequest request,
  ) async {
    this.request = request;
    final failure = error;
    if (failure != null) throw failure;
    return WifiPositioningResponse(serverNodeId: responseNodeId!);
  }
}
