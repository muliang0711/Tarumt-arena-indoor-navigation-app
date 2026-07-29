import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_pdr_fusion_engine.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_coordinator.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_coordinator_state.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_engine.dart';
import 'package:indoor_navigation/application/ports/logging/wifi_diagnostic_log.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_api.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_manager.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_node_mapping.dart';

import '../../../support/fakes/fake_clock.dart';
import '../../../support/fakes/fake_periodic_scheduler.dart';

void main() {
  test('applies every valid fix on the five-second cadence', () async {
    final clock = FakeClock(initialNowMs: 1000);
    final scheduler = FakePeriodicScheduler(clock: clock);
    final scanManager = _ClockedWifiScanManager(clock);
    final decisions = <WifiCorrectionDecision>[];
    final coordinator = WifiPositioningCoordinator(
      clock: clock,
      contextProvider: _context,
      onCorrection: (decision) async => decisions.add(decision),
      periodicScheduler: scheduler,
      positioningEngine: WifiPositioningEngine(
        api: _NodeApi(),
        mappingRegistry: WifiNodeMappingRegistry(
          floorId: 'floor-2',
          mappings: const {'server-b': 'node-b'},
          unmappedServerNodes: const {},
        ),
        scanManager: scanManager,
      ),
    );

    coordinator.start();
    await _flushAsync();
    expect(scanManager.scanCount, 1);
    expect(decisions.single.kind, WifiCorrectionKind.teleport);
    expect(coordinator.state.lastAttemptAtMs, 1000);
    expect(coordinator.state.lastFix?.localNodeId, 'node-b');
    expect(coordinator.state.isLocatingInitialPosition, isFalse);
    expect(
      coordinator.state.scanDiagnostics.source,
      WifiScanBatchSource.active,
    );
    expect(coordinator.state.scanDiagnostics.requestActiveScan, isTrue);
    expect(coordinator.state.scanDiagnostics.readingCount, 1);
    expect(coordinator.state.scanDiagnostics.nextPositioningCheckAtMs, 6000);
    expect(coordinator.state.scanDiagnostics.activeScanCooldownUntilMs, isNull);

    scheduler.advanceByMs(5000);
    await _flushAsync();
    expect(scanManager.scanCount, 2);
    expect(decisions, hasLength(2));
    expect(scanManager.activeScanRequests, [true, true]);

    coordinator.pause();
    scheduler.advanceByMs(40000);
    await _flushAsync();
    expect(scanManager.scanCount, 2);
    await coordinator.dispose();
  });

  test(
    'does not correct back to the segment start while wrong-way is false',
    () async {
      final clock = FakeClock(initialNowMs: 1000);
      final corrections = <WifiCorrectionDecision>[];
      final diagnosticLog = _RecordingWifiDiagnosticLog();
      final coordinator = WifiPositioningCoordinator(
        clock: clock,
        contextProvider: () => WifiFusionContext(
          currentPosition: const RoutePosition(
            distanceAlongRoute: 25,
            headingDegrees: 0,
            screenX: 25,
            screenY: 0,
            segmentIndex: 0,
            tiledX: 25,
            tiledY: 0,
          ),
          pixelsPerMeter: 10,
          routeNodes: const <OverlayRouteNode>[_node1, _node2],
          routePath: const <OverlayRouteNode>[_node1, _node2],
        ),
        diagnosticLog: diagnosticLog,
        onCorrection: (decision) async => corrections.add(decision),
        periodicScheduler: FakePeriodicScheduler(clock: clock),
        positioningEngine: WifiPositioningEngine(
          api: _NodeApi(),
          mappingRegistry: WifiNodeMappingRegistry(
            floorId: 'floor-2',
            mappings: const {'server-b': 'node-1'},
            unmappedServerNodes: const {},
          ),
          scanManager: _ClockedWifiScanManager(clock),
        ),
      );

      coordinator.start();
      await _flushAsync();

      expect(corrections, isEmpty);
      expect(coordinator.state.phase, WifiPositioningPhase.ready);
      expect(coordinator.state.lastFix?.localNodeId, 'node-1');
      final ignored = diagnosticLog.events.singleWhere(
        (entry) => entry.event == 'correction_ignored',
      );
      expect(ignored.details['disposition'], 'noOpConsistent');
      expect(ignored.details['wrongWayDetected'], isFalse);
      await coordinator.dispose();
    },
  );

  test('does not request a permanently denied permission again', () async {
    final clock = FakeClock(initialNowMs: 1000);
    final manager = _ConfigurableWifiScanManager(
      clock: clock,
      access: _access(permission: WifiScanPermissionStatus.permanentlyDenied),
    );
    final coordinator = _coordinator(clock: clock, scanManager: manager);

    coordinator.start();
    await _flushAsync();

    expect(
      coordinator.state.phase,
      WifiPositioningPhase.permissionPermanentlyDenied,
    );
    expect(manager.permissionRequestCount, 0);
    expect(manager.scanCount, 0);
    await coordinator.dispose();
  });

  test('publishes denied permission after the foreground request', () async {
    final clock = FakeClock(initialNowMs: 1000);
    final manager = _ConfigurableWifiScanManager(
      clock: clock,
      access: _access(permission: WifiScanPermissionStatus.notDetermined),
      requestedAccess: _access(permission: WifiScanPermissionStatus.denied),
    );
    final coordinator = _coordinator(clock: clock, scanManager: manager);

    coordinator.start();
    await _flushAsync();

    expect(coordinator.state.phase, WifiPositioningPhase.permissionDenied);
    expect(manager.permissionRequestCount, 1);
    expect(manager.scanCount, 0);
    await coordinator.dispose();
  });

  test('manual retry rechecks access and restores positioning', () async {
    final clock = FakeClock(initialNowMs: 1000);
    final manager = _ConfigurableWifiScanManager(
      clock: clock,
      access: _access(wifiEnabled: false),
    );
    final coordinator = _coordinator(clock: clock, scanManager: manager);

    coordinator.start();
    await _flushAsync();
    expect(coordinator.state.phase, WifiPositioningPhase.wifiDisabled);

    manager.access = _granted;
    coordinator.retry();
    await _flushAsync();

    expect(manager.checkAccessCount, 2);
    expect(manager.scanCount, 1);
    expect(coordinator.state.phase, WifiPositioningPhase.ready);
    await coordinator.dispose();
  });

  test('throttling publishes cooldown and retries after 5 seconds', () async {
    final clock = FakeClock(initialNowMs: 1000);
    final scheduler = FakePeriodicScheduler(clock: clock);
    final manager = _ConfigurableWifiScanManager(
      clock: clock,
      access: _granted,
      scanError: const WifiScanException(
        code: WifiScanErrorCode.scanThrottled,
        message: 'cooldown',
      ),
    );
    final coordinator = _coordinator(
      clock: clock,
      scanManager: manager,
      scheduler: scheduler,
    );

    coordinator.start();
    await _flushAsync();
    expect(coordinator.state.phase, WifiPositioningPhase.throttled);
    expect(coordinator.state.retryAtMs, 6000);
    expect(coordinator.state.scanDiagnostics.requestActiveScan, isTrue);
    expect(coordinator.state.scanDiagnostics.source, isNull);
    expect(coordinator.state.scanDiagnostics.nextPositioningCheckAtMs, 6000);
    expect(coordinator.state.scanDiagnostics.activeScanCooldownUntilMs, 31000);

    scheduler.advanceByMs(4000);
    await _flushAsync();
    expect(manager.scanCount, 1);
    scheduler.advanceByMs(1000);
    await _flushAsync();
    expect(manager.scanCount, 2);
    expect(manager.activeScanRequests, [true, false]);
    expect(coordinator.state.phase, WifiPositioningPhase.throttled);
    expect(coordinator.state.scanDiagnostics.requestActiveScan, isFalse);
    expect(coordinator.state.scanDiagnostics.activeScanCooldownUntilMs, 31000);
    await coordinator.dispose();
  });

  test(
    'checks cached scans every 5 seconds during active hardware cooldown',
    () async {
      final clock = FakeClock(initialNowMs: 1000);
      final scheduler = FakePeriodicScheduler(clock: clock);
      final manager = _ConfigurableWifiScanManager(
        clock: clock,
        access: _granted,
        scanSource: WifiScanBatchSource.cached,
      );
      final coordinator = _coordinator(
        clock: clock,
        scanManager: manager,
        scheduler: scheduler,
      );

      coordinator.start();
      await _flushAsync();
      expect(manager.activeScanRequests, [true]);
      expect(
        coordinator.state.scanDiagnostics.source,
        WifiScanBatchSource.cached,
      );
      expect(coordinator.state.scanDiagnostics.requestActiveScan, isTrue);
      expect(coordinator.state.scanDiagnostics.batchCompletedAtMs, 1000);
      expect(coordinator.state.scanDiagnostics.latestReadingObservedAtMs, 1000);
      expect(coordinator.state.scanDiagnostics.readingCount, 1);
      expect(coordinator.state.scanDiagnostics.nextPositioningCheckAtMs, 6000);
      expect(
        coordinator.state.scanDiagnostics.activeScanCooldownUntilMs,
        31000,
      );

      for (var index = 0; index < 5; index += 1) {
        scheduler.advanceByMs(5000);
        await _flushAsync();
      }
      expect(manager.activeScanRequests, [
        true,
        false,
        false,
        false,
        false,
        false,
      ]);
      expect(coordinator.state.scanDiagnostics.requestActiveScan, isFalse);
      expect(
        coordinator.state.scanDiagnostics.activeScanCooldownUntilMs,
        31000,
      );

      scheduler.advanceByMs(5000);
      await _flushAsync();
      expect(manager.activeScanRequests.last, isTrue);
      await coordinator.dispose();
    },
  );

  test('network failures keep PDR-independent recovery state', () async {
    final clock = FakeClock(initialNowMs: 1000);
    final manager = _ConfigurableWifiScanManager(
      clock: clock,
      access: _granted,
    );
    final coordinator = _coordinator(
      api: _ErrorApi(
        const WifiPositioningApiException(
          code: WifiPositioningApiErrorCode.timeout,
          message: 'timeout',
        ),
      ),
      clock: clock,
      scanManager: manager,
    );

    coordinator.start();
    await _flushAsync();

    expect(coordinator.state.phase, WifiPositioningPhase.networkUnavailable);
    expect(coordinator.state.retryAtMs, 16000);
    expect(coordinator.state.isActionableFailure, isTrue);
    await coordinator.dispose();
  });

  test(
    'validation rejection is not reported as a map configuration error',
    () async {
      final clock = FakeClock(initialNowMs: 1000);
      final diagnosticLog = _RecordingWifiDiagnosticLog();
      final coordinator = _coordinator(
        api: _ErrorApi(
          const WifiPositioningApiException(
            code: WifiPositioningApiErrorCode.validationRejected,
            message: 'unrecognized scan',
            responseBody: '{"detail":[{"msg":"unknown fingerprint"}]}',
            statusCode: 422,
          ),
        ),
        clock: clock,
        diagnosticLog: diagnosticLog,
        scanManager: _ConfigurableWifiScanManager(
          clock: clock,
          access: _granted,
        ),
      );

      coordinator.start();
      await _flushAsync();

      expect(coordinator.state.phase, WifiPositioningPhase.readingsRejected);
      expect(coordinator.state.retryAtMs, 16000);
      final attempt = diagnosticLog.events.singleWhere(
        (entry) => entry.event == 'attempt_failed',
      );
      expect(attempt.details['phase'], 'readingsRejected');
      final apiRequest = attempt.details['apiRequest'] as Map<String, Object?>;
      expect(apiRequest['checkedServerNodeIds'], ['server-b']);
      final readings = attempt.details['readings'] as List<Object?>;
      final reading = readings.single as Map<String, Object?>;
      expect(reading['bssid'], 'AA:BB:CC:DD:EE:FF');
      expect(reading['rssi'], -55);
      final error = attempt.details['error'] as Map<String, Object?>;
      expect(error['code'], 'validationRejected');
      expect(error['statusCode'], 422);
      expect(error['responseBody'], contains('unknown fingerprint'));

      coordinator.pause(reason: 'app_lifecycle:inactive');
      final pause = diagnosticLog.events.lastWhere(
        (entry) => entry.event == 'positioning_paused',
      );
      expect(pause.details['reason'], 'app_lifecycle:inactive');
      await coordinator.dispose();
    },
  );
}

WifiPositioningCoordinator _coordinator({
  WifiPositioningApi? api,
  required FakeClock clock,
  WifiDiagnosticLog diagnosticLog = const NoopWifiDiagnosticLog(),
  required WifiScanManager scanManager,
  FakePeriodicScheduler? scheduler,
}) {
  return WifiPositioningCoordinator(
    clock: clock,
    contextProvider: _context,
    diagnosticLog: diagnosticLog,
    onCorrection: (_) async {},
    periodicScheduler: scheduler ?? FakePeriodicScheduler(clock: clock),
    positioningEngine: WifiPositioningEngine(
      api: api ?? _NodeApi(),
      mappingRegistry: WifiNodeMappingRegistry(
        floorId: 'floor-2',
        mappings: const {'server-b': 'node-b'},
        unmappedServerNodes: const {},
      ),
      scanManager: scanManager,
    ),
  );
}

WifiFusionContext _context() => const WifiFusionContext(
  currentPosition: RoutePosition(
    distanceAlongRoute: 0,
    headingDegrees: 90,
    screenX: 0,
    screenY: 0,
    segmentIndex: 0,
    tiledX: 0,
    tiledY: 0,
  ),
  pixelsPerMeter: 10,
  routeNodes: <OverlayRouteNode>[
    OverlayRouteNode(
      id: 2,
      nodeId: 'node-b',
      screenX: 80,
      screenY: 0,
      tiledX: 80,
      tiledY: 0,
      type: 'navigation',
    ),
  ],
);

const _node1 = OverlayRouteNode(
  id: 1,
  nodeId: 'node-1',
  screenX: 0,
  screenY: 0,
  tiledX: 0,
  tiledY: 0,
  type: 'navigation',
);

const _node2 = OverlayRouteNode(
  id: 2,
  nodeId: 'node-2',
  screenX: 100,
  screenY: 0,
  tiledX: 100,
  tiledY: 0,
  type: 'navigation',
);

final class _NodeApi implements WifiPositioningApi {
  @override
  Future<WifiPositioningResponse> findClosestNode(
    WifiPositioningRequest request,
  ) async => WifiPositioningResponse(serverNodeId: 'server-b');
}

final class _ErrorApi implements WifiPositioningApi {
  _ErrorApi(this.error);

  final Object error;

  @override
  Future<WifiPositioningResponse> findClosestNode(
    WifiPositioningRequest request,
  ) => Future<WifiPositioningResponse>.error(error);
}

final class _ClockedWifiScanManager implements WifiScanManager {
  _ClockedWifiScanManager(this.clock);

  final FakeClock clock;
  int scanCount = 0;
  final List<bool> activeScanRequests = <bool>[];

  @override
  Future<WifiScanAccessState> checkAccess() async => _granted;

  @override
  Future<void> dispose() async {}

  @override
  Future<WifiScanAccessState> requestPermission() async => _granted;

  @override
  Future<WifiScanBatch> scan({bool requestActiveScan = true}) async {
    scanCount += 1;
    activeScanRequests.add(requestActiveScan);
    return WifiScanBatch(
      completedAtMs: clock.nowMs(),
      readings: <WifiAccessPointReading>[
        WifiAccessPointReading(
          bssid: 'AA:BB:CC:DD:EE:FF',
          frequencyMhz: 2412,
          observedAtMs: clock.nowMs(),
          rssi: -55,
          ssid: 'Campus',
        ),
      ],
      source: WifiScanBatchSource.active,
      startedAtMs: clock.nowMs(),
    );
  }
}

final class _ConfigurableWifiScanManager implements WifiScanManager {
  _ConfigurableWifiScanManager({
    required this.access,
    required this.clock,
    this.requestedAccess,
    this.scanError,
    this.scanSource = WifiScanBatchSource.active,
  });

  WifiScanAccessState access;
  final FakeClock clock;
  final WifiScanAccessState? requestedAccess;
  final Object? scanError;
  final WifiScanBatchSource scanSource;
  int checkAccessCount = 0;
  int permissionRequestCount = 0;
  int scanCount = 0;
  final List<bool> activeScanRequests = <bool>[];

  @override
  Future<WifiScanAccessState> checkAccess() async {
    checkAccessCount += 1;
    return access;
  }

  @override
  Future<void> dispose() async {}

  @override
  Future<WifiScanAccessState> requestPermission() async {
    permissionRequestCount += 1;
    return requestedAccess ?? access;
  }

  @override
  Future<WifiScanBatch> scan({bool requestActiveScan = true}) async {
    scanCount += 1;
    activeScanRequests.add(requestActiveScan);
    final error = scanError;
    if (error != null) return Future<WifiScanBatch>.error(error);
    return WifiScanBatch(
      completedAtMs: clock.nowMs(),
      readings: <WifiAccessPointReading>[
        WifiAccessPointReading(
          bssid: 'AA:BB:CC:DD:EE:FF',
          frequencyMhz: 2412,
          observedAtMs: clock.nowMs(),
          rssi: -55,
          ssid: 'Campus',
        ),
      ],
      source: scanSource,
      startedAtMs: clock.nowMs(),
    );
  }
}

const _granted = WifiScanAccessState(
  locationServicesEnabled: true,
  permission: WifiScanPermissionStatus.granted,
  platformSupport: WifiScanPlatformSupport.supported,
  wifiEnabled: true,
);

WifiScanAccessState _access({
  bool locationServicesEnabled = true,
  WifiScanPermissionStatus permission = WifiScanPermissionStatus.granted,
  bool wifiEnabled = true,
}) => WifiScanAccessState(
  locationServicesEnabled: locationServicesEnabled,
  permission: permission,
  platformSupport: WifiScanPlatformSupport.supported,
  wifiEnabled: wifiEnabled,
);

Future<void> _flushAsync() async {
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
}

final class _RecordingWifiDiagnosticLog implements WifiDiagnosticLog {
  final List<WifiDiagnosticEvent> events = <WifiDiagnosticEvent>[];

  @override
  WifiDiagnosticLogState get state => WifiDiagnosticLogState(
    eventCount: events.length,
    lastEventAtMs: events.lastOrNull?.timestampMs,
  );

  @override
  Stream<WifiDiagnosticLogState> get states => const Stream.empty();

  @override
  void record({
    required String category,
    required String event,
    Map<String, Object?> details = const <String, Object?>{},
  }) {
    events.add(
      WifiDiagnosticEvent(
        category: category,
        details: details,
        event: event,
        sequence: events.length + 1,
        sessionId: 'test',
        timestampMs: 1000,
      ),
    );
  }

  @override
  Future<void> clear() async => events.clear();

  @override
  Future<String> exportJson() async => '{}';

  @override
  Future<void> flush() async {}
}
