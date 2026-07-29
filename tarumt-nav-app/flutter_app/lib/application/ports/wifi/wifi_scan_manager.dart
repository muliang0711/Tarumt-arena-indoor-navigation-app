import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';

abstract interface class WifiScanManager {
  /// Reports platform, permission, Wi-Fi, and location-service state.
  Future<WifiScanAccessState> checkAccess();

  /// Requests the foreground permission required for nearby access-point scans.
  Future<WifiScanAccessState> requestPermission();

  /// Returns a scan batch, optionally requesting fresh Android hardware work.
  Future<WifiScanBatch> scan({bool requestActiveScan = true});

  /// Idempotently cancels pending native work and releases the manager.
  Future<void> dispose();
}
