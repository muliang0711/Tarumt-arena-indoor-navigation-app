import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';
import 'package:indoor_navigation/infrastructure/wifi/wifi_scan_channel_contract.dart';

abstract final class WifiScanChannelDecoder {
  static WifiScanAccessState decodeAccess(Object? raw) {
    final map = _wireMap(raw, 'access state');
    _expectKeys(map, const {
      'schemaVersion',
      'platformSupport',
      'permission',
      'wifiEnabled',
      'locationServicesEnabled',
    });
    _expectSchemaVersion(map);
    return WifiScanAccessState(
      locationServicesEnabled: _bool(map, 'locationServicesEnabled'),
      permission: switch (_string(map, 'permission')) {
        'notDetermined' => WifiScanPermissionStatus.notDetermined,
        'granted' => WifiScanPermissionStatus.granted,
        'denied' => WifiScanPermissionStatus.denied,
        'permanentlyDenied' => WifiScanPermissionStatus.permanentlyDenied,
        final value => throw FormatException(
          'Unknown Wi-Fi scan permission status: $value',
        ),
      },
      platformSupport: switch (_string(map, 'platformSupport')) {
        'supported' => WifiScanPlatformSupport.supported,
        'unsupported' => WifiScanPlatformSupport.unsupported,
        final value => throw FormatException(
          'Unknown Wi-Fi scan platform support: $value',
        ),
      },
      wifiEnabled: _bool(map, 'wifiEnabled'),
    );
  }

  static WifiScanBatch decodeBatch(Object? raw) {
    final map = _wireMap(raw, 'scan batch');
    _expectKeys(map, const {
      'schemaVersion',
      'startedAtMs',
      'completedAtMs',
      'readings',
    });
    _expectSchemaVersion(map);
    final readings = map['readings'];
    if (readings is! List<Object?>) {
      throw FormatException(
        'Wi-Fi scan readings must be a list, got ${readings.runtimeType}',
      );
    }
    return WifiScanBatch(
      completedAtMs: _int(map, 'completedAtMs'),
      readings: readings.map(_decodeReading).toList(growable: false),
      startedAtMs: _int(map, 'startedAtMs'),
    );
  }

  static void expectControlResponse(Object? raw) {
    final map = _wireMap(raw, 'dispose response');
    _expectKeys(map, const {'schemaVersion'});
    _expectSchemaVersion(map);
  }

  static WifiAccessPointReading _decodeReading(Object? raw) {
    final map = _wireMap(raw, 'access-point reading');
    _expectKeys(map, const {
      'bssid',
      'rssi',
      'observedAtMs',
      'frequencyMhz',
      'ssid',
    });
    return WifiAccessPointReading(
      bssid: _string(map, 'bssid'),
      frequencyMhz: _int(map, 'frequencyMhz'),
      observedAtMs: _int(map, 'observedAtMs'),
      rssi: _int(map, 'rssi'),
      ssid: _nullableString(map, 'ssid'),
    );
  }
}

Map<String, Object?> _wireMap(Object? raw, String label) {
  if (raw is! Map<Object?, Object?>) {
    throw FormatException(
      'Wi-Fi scan $label must be a map, got ${raw.runtimeType}',
    );
  }
  final result = <String, Object?>{};
  for (final entry in raw.entries) {
    if (entry.key case final String key) {
      result[key] = entry.value;
    } else {
      throw FormatException('Wi-Fi scan $label contains a non-string key');
    }
  }
  return result;
}

void _expectKeys(Map<String, Object?> map, Set<String> expected) {
  final actual = map.keys.toSet();
  if (actual.length != expected.length || !actual.containsAll(expected)) {
    throw FormatException(
      'Unexpected Wi-Fi scan fields: expected $expected, got $actual',
    );
  }
}

void _expectSchemaVersion(Map<String, Object?> map) {
  final value = _int(map, 'schemaVersion');
  if (value != WifiScanChannelContract.schemaVersion) {
    throw FormatException('Unsupported Wi-Fi scan schema version: $value');
  }
}

bool _bool(Map<String, Object?> map, String key) {
  final value = map[key];
  if (value is! bool) {
    throw FormatException('$key must be a bool, got ${value.runtimeType}');
  }
  return value;
}

int _int(Map<String, Object?> map, String key) {
  final value = map[key];
  if (value is! int) {
    throw FormatException('$key must be an int, got ${value.runtimeType}');
  }
  return value;
}

String _string(Map<String, Object?> map, String key) {
  final value = map[key];
  if (value is! String) {
    throw FormatException('$key must be a string, got ${value.runtimeType}');
  }
  return value;
}

String? _nullableString(Map<String, Object?> map, String key) {
  final value = map[key];
  if (value != null && value is! String) {
    throw FormatException('$key must be a string or null');
  }
  return value as String?;
}
