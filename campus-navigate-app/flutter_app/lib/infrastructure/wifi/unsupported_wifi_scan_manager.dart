import 'package:indoor_navigation/application/ports/wifi/wifi_scan_manager.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';

final class UnsupportedWifiScanManager implements WifiScanManager {
  UnsupportedWifiScanManager({required this.platformName});

  final String platformName;
  bool _disposed = false;

  @override
  Future<WifiScanAccessState> checkAccess() async {
    _ensureNotDisposed();
    return _unsupportedState;
  }

  @override
  Future<WifiScanAccessState> requestPermission() async {
    _ensureNotDisposed();
    return _unsupportedState;
  }

  @override
  Future<WifiScanBatch> scan() async {
    _ensureNotDisposed();
    throw WifiScanException(
      code: WifiScanErrorCode.unsupported,
      message: 'Nearby Wi-Fi scanning is unsupported on $platformName.',
    );
  }

  @override
  Future<void> dispose() async {
    _disposed = true;
  }

  WifiScanAccessState get _unsupportedState => const WifiScanAccessState(
    locationServicesEnabled: false,
    permission: WifiScanPermissionStatus.notDetermined,
    platformSupport: WifiScanPlatformSupport.unsupported,
    wifiEnabled: false,
  );

  void _ensureNotDisposed() {
    if (_disposed) {
      throw const WifiScanException(
        code: WifiScanErrorCode.disposed,
        message: 'Wi-Fi scan manager is disposed.',
      );
    }
  }
}
