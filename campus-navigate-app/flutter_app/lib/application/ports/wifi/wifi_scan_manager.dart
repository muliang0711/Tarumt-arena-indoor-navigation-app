import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';

abstract interface class WifiScanManager {
  /// Reports platform, permission, Wi-Fi, and location-service state.
  Future<WifiScanAccessState> checkAccess();

  /// Requests the foreground permission required for nearby access-point scans.
  Future<WifiScanAccessState> requestPermission();

  /// Performs one foreground scan and returns only a newly updated result set.
  Future<WifiScanBatch> scan();

  /// Idempotently cancels pending native work and releases the manager.
  Future<void> dispose();
}
