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
      expect(fix.observedAtMs, 150);
      expect(fix.readingTier, WifiPositioningReadingTier.fresh);
      expect(fix.readingCount, 1);
      expect(fix.scanSource, WifiScanBatchSource.active);
      expect(engine.lastScanBatch?.source, WifiScanBatchSource.active);
      expect(engine.lastScanBatch?.completedAtMs, 200);
      expect(engine.lastScanBatch?.readings, hasLength(1));
      expect(engine.lastRequest?.timestampMs, 200);
      expect(engine.lastRequest?.checkedServerNodeIds, ['server-a']);
      expect(engine.lastRequest?.readings.single.rssi, -55);
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
        WifiScanBatch(
          completedAtMs: 200,
          readings: const [],
          source: WifiScanBatchSource.active,
          startedAtMs: 100,
        ),
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
    expect(engine.lastScanBatch?.readings, isEmpty);
  });

  test('sends only readings inside the configured freshness window', () async {
    final api = _FakeWifiPositioningApi('server-a');
    final engine = WifiPositioningEngine(
      api: api,
      mappingRegistry: _registry(),
      fallbackReadingAgeMs: 4000,
      freshReadingAgeMs: 2000,
      scanManager: _FakeWifiScanManager(
        WifiScanBatch(
          completedAtMs: 10000,
          readings: <WifiAccessPointReading>[
            _reading(bssid: 'AA:BB:CC:DD:EE:01', observedAtMs: 9500),
            _reading(bssid: 'AA:BB:CC:DD:EE:02', observedAtMs: 7999),
            _reading(bssid: 'AA:BB:CC:DD:EE:03', observedAtMs: 10001),
          ],
          source: WifiScanBatchSource.active,
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
      fallbackReadingAgeMs: 2000,
      freshReadingAgeMs: 1000,
      scanManager: _FakeWifiScanManager(
        WifiScanBatch(
          completedAtMs: 10000,
          readings: <WifiAccessPointReading>[
            _reading(bssid: 'AA:BB:CC:DD:EE:02', observedAtMs: 7999),
          ],
          source: WifiScanBatchSource.active,
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

  test('uses bounded fallback readings when no fresh AP remains', () async {
    final api = _FakeWifiPositioningApi('server-a');
    final engine = WifiPositioningEngine(
      api: api,
      mappingRegistry: _registry(),
      freshReadingAgeMs: 1000,
      fallbackReadingAgeMs: 3000,
      scanManager: _FakeWifiScanManager(
        _batchAt(completedAtMs: 10000, observedAtMs: 8500),
      ),
    );

    final fix = await engine.locate(availableLocalNodeIds: {'local-a'});

    expect(fix.readingTier, WifiPositioningReadingTier.fallback);
    expect(fix.readingCount, 1);
    expect(fix.observedAtMs, 8500);
    expect(api.request?.readings.single.observedAtMs, 8500);
  });

  test('filters native readings by campus SSID and trained BSSID', () async {
    final api = _FakeWifiPositioningApi('server-a');
    final engine = WifiPositioningEngine(
      api: api,
      mappingRegistry: _registry(),
      readingPolicy: WifiPositioningReadingPolicy.campus(
        minimumReadingCount: 1,
        trainedBssids: const {'AA:BB:CC:DD:EE:01', 'AA:BB:CC:DD:EE:02'},
      ),
      scanManager: _FakeWifiScanManager(
        WifiScanBatch(
          completedAtMs: 10000,
          readings: <WifiAccessPointReading>[
            _reading(
              bssid: 'AA:BB:CC:DD:EE:01',
              observedAtMs: 9500,
              ssid: 'tarumt-arena',
            ),
            _reading(
              bssid: 'AA:BB:CC:DD:EE:02',
              observedAtMs: 9500,
              ssid: 'Personal hotspot',
            ),
            _reading(
              bssid: 'AA:BB:CC:DD:EE:03',
              observedAtMs: 9500,
              ssid: 'TARUMT-PUBLIC',
            ),
          ],
          source: WifiScanBatchSource.active,
          startedAtMs: 9000,
        ),
      ),
    );

    await engine.locate(availableLocalNodeIds: {'local-a'});

    expect(api.request?.readings, hasLength(1));
    expect(api.request?.readings.single.bssid, 'AA:BB:CC:DD:EE:01');
    expect(engine.lastReadingFilterDiagnostics?.candidateReadingCount, 3);
    expect(engine.lastReadingFilterDiagnostics?.ssidMatchedReadingCount, 2);
    expect(engine.lastReadingFilterDiagnostics?.recognizedReadingCount, 1);
  });

  test('does not call the API without enough recognized campus APs', () async {
    final api = _FakeWifiPositioningApi('server-a');
    final engine = WifiPositioningEngine(
      api: api,
      mappingRegistry: _registry(),
      readingPolicy: WifiPositioningReadingPolicy.campus(
        trainedBssids: const {'AA:BB:CC:DD:EE:01'},
      ),
      scanManager: _FakeWifiScanManager(
        WifiScanBatch(
          completedAtMs: 10000,
          readings: <WifiAccessPointReading>[
            _reading(
              bssid: 'AA:BB:CC:DD:EE:01',
              observedAtMs: 9500,
              ssid: 'TARUMT-ARENA',
            ),
            _reading(
              bssid: 'AA:BB:CC:DD:EE:02',
              observedAtMs: 9500,
              ssid: '👻',
            ),
          ],
          source: WifiScanBatchSource.active,
          startedAtMs: 9000,
        ),
      ),
    );

    await expectLater(
      engine.locate(availableLocalNodeIds: {'local-a'}),
      throwsA(
        isA<WifiPositioningException>().having(
          (error) => error.code,
          'code',
          WifiPositioningErrorCode.insufficientRecognizedReadings,
        ),
      ),
    );

    expect(api.request, isNull);
    expect(engine.lastReadingFilterDiagnostics?.recognizedReadingCount, 1);
    expect(engine.lastReadingFilterDiagnostics?.minimumReadingCount, 3);
  });

  test('suppresses an unchanged fingerprint without a newer AP', () async {
    final first = _batchAt(completedAtMs: 10000, observedAtMs: 9500);
    final repeated = _batchAt(completedAtMs: 11000, observedAtMs: 9500);
    final api = _FakeWifiPositioningApi('server-a');
    final engine = WifiPositioningEngine(
      api: api,
      mappingRegistry: _registry(),
      scanManager: _FakeWifiScanManager.sequence([first, repeated]),
    );

    await engine.locate(availableLocalNodeIds: {'local-a'});
    await expectLater(
      engine.locate(availableLocalNodeIds: {'local-a'}),
      throwsA(
        isA<WifiPositioningException>().having(
          (error) => error.code,
          'code',
          WifiPositioningErrorCode.duplicateReadings,
        ),
      ),
    );

    expect(api.requestCount, 1);
  });

  test('accepts a newer observation or changed RSSI fingerprint', () async {
    final api = _FakeWifiPositioningApi('server-a');
    final engine = WifiPositioningEngine(
      api: api,
      mappingRegistry: _registry(),
      scanManager: _FakeWifiScanManager.sequence([
        _batchAt(completedAtMs: 10000, observedAtMs: 9500),
        _batchAt(completedAtMs: 11000, observedAtMs: 10500),
        _batchAt(completedAtMs: 12000, observedAtMs: 10500, rssi: -60),
      ]),
    );

    await engine.locate(availableLocalNodeIds: {'local-a'});
    await engine.locate(availableLocalNodeIds: {'local-a'});
    await engine.locate(availableLocalNodeIds: {'local-a'});

    expect(api.requestCount, 3);
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
  source: WifiScanBatchSource.active,
  startedAtMs: 100,
);

WifiScanBatch _batchAt({
  required int completedAtMs,
  required int observedAtMs,
  int rssi = -55,
}) => WifiScanBatch(
  completedAtMs: completedAtMs,
  readings: <WifiAccessPointReading>[
    WifiAccessPointReading(
      bssid: 'AA:BB:CC:DD:EE:FF',
      frequencyMhz: 2412,
      observedAtMs: observedAtMs,
      rssi: rssi,
      ssid: 'Campus',
    ),
  ],
  source: WifiScanBatchSource.passive,
  startedAtMs: completedAtMs,
);

WifiAccessPointReading _reading({
  required String bssid,
  required int observedAtMs,
  String? ssid = 'Campus',
}) => WifiAccessPointReading(
  bssid: bssid,
  frequencyMhz: 2412,
  observedAtMs: observedAtMs,
  rssi: -55,
  ssid: ssid,
);

final class _FakeWifiPositioningApi implements WifiPositioningApi {
  _FakeWifiPositioningApi(this.nodeId);

  final String nodeId;
  WifiPositioningRequest? request;
  int requestCount = 0;

  @override
  Future<WifiPositioningResponse> findClosestNode(
    WifiPositioningRequest request,
  ) async {
    requestCount += 1;
    this.request = request;
    return WifiPositioningResponse(serverNodeId: nodeId);
  }
}

final class _FakeWifiScanManager implements WifiScanManager {
  _FakeWifiScanManager(WifiScanBatch batch) : _batches = [batch];

  _FakeWifiScanManager.sequence(List<WifiScanBatch> batches)
    : assert(batches.isNotEmpty),
      _batches = List.of(batches);

  final List<WifiScanBatch> _batches;
  int disposeCount = 0;
  int _scanIndex = 0;

  @override
  Future<WifiScanAccessState> checkAccess() => throw UnimplementedError();

  @override
  Future<void> dispose() async {
    disposeCount += 1;
  }

  @override
  Future<WifiScanAccessState> requestPermission() => throw UnimplementedError();

  @override
  Future<WifiScanBatch> scan({bool requestActiveScan = true}) async {
    final index = _scanIndex < _batches.length
        ? _scanIndex
        : _batches.length - 1;
    _scanIndex += 1;
    return _batches[index];
  }
}
