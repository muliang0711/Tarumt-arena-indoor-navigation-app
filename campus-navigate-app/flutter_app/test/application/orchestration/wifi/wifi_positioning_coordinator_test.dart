import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_pdr_fusion_engine.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_coordinator.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_coordinator_state.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_engine.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_api.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_manager.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_node_mapping.dart';

import '../../../support/fakes/fake_clock.dart';
import '../../../support/fakes/fake_periodic_scheduler.dart';

void main() {
  test(
    'runs regular and confirmation positioning on the five-second cadence',
    () async {
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
      expect(decisions, isEmpty);

      scheduler.advanceByMs(5000);
      await _flushAsync();
      expect(scanManager.scanCount, 2);
      expect(decisions.single.kind, WifiCorrectionKind.teleport);

      scheduler.advanceByMs(5000);
      await _flushAsync();
      expect(scanManager.scanCount, 3);

      coordinator.pause();
      scheduler.advanceByMs(40000);
      await _flushAsync();
      expect(scanManager.scanCount, 3);
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
    expect(coordinator.state.phase, WifiPositioningPhase.confirming);
    await coordinator.dispose();
  });

  test('throttling publishes cooldown and retries after 30 seconds', () async {
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
    expect(coordinator.state.retryAtMs, 31000);

    scheduler.advanceByMs(25000);
    await _flushAsync();
    expect(manager.scanCount, 1);
    scheduler.advanceByMs(5000);
    await _flushAsync();
    expect(manager.scanCount, 2);
    expect(coordinator.state.phase, WifiPositioningPhase.throttled);
    await coordinator.dispose();
  });

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
      final coordinator = _coordinator(
        api: _ErrorApi(
          const WifiPositioningApiException(
            code: WifiPositioningApiErrorCode.validationRejected,
            message: 'unrecognized scan',
            statusCode: 422,
          ),
        ),
        clock: clock,
        scanManager: _ConfigurableWifiScanManager(
          clock: clock,
          access: _granted,
        ),
      );

      coordinator.start();
      await _flushAsync();

      expect(coordinator.state.phase, WifiPositioningPhase.readingsRejected);
      expect(coordinator.state.retryAtMs, 16000);
      await coordinator.dispose();
    },
  );
}

WifiPositioningCoordinator _coordinator({
  WifiPositioningApi? api,
  required FakeClock clock,
  required WifiScanManager scanManager,
  FakePeriodicScheduler? scheduler,
}) {
  return WifiPositioningCoordinator(
    clock: clock,
    contextProvider: _context,
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
  destinationNodeId: 'destination',
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

  @override
  Future<WifiScanAccessState> checkAccess() async => _granted;

  @override
  Future<void> dispose() async {}

  @override
  Future<WifiScanAccessState> requestPermission() async => _granted;

  @override
  Future<WifiScanBatch> scan() async {
    scanCount += 1;
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
  });

  WifiScanAccessState access;
  final FakeClock clock;
  final WifiScanAccessState? requestedAccess;
  final Object? scanError;
  int checkAccessCount = 0;
  int permissionRequestCount = 0;
  int scanCount = 0;

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
  Future<WifiScanBatch> scan() async {
    scanCount += 1;
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
