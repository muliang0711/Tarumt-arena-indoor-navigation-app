enum WifiScanPlatformSupport { supported, unsupported }

enum WifiScanPermissionStatus {
  notDetermined,
  granted,
  denied,
  permanentlyDenied,
}

final class WifiScanAccessState {
  const WifiScanAccessState({
    required this.locationServicesEnabled,
    required this.permission,
    required this.platformSupport,
    required this.wifiEnabled,
  });

  final bool locationServicesEnabled;
  final WifiScanPermissionStatus permission;
  final WifiScanPlatformSupport platformSupport;
  final bool wifiEnabled;

  bool get canScan =>
      platformSupport == WifiScanPlatformSupport.supported &&
      permission == WifiScanPermissionStatus.granted &&
      wifiEnabled &&
      locationServicesEnabled;
}

final class WifiAccessPointReading {
  WifiAccessPointReading({
    required String bssid,
    required this.frequencyMhz,
    required this.observedAtMs,
    required this.rssi,
    required String? ssid,
  }) : bssid = _normalizeBssid(bssid),
       ssid = _normalizeSsid(ssid) {
    if (!_bssidPattern.hasMatch(this.bssid)) {
      throw ArgumentError.value(bssid, 'bssid', 'must be a MAC address');
    }
    if (frequencyMhz <= 0) {
      throw ArgumentError.value(
        frequencyMhz,
        'frequencyMhz',
        'must be greater than zero',
      );
    }
    if (observedAtMs < 0) {
      throw ArgumentError.value(
        observedAtMs,
        'observedAtMs',
        'must not be negative',
      );
    }
  }

  final String bssid;
  final int frequencyMhz;
  final int observedAtMs;
  final int rssi;
  final String? ssid;
}

final class WifiScanBatch {
  WifiScanBatch({
    required this.completedAtMs,
    required List<WifiAccessPointReading> readings,
    required this.startedAtMs,
  }) : readings = List.unmodifiable(readings) {
    if (startedAtMs < 0) {
      throw ArgumentError.value(
        startedAtMs,
        'startedAtMs',
        'must not be negative',
      );
    }
    if (completedAtMs < startedAtMs) {
      throw ArgumentError.value(
        completedAtMs,
        'completedAtMs',
        'must be on or after startedAtMs',
      );
    }
  }

  final int completedAtMs;
  final List<WifiAccessPointReading> readings;
  final int startedAtMs;
}

enum WifiScanErrorCode {
  disposed,
  locationServicesDisabled,
  permissionDenied,
  permissionRequestInProgress,
  scanFailed,
  scanInProgress,
  scanThrottled,
  unsupported,
  wifiDisabled,
}

final class WifiScanException implements Exception {
  const WifiScanException({
    required this.code,
    required this.message,
    this.cause,
  });

  final Object? cause;
  final WifiScanErrorCode code;
  final String message;

  @override
  String toString() => 'WifiScanException($code): $message';
}

String _normalizeBssid(String value) => value.trim().toUpperCase();

String? _normalizeSsid(String? value) {
  final normalized = value?.trim();
  return normalized == null || normalized.isEmpty ? null : normalized;
}

final RegExp _bssidPattern = RegExp(r'^[0-9A-F]{2}(?::[0-9A-F]{2}){5}$');
