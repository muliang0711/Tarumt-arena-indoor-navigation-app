import 'dart:async';

import 'package:indoor_navigation/application/orchestration/wifi/wifi_pdr_fusion_engine.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_coordinator_state.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_engine.dart';
import 'package:indoor_navigation/application/ports/time/clock.dart';
import 'package:indoor_navigation/application/ports/time/periodic_scheduler.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_api.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

typedef WifiFusionContextProvider = WifiFusionContext? Function();
typedef WifiCorrectionCallback =
    Future<void> Function(WifiCorrectionDecision decision);

final class WifiFusionContext {
  const WifiFusionContext({
    required this.currentPosition,
    required this.destinationNodeId,
    required this.pixelsPerMeter,
    required this.routeNodes,
  });

  final RoutePosition currentPosition;
  final String destinationNodeId;
  final double pixelsPerMeter;
  final List<OverlayRouteNode> routeNodes;
}

/// Runs rate-limited Android Wi-Fi fixes only while navigation is active.
final class WifiPositioningCoordinator {
  WifiPositioningCoordinator({
    required this.clock,
    required this.contextProvider,
    required this.onCorrection,
    required this.periodicScheduler,
    required this.positioningEngine,
    WifiPdrFusionEngine? fusionEngine,
    this.positioningIntervalMs = wifiPositioningIntervalMs,
  }) : assert(positioningIntervalMs > 0),
       fusionEngine = fusionEngine ?? WifiPdrFusionEngine();

  final Clock clock;
  final WifiFusionContextProvider contextProvider;
  final WifiPdrFusionEngine fusionEngine;
  final WifiCorrectionCallback onCorrection;
  final PeriodicScheduler periodicScheduler;
  final int positioningIntervalMs;
  final WifiPositioningEngine positioningEngine;
  final StreamController<WifiPositioningCoordinatorState> _statesController =
      StreamController<WifiPositioningCoordinatorState>.broadcast(sync: true);

  bool _active = false;
  bool _disposed = false;
  bool _inFlight = false;
  bool _preparing = false;
  int _generation = 0;
  int? _lastScanStartedAtMs;
  PeriodicTaskHandle? _pollTask;
  int? _retryNotBeforeMs;
  WifiPositioningCoordinatorState _state =
      const WifiPositioningCoordinatorState.idle();

  WifiPositioningCoordinatorState get state => _state;
  Stream<WifiPositioningCoordinatorState> get states =>
      _statesController.stream;

  void start() {
    if (_disposed || _active) return;
    _active = true;
    final generation = ++_generation;
    _publish(WifiPositioningPhase.checkingAccess);
    _pollTask = periodicScheduler.schedulePeriodic(
      intervalMs: positioningIntervalMs,
      callback: _poll,
    );
    unawaited(_prepareAndScan(generation));
  }

  void pause() {
    if (!_active) return;
    _active = false;
    _generation += 1;
    _pollTask?.cancel();
    _pollTask = null;
    _publish(WifiPositioningPhase.paused);
  }

  void resume() => start();

  void stop() {
    pause();
    fusionEngine.reset();
    _lastScanStartedAtMs = null;
    _retryNotBeforeMs = null;
    _publish(WifiPositioningPhase.idle);
  }

  void retry() {
    if (_disposed || !_active || _inFlight || _preparing) return;
    _retryNotBeforeMs = null;
    _lastScanStartedAtMs = null;
    final generation = ++_generation;
    _publish(WifiPositioningPhase.checkingAccess);
    unawaited(_prepareAndScan(generation));
  }

  Future<void> dispose() async {
    if (_disposed) return;
    stop();
    _disposed = true;
    try {
      await positioningEngine.dispose();
    } finally {
      await _statesController.close();
    }
  }

  Future<void> _prepareAndScan(int generation) async {
    if (_preparing) return;
    _preparing = true;
    try {
      _publish(WifiPositioningPhase.checkingAccess);
      var access = await positioningEngine.scanManager.checkAccess();
      if (!_isCurrent(generation)) return;
      _publishAccess(access);
      if (access.permission == WifiScanPermissionStatus.notDetermined ||
          access.permission == WifiScanPermissionStatus.denied) {
        _publish(WifiPositioningPhase.requestingPermission, access: access);
        access = await positioningEngine.scanManager.requestPermission();
        if (!_isCurrent(generation)) return;
        _publishAccess(access);
      }
      if (!_isCurrent(generation) || !_acceptAccess(access)) return;
      _publish(WifiPositioningPhase.ready, access: access);
      await _scan(generation);
    } catch (error) {
      if (_isCurrent(generation)) _handleFailure(error);
    } finally {
      _preparing = false;
    }
  }

  void _poll() {
    if (!_active || _inFlight || _preparing) return;
    if (_requiresManualRetry(_state.phase)) return;
    final retryAt = _retryNotBeforeMs;
    if (retryAt != null && clock.nowMs() < retryAt) return;
    if (_requiresAccessRecheck(_state.phase)) {
      unawaited(_prepareAndScan(_generation));
      return;
    }
    if (retryAt != null) {
      _retryNotBeforeMs = null;
      unawaited(_scan(_generation));
      return;
    }
    final lastScan = _lastScanStartedAtMs;
    if (lastScan != null && clock.nowMs() - lastScan < positioningIntervalMs) {
      return;
    }
    unawaited(_scan(_generation));
  }

  Future<void> _scan(int generation) async {
    final context = contextProvider();
    if (!_isCurrent(generation) || _inFlight || context == null) return;
    _inFlight = true;
    _lastScanStartedAtMs = clock.nowMs();
    _retryNotBeforeMs = null;
    _publish(
      fusionEngine.isAwaitingConfirmation
          ? WifiPositioningPhase.confirming
          : WifiPositioningPhase.scanning,
    );
    try {
      final fix = await positioningEngine.locate(
        availableLocalNodeIds: context.routeNodes
            .map((node) => node.nodeId)
            .toSet(),
      );
      if (!_isCurrent(generation)) return;
      final trustedNode = context.routeNodes
          .where((node) => node.nodeId == fix.localNodeId)
          .firstOrNull;
      if (trustedNode == null) return;
      final decision = fusionEngine.evaluate(
        currentPosition: context.currentPosition,
        destinationNodeId: context.destinationNodeId,
        fix: fix,
        pixelsPerMeter: context.pixelsPerMeter,
        trustedNode: trustedNode,
      );
      if (decision.isAccepted && _isCurrent(generation)) {
        _publish(WifiPositioningPhase.correcting, lastFix: fix);
        await onCorrection(decision);
        if (_isCurrent(generation)) {
          _publish(WifiPositioningPhase.ready, lastFix: fix);
        }
      } else if (_isCurrent(generation)) {
        _publish(WifiPositioningPhase.confirming, lastFix: fix);
      }
    } catch (error) {
      if (_isCurrent(generation)) _handleFailure(error);
    } finally {
      _inFlight = false;
    }
  }

  bool _isCurrent(int generation) =>
      !_disposed && _active && generation == _generation;

  bool _acceptAccess(WifiScanAccessState access) {
    if (access.platformSupport == WifiScanPlatformSupport.unsupported) {
      _publish(WifiPositioningPhase.unsupported, access: access);
      return false;
    }
    if (access.permission == WifiScanPermissionStatus.permanentlyDenied) {
      _publish(
        WifiPositioningPhase.permissionPermanentlyDenied,
        access: access,
      );
      return false;
    }
    if (access.permission != WifiScanPermissionStatus.granted) {
      _publish(WifiPositioningPhase.permissionDenied, access: access);
      return false;
    }
    if (!access.wifiEnabled) {
      _retryNotBeforeMs = clock.nowMs() + 30000;
      _publish(
        WifiPositioningPhase.wifiDisabled,
        access: access,
        retryAtMs: _retryNotBeforeMs,
      );
      return false;
    }
    if (!access.locationServicesEnabled) {
      _retryNotBeforeMs = clock.nowMs() + 30000;
      _publish(
        WifiPositioningPhase.locationServicesDisabled,
        access: access,
        retryAtMs: _retryNotBeforeMs,
      );
      return false;
    }
    return true;
  }

  void _publishAccess(WifiScanAccessState access) {
    _publish(_state.phase, access: access);
  }

  void _handleFailure(Object error) {
    final phase = switch (error) {
      WifiScanException(:final code) => switch (code) {
        WifiScanErrorCode.permissionDenied =>
          WifiPositioningPhase.permissionDenied,
        WifiScanErrorCode.locationServicesDisabled =>
          WifiPositioningPhase.locationServicesDisabled,
        WifiScanErrorCode.wifiDisabled => WifiPositioningPhase.wifiDisabled,
        WifiScanErrorCode.scanThrottled => WifiPositioningPhase.throttled,
        WifiScanErrorCode.unsupported => WifiPositioningPhase.unsupported,
        _ => WifiPositioningPhase.scanFailed,
      },
      WifiPositioningApiException(:final code) => switch (code) {
        WifiPositioningApiErrorCode.networkFailure ||
        WifiPositioningApiErrorCode.timeout =>
          WifiPositioningPhase.networkUnavailable,
        WifiPositioningApiErrorCode.serverFailure ||
        WifiPositioningApiErrorCode.httpFailure =>
          WifiPositioningPhase.serviceUnavailable,
        WifiPositioningApiErrorCode.validationRejected =>
          WifiPositioningPhase.readingsRejected,
        _ => WifiPositioningPhase.configurationError,
      },
      WifiPositioningException(:final code) => switch (code) {
        WifiPositioningErrorCode.noReadings ||
        WifiPositioningErrorCode.staleReadings =>
          WifiPositioningPhase.noReadings,
        WifiPositioningErrorCode.invalidNodeMapping =>
          WifiPositioningPhase.configurationError,
      },
      _ => WifiPositioningPhase.scanFailed,
    };
    final retryDelayMs = switch (phase) {
      WifiPositioningPhase.throttled => 30000,
      WifiPositioningPhase.networkUnavailable ||
      WifiPositioningPhase.readingsRejected ||
      WifiPositioningPhase.noReadings ||
      WifiPositioningPhase.scanFailed => 15000,
      WifiPositioningPhase.serviceUnavailable ||
      WifiPositioningPhase.wifiDisabled ||
      WifiPositioningPhase.locationServicesDisabled => 30000,
      _ => null,
    };
    _retryNotBeforeMs = retryDelayMs == null
        ? null
        : clock.nowMs() + retryDelayMs;
    _publish(phase, retryAtMs: _retryNotBeforeMs);
  }

  bool _requiresManualRetry(WifiPositioningPhase phase) => switch (phase) {
    WifiPositioningPhase.permissionDenied ||
    WifiPositioningPhase.permissionPermanentlyDenied ||
    WifiPositioningPhase.configurationError ||
    WifiPositioningPhase.unsupported => true,
    _ => false,
  };

  bool _requiresAccessRecheck(WifiPositioningPhase phase) => switch (phase) {
    WifiPositioningPhase.wifiDisabled ||
    WifiPositioningPhase.locationServicesDisabled => true,
    _ => false,
  };

  void _publish(
    WifiPositioningPhase phase, {
    WifiScanAccessState? access,
    WifiPositionFix? lastFix,
    int? retryAtMs,
  }) {
    if (_disposed) return;
    _state = WifiPositioningCoordinatorState(
      access: access ?? _state.access,
      lastFix: lastFix ?? _state.lastFix,
      phase: phase,
      retryAtMs: retryAtMs,
    );
    _statesController.add(_state);
  }
}
