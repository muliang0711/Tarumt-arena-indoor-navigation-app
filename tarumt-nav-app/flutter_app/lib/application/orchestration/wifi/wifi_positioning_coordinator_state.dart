import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_engine.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';

enum WifiPositioningPhase {
  idle,
  checkingAccess,
  requestingPermission,
  ready,
  scanning,
  correcting,
  paused,
  permissionDenied,
  permissionPermanentlyDenied,
  wifiDisabled,
  locationServicesDisabled,
  throttled,
  noReadings,
  networkUnavailable,
  serviceUnavailable,
  readingsRejected,
  configurationError,
  scanFailed,
  unsupported,
}

final class WifiPositioningScanDiagnostics {
  const WifiPositioningScanDiagnostics({
    this.activeScanCooldownUntilMs,
    this.batchCompletedAtMs,
    this.latestReadingObservedAtMs,
    this.nextPositioningCheckAtMs,
    this.readingCount,
    this.requestActiveScan,
    this.source,
  });

  const WifiPositioningScanDiagnostics.empty()
    : activeScanCooldownUntilMs = null,
      batchCompletedAtMs = null,
      latestReadingObservedAtMs = null,
      nextPositioningCheckAtMs = null,
      readingCount = null,
      requestActiveScan = null,
      source = null;

  final int? activeScanCooldownUntilMs;
  final int? batchCompletedAtMs;
  final int? latestReadingObservedAtMs;
  final int? nextPositioningCheckAtMs;
  final int? readingCount;
  final bool? requestActiveScan;
  final WifiScanBatchSource? source;
}

final class WifiPositioningCoordinatorState {
  const WifiPositioningCoordinatorState({
    required this.access,
    this.lastAttemptAtMs,
    this.lastErrorMessage,
    required this.lastFix,
    required this.phase,
    required this.retryAtMs,
    this.scanDiagnostics = const WifiPositioningScanDiagnostics.empty(),
  });

  const WifiPositioningCoordinatorState.idle()
    : access = null,
      lastAttemptAtMs = null,
      lastErrorMessage = null,
      lastFix = null,
      phase = WifiPositioningPhase.idle,
      retryAtMs = null,
      scanDiagnostics = const WifiPositioningScanDiagnostics.empty();

  final WifiScanAccessState? access;
  final int? lastAttemptAtMs;
  final String? lastErrorMessage;
  final WifiPositionFix? lastFix;
  final WifiPositioningPhase phase;
  final int? retryAtMs;
  final WifiPositioningScanDiagnostics scanDiagnostics;

  bool get isLocatingInitialPosition =>
      lastFix == null &&
      switch (phase) {
        WifiPositioningPhase.checkingAccess ||
        WifiPositioningPhase.requestingPermission ||
        WifiPositioningPhase.scanning => true,
        _ => false,
      };

  bool get isActionableFailure => switch (phase) {
    WifiPositioningPhase.permissionDenied ||
    WifiPositioningPhase.permissionPermanentlyDenied ||
    WifiPositioningPhase.wifiDisabled ||
    WifiPositioningPhase.locationServicesDisabled ||
    WifiPositioningPhase.throttled ||
    WifiPositioningPhase.noReadings ||
    WifiPositioningPhase.networkUnavailable ||
    WifiPositioningPhase.serviceUnavailable ||
    WifiPositioningPhase.readingsRejected ||
    WifiPositioningPhase.configurationError ||
    WifiPositioningPhase.scanFailed => true,
    _ => false,
  };
}
