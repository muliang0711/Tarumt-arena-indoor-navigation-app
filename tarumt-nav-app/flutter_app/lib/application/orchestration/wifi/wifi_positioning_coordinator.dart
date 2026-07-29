import 'dart:async';

import 'package:indoor_navigation/application/orchestration/wifi/wifi_pdr_fusion_engine.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_coordinator_state.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_engine.dart';
import 'package:indoor_navigation/application/ports/logging/wifi_diagnostic_log.dart';
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
    required this.pixelsPerMeter,
    required this.routeNodes,
    this.routePath = const <OverlayRouteNode>[],
    this.wrongWayDetected = false,
  });

  final RoutePosition currentPosition;
  final double pixelsPerMeter;
  final List<OverlayRouteNode> routeNodes;
  final List<OverlayRouteNode> routePath;
  final bool wrongWayDetected;
}

/// Runs rate-limited Android Wi-Fi fixes only while navigation is active.
final class WifiPositioningCoordinator {
  WifiPositioningCoordinator({
    required this.clock,
    required this.contextProvider,
    required this.onCorrection,
    required this.periodicScheduler,
    required this.positioningEngine,
    this.diagnosticLog = const NoopWifiDiagnosticLog(),
    WifiPdrFusionEngine? fusionEngine,
    this.positioningIntervalMs = wifiPositioningIntervalMs,
  }) : assert(positioningIntervalMs > 0),
       fusionEngine = fusionEngine ?? WifiPdrFusionEngine();

  final Clock clock;
  final WifiFusionContextProvider contextProvider;
  final WifiDiagnosticLog diagnosticLog;
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
  int? _activeScanCooldownUntilMs;
  int? _lastScanStartedAtMs;
  PeriodicTaskHandle? _pollTask;
  int? _retryNotBeforeMs;
  WifiPositioningScanDiagnostics _scanDiagnostics =
      const WifiPositioningScanDiagnostics.empty();
  WifiPositioningCoordinatorState _state =
      const WifiPositioningCoordinatorState.idle();

  WifiPositioningCoordinatorState get state => _state;
  Stream<WifiPositioningCoordinatorState> get states =>
      _statesController.stream;

  void start() {
    if (_disposed || _active) return;
    _active = true;
    final generation = ++_generation;
    _record(
      category: 'lifecycle',
      event: 'positioning_started',
      details: <String, Object?>{'generation': generation},
    );
    _publish(WifiPositioningPhase.checkingAccess, clearLastError: true);
    _pollTask = periodicScheduler.schedulePeriodic(
      intervalMs: positioningIntervalMs,
      callback: _poll,
    );
    unawaited(_prepareAndScan(generation));
  }

  void pause({String reason = 'unspecified'}) {
    if (!_active) return;
    _active = false;
    _generation += 1;
    _pollTask?.cancel();
    _pollTask = null;
    _publish(WifiPositioningPhase.paused);
    _record(
      category: 'lifecycle',
      event: 'positioning_paused',
      details: <String, Object?>{'reason': reason},
    );
  }

  void resume({String reason = 'unspecified'}) {
    _record(
      category: 'lifecycle',
      event: 'positioning_resume_requested',
      details: <String, Object?>{'reason': reason},
    );
    start();
  }

  void stop({String reason = 'navigation_stopped'}) {
    pause(reason: reason);
    _lastScanStartedAtMs = null;
    _activeScanCooldownUntilMs = null;
    _retryNotBeforeMs = null;
    _scanDiagnostics = const WifiPositioningScanDiagnostics.empty();
    _publish(
      WifiPositioningPhase.idle,
      clearLastError: true,
      clearLastFix: true,
    );
    _record(
      category: 'lifecycle',
      event: 'positioning_stopped',
      details: <String, Object?>{'reason': reason},
    );
  }

  void retry() {
    if (_disposed || !_active || _inFlight || _preparing) return;
    _retryNotBeforeMs = null;
    _lastScanStartedAtMs = null;
    _activeScanCooldownUntilMs = null;
    _scanDiagnostics = WifiPositioningScanDiagnostics(
      batchCompletedAtMs: _scanDiagnostics.batchCompletedAtMs,
      latestReadingObservedAtMs: _scanDiagnostics.latestReadingObservedAtMs,
      readingCount: _scanDiagnostics.readingCount,
      requestActiveScan: true,
      source: _scanDiagnostics.source,
    );
    _record(category: 'lifecycle', event: 'manual_retry_requested');
    final generation = ++_generation;
    _publish(WifiPositioningPhase.checkingAccess, clearLastError: true);
    unawaited(_prepareAndScan(generation));
  }

  Future<void> dispose() async {
    if (_disposed) return;
    stop(reason: 'coordinator_disposed');
    _disposed = true;
    try {
      await positioningEngine.dispose();
    } finally {
      await diagnosticLog.flush();
      await _statesController.close();
    }
  }

  Future<void> _prepareAndScan(int generation) async {
    if (_preparing) return;
    _preparing = true;
    try {
      _publish(WifiPositioningPhase.checkingAccess, clearLastError: true);
      var access = await positioningEngine.scanManager.checkAccess();
      if (!_isCurrent(generation)) return;
      _recordAccess('access_checked', access);
      _publishAccess(access);
      if (access.permission == WifiScanPermissionStatus.notDetermined ||
          access.permission == WifiScanPermissionStatus.denied) {
        _publish(WifiPositioningPhase.requestingPermission, access: access);
        access = await positioningEngine.scanManager.requestPermission();
        if (!_isCurrent(generation)) return;
        _recordAccess('permission_result', access);
        _publishAccess(access);
      }
      if (!_isCurrent(generation) || !_acceptAccess(access)) return;
      _publish(WifiPositioningPhase.ready, access: access);
      await _scan(generation);
    } catch (error) {
      if (_isCurrent(generation)) {
        _handleFailure(error);
        _record(
          category: 'access',
          event: 'access_failed',
          details: _errorDetails(error),
        );
      }
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
    final requestActiveScan =
        _activeScanCooldownUntilMs == null ||
        clock.nowMs() >= _activeScanCooldownUntilMs!;
    _scanDiagnostics = WifiPositioningScanDiagnostics(
      activeScanCooldownUntilMs: _activeScanCooldownUntilMs,
      batchCompletedAtMs: _scanDiagnostics.batchCompletedAtMs,
      latestReadingObservedAtMs: _scanDiagnostics.latestReadingObservedAtMs,
      readingCount: _scanDiagnostics.readingCount,
      requestActiveScan: requestActiveScan,
      source: _scanDiagnostics.source,
    );
    _publish(
      WifiPositioningPhase.scanning,
      clearLastError: true,
      lastAttemptAtMs: _lastScanStartedAtMs,
    );
    _record(
      category: 'positioning',
      event: 'attempt_started',
      details: <String, Object?>{
        'requestActiveScan': requestActiveScan,
        'activeScanCooldownUntilMs': _activeScanCooldownUntilMs,
        'currentPosition': _positionDetails(context.currentPosition),
        'routeNodeCount': context.routeNodes.length,
        'routeNodeIds': context.routeNodes
            .map((node) => node.nodeId)
            .toList(growable: false),
      },
    );
    WifiPositionFix? completedFix;
    WifiCorrectionDecision? completedDecision;
    try {
      final fix = await positioningEngine.locate(
        availableLocalNodeIds: context.routeNodes
            .map((node) => node.nodeId)
            .toSet(),
        requestActiveScan: requestActiveScan,
      );
      completedFix = fix;
      if (!_isCurrent(generation)) return;
      final latestContext = contextProvider();
      if (latestContext == null) return;
      _updateActiveScanPolicy(requestActiveScan: requestActiveScan);
      _captureScanDiagnostics(requestActiveScan: requestActiveScan);
      final trustedNode = latestContext.routeNodes
          .where((node) => node.nodeId == fix.localNodeId)
          .firstOrNull;
      if (trustedNode == null) {
        throw WifiPositioningException(
          code: WifiPositioningErrorCode.invalidNodeMapping,
          message:
              'Mapped node ${fix.localNodeId} disappeared from the active route graph.',
        );
      }
      final decision = fusionEngine.evaluate(
        currentPosition: latestContext.currentPosition,
        fix: fix,
        pixelsPerMeter: latestContext.pixelsPerMeter,
        routePath: latestContext.routePath,
        trustedNode: trustedNode,
        wrongWayDetected: latestContext.wrongWayDetected,
      );
      completedDecision = decision;
      if (_isCurrent(generation)) {
        _recordPositioningAttempt(
          context: latestContext,
          decision: decision,
          event: 'attempt_resolved',
          fix: fix,
          requestActiveScan: requestActiveScan,
        );
        if (decision.shouldApply) {
          _publish(WifiPositioningPhase.correcting, lastFix: fix);
          await onCorrection(decision);
          if (!_isCurrent(generation)) return;
          _publish(
            WifiPositioningPhase.ready,
            clearLastError: true,
            lastFix: fix,
          );
          _record(
            category: 'positioning',
            event: 'correction_applied',
            details: <String, Object?>{
              'serverNodeId': fix.serverNodeId,
              'localNodeId': fix.localNodeId,
              'correction': decision.kind.name,
              'driftMeters': decision.driftMeters,
            },
          );
        } else {
          _publish(
            WifiPositioningPhase.ready,
            clearLastError: true,
            lastFix: fix,
          );
          _record(
            category: 'positioning',
            event: 'correction_ignored',
            details: <String, Object?>{
              'serverNodeId': fix.serverNodeId,
              'localNodeId': fix.localNodeId,
              'disposition': decision.disposition.name,
              'wrongWayDetected': latestContext.wrongWayDetected,
            },
          );
        }
      }
    } catch (error, stackTrace) {
      if (_isCurrent(generation)) {
        _updateActiveScanPolicy(
          error: error,
          requestActiveScan: requestActiveScan,
        );
        _captureScanDiagnostics(requestActiveScan: requestActiveScan);
        _handleFailure(error);
        _recordPositioningAttempt(
          context: context,
          decision: completedDecision,
          error: error,
          event: 'attempt_failed',
          fix: completedFix,
          requestActiveScan: requestActiveScan,
          stackTrace: stackTrace,
        );
      }
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
    if (error case WifiPositioningException(
      code: WifiPositioningErrorCode.duplicateReadings,
    )) {
      _retryNotBeforeMs = null;
      _publish(WifiPositioningPhase.ready, clearLastError: true);
      return;
    }
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
        WifiPositioningErrorCode.duplicateReadings ||
        WifiPositioningErrorCode.insufficientRecognizedReadings ||
        WifiPositioningErrorCode.noReadings ||
        WifiPositioningErrorCode.staleReadings =>
          WifiPositioningPhase.noReadings,
        WifiPositioningErrorCode.invalidNodeMapping =>
          WifiPositioningPhase.configurationError,
      },
      _ => WifiPositioningPhase.scanFailed,
    };
    final retryDelayMs = switch (phase) {
      WifiPositioningPhase.throttled => wifiPositioningThrottleRetryMs,
      WifiPositioningPhase.noReadings ||
      WifiPositioningPhase.scanFailed => wifiPositioningIntervalMs,
      WifiPositioningPhase.networkUnavailable ||
      WifiPositioningPhase.readingsRejected => 15000,
      WifiPositioningPhase.serviceUnavailable ||
      WifiPositioningPhase.wifiDisabled ||
      WifiPositioningPhase.locationServicesDisabled => 30000,
      _ => null,
    };
    _retryNotBeforeMs = retryDelayMs == null
        ? null
        : clock.nowMs() + retryDelayMs;
    _publish(
      phase,
      lastErrorMessage: _failureMessage(error),
      retryAtMs: _retryNotBeforeMs,
    );
  }

  void _updateActiveScanPolicy({
    required bool requestActiveScan,
    Object? error,
  }) {
    if (!requestActiveScan) return;
    final scanSource = positioningEngine.lastScanSource;
    final wasThrottled =
        error is WifiScanException &&
        error.code == WifiScanErrorCode.scanThrottled;
    if (wasThrottled ||
        (scanSource != null && scanSource != WifiScanBatchSource.active)) {
      _activeScanCooldownUntilMs = clock.nowMs() + wifiActiveScanCooldownMs;
      return;
    }
    if (scanSource == WifiScanBatchSource.active) {
      _activeScanCooldownUntilMs = null;
    }
  }

  void _captureScanDiagnostics({required bool requestActiveScan}) {
    final batch = positioningEngine.lastScanBatch;
    final latestReadingObservedAtMs = batch?.readings.fold<int?>(
      null,
      (latest, reading) => latest == null || reading.observedAtMs > latest
          ? reading.observedAtMs
          : latest,
    );
    _scanDiagnostics = WifiPositioningScanDiagnostics(
      activeScanCooldownUntilMs: _activeScanCooldownUntilMs,
      batchCompletedAtMs:
          batch?.completedAtMs ?? _scanDiagnostics.batchCompletedAtMs,
      latestReadingObservedAtMs: batch == null
          ? _scanDiagnostics.latestReadingObservedAtMs
          : latestReadingObservedAtMs,
      readingCount: batch?.readings.length ?? _scanDiagnostics.readingCount,
      requestActiveScan: requestActiveScan,
      source: batch?.source ?? _scanDiagnostics.source,
    );
  }

  void _recordAccess(String event, WifiScanAccessState access) {
    _record(
      category: 'access',
      event: event,
      details: <String, Object?>{
        'platformSupport': access.platformSupport.name,
        'permission': access.permission.name,
        'wifiEnabled': access.wifiEnabled,
        'locationServicesEnabled': access.locationServicesEnabled,
        'canScan': access.canScan,
      },
    );
  }

  void _recordPositioningAttempt({
    required WifiFusionContext context,
    WifiCorrectionDecision? decision,
    Object? error,
    required String event,
    WifiPositionFix? fix,
    required bool requestActiveScan,
    StackTrace? stackTrace,
  }) {
    final batch = positioningEngine.lastScanBatch;
    final readingFilter = positioningEngine.lastReadingFilterDiagnostics;
    final request = positioningEngine.lastRequest;
    final readings = request?.readings ?? batch?.readings ?? const [];
    _record(
      category: 'positioning',
      event: event,
      details: <String, Object?>{
        'phase': _state.phase.name,
        'requestActiveScan': requestActiveScan,
        'activeScanCooldownUntilMs': _activeScanCooldownUntilMs,
        'scanBatch': batch == null
            ? null
            : <String, Object?>{
                'source': batch.source.name,
                'startedAtMs': batch.startedAtMs,
                'completedAtMs': batch.completedAtMs,
                'rawReadingCount': batch.readings.length,
              },
        'apiRequest': request == null
            ? null
            : <String, Object?>{
                'timestampMs': request.timestampMs,
                'checkedServerNodeIds': request.checkedServerNodeIds,
                'readingCount': request.readings.length,
              },
        'readingFilter': readingFilter == null
            ? null
            : <String, Object?>{
                'candidateReadingCount': readingFilter.candidateReadingCount,
                'ssidMatchedReadingCount':
                    readingFilter.ssidMatchedReadingCount,
                'recognizedReadingCount': readingFilter.recognizedReadingCount,
                'minimumReadingCount': readingFilter.minimumReadingCount,
              },
        'readingSet': request == null ? 'raw_scan' : 'api_request',
        'readings': readings
            .map(
              (reading) => <String, Object?>{
                'bssid': reading.bssid,
                'ssid': reading.ssid,
                'rssi': reading.rssi,
                'frequencyMhz': reading.frequencyMhz,
                'observedAtMs': reading.observedAtMs,
                'ageAtAttemptMs':
                    (request?.timestampMs ??
                        batch?.completedAtMs ??
                        clock.nowMs()) -
                    reading.observedAtMs,
              },
            )
            .toList(growable: false),
        'currentPosition': _positionDetails(context.currentPosition),
        'fix': fix == null
            ? null
            : <String, Object?>{
                'serverNodeId': fix.serverNodeId,
                'localNodeId': fix.localNodeId,
                'observedAtMs': fix.observedAtMs,
                'readingTier': fix.readingTier.name,
                'readingCount': fix.readingCount,
                'scanSource': fix.scanSource.name,
              },
        'correction': decision == null
            ? null
            : <String, Object?>{
                'kind': decision.kind.name,
                'driftMeters': decision.driftMeters,
                'disposition': decision.disposition.name,
              },
        'error': error == null
            ? null
            : <String, Object?>{
                ..._errorDetails(error),
                if (stackTrace != null &&
                    error is! WifiScanException &&
                    error is! WifiPositioningApiException &&
                    error is! WifiPositioningException)
                  'stackTrace': _bounded(stackTrace.toString()),
              },
      },
    );
  }

  Map<String, Object?> _errorDetails(Object error) => switch (error) {
    WifiScanException() => <String, Object?>{
      'type': 'WifiScanException',
      'code': error.code.name,
      'message': error.message,
      'cause': error.cause?.toString(),
    },
    WifiPositioningApiException() => <String, Object?>{
      'type': 'WifiPositioningApiException',
      'code': error.code.name,
      'message': error.message,
      'statusCode': error.statusCode,
      'responseBody': error.responseBody,
      'cause': error.cause?.toString(),
    },
    WifiPositioningException() => <String, Object?>{
      'type': 'WifiPositioningException',
      'code': error.code.name,
      'message': error.message,
      'cause': error.cause?.toString(),
    },
    _ => <String, Object?>{
      'type': error.runtimeType.toString(),
      'message': error.toString(),
    },
  };

  Map<String, Object?> _positionDetails(RoutePosition position) =>
      <String, Object?>{
        'screenX': position.screenX,
        'screenY': position.screenY,
        'tiledX': position.tiledX,
        'tiledY': position.tiledY,
        'headingDegrees': position.headingDegrees,
        'segmentIndex': position.segmentIndex,
        'distanceAlongRoute': position.distanceAlongRoute,
      };

  void _record({
    required String category,
    required String event,
    Map<String, Object?> details = const <String, Object?>{},
  }) {
    try {
      diagnosticLog.record(category: category, event: event, details: details);
    } catch (_) {
      // Diagnostics must never alter positioning behavior.
    }
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
    bool clearLastError = false,
    bool clearLastFix = false,
    int? lastAttemptAtMs,
    String? lastErrorMessage,
    WifiPositionFix? lastFix,
    int? retryAtMs,
  }) {
    if (_disposed) return;
    final nextPositioningCheckAtMs = !_active || _requiresManualRetry(phase)
        ? null
        : _retryNotBeforeMs ??
              (_lastScanStartedAtMs == null
                  ? null
                  : _lastScanStartedAtMs! + positioningIntervalMs);
    final publishedScanDiagnostics = WifiPositioningScanDiagnostics(
      activeScanCooldownUntilMs: _scanDiagnostics.activeScanCooldownUntilMs,
      batchCompletedAtMs: _scanDiagnostics.batchCompletedAtMs,
      latestReadingObservedAtMs: _scanDiagnostics.latestReadingObservedAtMs,
      nextPositioningCheckAtMs: nextPositioningCheckAtMs,
      readingCount: _scanDiagnostics.readingCount,
      requestActiveScan: _scanDiagnostics.requestActiveScan,
      source: _scanDiagnostics.source,
    );
    _state = WifiPositioningCoordinatorState(
      access: access ?? _state.access,
      lastAttemptAtMs: lastAttemptAtMs ?? _state.lastAttemptAtMs,
      lastErrorMessage: clearLastError
          ? null
          : lastErrorMessage ?? _state.lastErrorMessage,
      lastFix: clearLastFix ? null : lastFix ?? _state.lastFix,
      phase: phase,
      retryAtMs: retryAtMs,
      scanDiagnostics: publishedScanDiagnostics,
    );
    _statesController.add(_state);
  }
}

String _failureMessage(Object error) => switch (error) {
  WifiScanException(:final message) => message,
  WifiPositioningApiException(:final message) => message,
  WifiPositioningException(:final message) => message,
  _ => 'Wi-Fi positioning failed unexpectedly.',
};

String _bounded(String value) {
  const maxLength = 4096;
  if (value.length <= maxLength) return value;
  return '${value.substring(0, maxLength)}…';
}
