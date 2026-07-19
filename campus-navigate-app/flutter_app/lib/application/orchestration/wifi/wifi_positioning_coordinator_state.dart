import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_engine.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';

enum WifiPositioningPhase {
  idle,
  checkingAccess,
  requestingPermission,
  ready,
  scanning,
  confirming,
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

final class WifiPositioningCoordinatorState {
  const WifiPositioningCoordinatorState({
    required this.access,
    required this.lastFix,
    required this.phase,
    required this.retryAtMs,
  });

  const WifiPositioningCoordinatorState.idle()
    : access = null,
      lastFix = null,
      phase = WifiPositioningPhase.idle,
      retryAtMs = null;

  final WifiScanAccessState? access;
  final WifiPositionFix? lastFix;
  final WifiPositioningPhase phase;
  final int? retryAtMs;

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
