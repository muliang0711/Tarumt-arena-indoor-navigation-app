import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_engine.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_api.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_manager.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_node_mapping.dart';

void main() {
  test(
    'scans, constrains the API, and validates the returned local node',
    () async {
      final scanManager = _FakeWifiScanManager(_batch());
      final api = _FakeWifiPositioningApi('server-a');
      final engine = WifiPositioningEngine(
        api: api,
        mappingRegistry: _registry(),
        scanManager: scanManager,
      );

      final fix = await engine.locate(availableLocalNodeIds: {'local-a'});

      expect(fix.serverNodeId, 'server-a');
      expect(fix.localNodeId, 'local-a');
      expect(fix.floorId, 'floor-2');
      expect(fix.observedAtMs, 200);
      expect(fix.readingCount, 1);
      expect(api.request?.timestampMs, 200);
      expect(api.request?.checkedServerNodeIds, ['server-a']);
      expect(api.request?.readings.single.bssid, 'AA:BB:CC:DD:EE:FF');
      await engine.dispose();
      expect(scanManager.disposeCount, 1);
    },
  );

  test('does not call the API when no fresh readings exist', () async {
    final api = _FakeWifiPositioningApi('server-a');
    final engine = WifiPositioningEngine(
      api: api,
      mappingRegistry: _registry(),
      scanManager: _FakeWifiScanManager(
        WifiScanBatch(completedAtMs: 200, readings: const [], startedAtMs: 100),
      ),
    );

    await expectLater(
      engine.locate(availableLocalNodeIds: {'local-a'}),
      throwsA(
        isA<WifiPositioningException>().having(
          (error) => error.code,
          'code',
          WifiPositioningErrorCode.noReadings,
        ),
      ),
    );
    expect(api.request, isNull);
  });

  test('sends only readings inside the configured freshness window', () async {
    final api = _FakeWifiPositioningApi('server-a');
    final engine = WifiPositioningEngine(
      api: api,
      mappingRegistry: _registry(),
      maxReadingAgeMs: 2000,
      scanManager: _FakeWifiScanManager(
        WifiScanBatch(
          completedAtMs: 10000,
          readings: <WifiAccessPointReading>[
            _reading(bssid: 'AA:BB:CC:DD:EE:01', observedAtMs: 9500),
            _reading(bssid: 'AA:BB:CC:DD:EE:02', observedAtMs: 7999),
            _reading(bssid: 'AA:BB:CC:DD:EE:03', observedAtMs: 10001),
          ],
          startedAtMs: 9000,
        ),
      ),
    );

    final fix = await engine.locate(availableLocalNodeIds: {'local-a'});

    expect(fix.readingCount, 1);
    expect(api.request?.readings.single.bssid, 'AA:BB:CC:DD:EE:01');
  });

  test('does not call the API when every reading is stale', () async {
    final api = _FakeWifiPositioningApi('server-a');
    final engine = WifiPositioningEngine(
      api: api,
      mappingRegistry: _registry(),
      maxReadingAgeMs: 2000,
      scanManager: _FakeWifiScanManager(
        WifiScanBatch(
          completedAtMs: 10000,
          readings: <WifiAccessPointReading>[
            _reading(bssid: 'AA:BB:CC:DD:EE:02', observedAtMs: 7999),
          ],
          startedAtMs: 7000,
        ),
      ),
    );

    await expectLater(
      engine.locate(availableLocalNodeIds: {'local-a'}),
      throwsA(
        isA<WifiPositioningException>().having(
          (error) => error.code,
          'code',
          WifiPositioningErrorCode.staleReadings,
        ),
      ),
    );
    expect(api.request, isNull);
  });

  test('rejects server nodes that are not safely mapped to this map', () async {
    for (final nodeId in <String>['known-unmapped', 'unknown']) {
      final engine = WifiPositioningEngine(
        api: _FakeWifiPositioningApi(nodeId),
        mappingRegistry: _registry(),
        scanManager: _FakeWifiScanManager(_batch()),
      );

      await expectLater(
        engine.locate(availableLocalNodeIds: {'local-a'}),
        throwsA(
          isA<WifiPositioningException>()
              .having(
                (error) => error.code,
                'code',
                WifiPositioningErrorCode.invalidNodeMapping,
              )
              .having(
                (error) => error.cause,
                'cause',
                isA<WifiNodeMappingException>(),
              ),
        ),
      );
    }
  });
}

WifiNodeMappingRegistry _registry() => WifiNodeMappingRegistry(
  floorId: 'floor-2',
  mappings: const {'server-a': 'local-a'},
  unmappedServerNodes: const {'known-unmapped': 'No exact local node.'},
);

WifiScanBatch _batch() => WifiScanBatch(
  completedAtMs: 200,
  readings: <WifiAccessPointReading>[
    WifiAccessPointReading(
      bssid: 'AA:BB:CC:DD:EE:FF',
      frequencyMhz: 2412,
      observedAtMs: 150,
      rssi: -55,
      ssid: 'Campus',
    ),
  ],
  startedAtMs: 100,
);

WifiAccessPointReading _reading({
  required String bssid,
  required int observedAtMs,
}) => WifiAccessPointReading(
  bssid: bssid,
  frequencyMhz: 2412,
  observedAtMs: observedAtMs,
  rssi: -55,
  ssid: 'Campus',
);

final class _FakeWifiPositioningApi implements WifiPositioningApi {
  _FakeWifiPositioningApi(this.nodeId);

  final String nodeId;
  WifiPositioningRequest? request;

  @override
  Future<WifiPositioningResponse> findClosestNode(
    WifiPositioningRequest request,
  ) async {
    this.request = request;
    return WifiPositioningResponse(serverNodeId: nodeId);
  }
}

final class _FakeWifiScanManager implements WifiScanManager {
  _FakeWifiScanManager(this.batch);

  final WifiScanBatch batch;
  int disposeCount = 0;

  @override
  Future<WifiScanAccessState> checkAccess() => throw UnimplementedError();

  @override
  Future<void> dispose() async {
    disposeCount += 1;
  }

  @override
  Future<WifiScanAccessState> requestPermission() => throw UnimplementedError();

  @override
  Future<WifiScanBatch> scan() async => batch;
}
