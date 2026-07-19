import 'package:indoor_navigation/application/ports/time/clock.dart';
import 'package:indoor_navigation/application/ports/wifi/manual_wifi_scan_controller.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_manager.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';

/// Hardware-free scan source used to exercise the real API and fusion flow.
///
/// Stored values are observations rather than completed scans. Each [scan]
/// timestamps a fresh immutable batch, matching what the native adapter emits.
final class ManualWifiScanManager
    implements ManualWifiScanController, WifiScanManager {
  ManualWifiScanManager({
    required this.clock,
    List<ManualWifiAccessPointReading> initialReadings = const [],
  }) : _readings = List.unmodifiable(initialReadings);

  final Clock clock;
  List<ManualWifiAccessPointReading> _readings;
  bool _disposed = false;

  @override
  List<ManualWifiAccessPointReading> get readings => _readings;

  @override
  void replaceReadings(List<ManualWifiAccessPointReading> readings) {
    _ensureNotDisposed();
    _readings = List.unmodifiable(readings);
  }

  @override
  void clearReadings() => replaceReadings(const []);

  @override
  Future<WifiScanAccessState> checkAccess() async {
    _ensureNotDisposed();
    return _availableState;
  }

  @override
  Future<WifiScanAccessState> requestPermission() async {
    _ensureNotDisposed();
    return _availableState;
  }

  @override
  Future<WifiScanBatch> scan() async {
    _ensureNotDisposed();
    final timestampMs = clock.nowMs();
    return WifiScanBatch(
      completedAtMs: timestampMs,
      readings: _readings
          .map(
            (reading) => WifiAccessPointReading(
              bssid: reading.bssid,
              frequencyMhz: reading.frequencyMhz,
              observedAtMs: timestampMs,
              rssi: reading.rssi,
              ssid: reading.ssid,
            ),
          )
          .toList(growable: false),
      startedAtMs: timestampMs,
    );
  }

  @override
  Future<void> dispose() async {
    _disposed = true;
    _readings = const [];
  }

  void _ensureNotDisposed() {
    if (_disposed) {
      throw const WifiScanException(
        code: WifiScanErrorCode.disposed,
        message: 'Manual Wi-Fi scan manager is disposed.',
      );
    }
  }
}

const _availableState = WifiScanAccessState(
  locationServicesEnabled: true,
  permission: WifiScanPermissionStatus.granted,
  platformSupport: WifiScanPlatformSupport.supported,
  wifiEnabled: true,
);
