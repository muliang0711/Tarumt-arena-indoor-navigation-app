import 'dart:convert';

import 'package:indoor_navigation/domain/wifi_positioning/wifi_validation_catalog.dart';

WifiValidationCatalog parseWifiValidationCatalogJson(String source) {
  final decoded = jsonDecode(source);
  if (decoded is! List<Object?> || decoded.isEmpty) {
    throw const FormatException(
      'Wi-Fi validation catalog must be a non-empty array.',
    );
  }
  final samples = <WifiValidationSample>[];
  final sampleKeys = <String>{};
  for (var sampleIndex = 0; sampleIndex < decoded.length; sampleIndex++) {
    final path = '\$[$sampleIndex]';
    final sample = _map(decoded[sampleIndex], path);
    _expectKeys(sample, const {
      'timestamp',
      'location_id',
      'scan_id',
      'orientation',
      'session_id',
      'AP_list',
    }, path);
    final locationId = _string(sample['location_id'], '$path.location_id');
    final scanId = _integer(sample['scan_id'], '$path.scan_id');
    final sampleKey = '$locationId::$scanId';
    if (!sampleKeys.add(sampleKey)) {
      throw FormatException('Duplicate validation sample $sampleKey.');
    }
    final accessPoints = _list(sample['AP_list'], '$path.AP_list');
    if (accessPoints.isEmpty) {
      throw FormatException('$path.AP_list must not be empty.');
    }
    final readings = <WifiValidationAccessPoint>[];
    final bssids = <String>{};
    for (var apIndex = 0; apIndex < accessPoints.length; apIndex++) {
      final apPath = '$path.AP_list[$apIndex]';
      final ap = _map(accessPoints[apIndex], apPath);
      _expectKeys(ap, const {'bssid', 'rssi', 'channel'}, apPath);
      final bssid = _bssid(ap['bssid'], '$apPath.bssid');
      if (!bssids.add(bssid)) {
        throw FormatException('$apPath duplicates BSSID $bssid.');
      }
      final frequencyMhz = _integer(ap['channel'], '$apPath.channel');
      if (frequencyMhz <= 0) {
        throw FormatException('$apPath.channel must be positive.');
      }
      final rssi = _integer(ap['rssi'], '$apPath.rssi');
      if (rssi < -127 || rssi > 0) {
        throw FormatException('$apPath.rssi must be between -127 and 0.');
      }
      readings.add(
        WifiValidationAccessPoint(
          bssid: bssid,
          frequencyMhz: frequencyMhz,
          rssi: rssi,
        ),
      );
    }
    samples.add(
      WifiValidationSample(
        locationId: locationId,
        orientation: _string(sample['orientation'], '$path.orientation'),
        readings: readings,
        scanId: scanId,
        sessionId: _string(sample['session_id'], '$path.session_id'),
        timestampMs: _integer(sample['timestamp'], '$path.timestamp'),
      ),
    );
  }
  return WifiValidationCatalog(samples);
}

Map<String, Object?> _map(Object? value, String path) {
  if (value is Map<String, Object?>) return value;
  throw FormatException('$path must be an object.');
}

List<Object?> _list(Object? value, String path) {
  if (value is List<Object?>) return value;
  throw FormatException('$path must be an array.');
}

String _string(Object? value, String path) {
  if (value is String && value.trim().isNotEmpty) return value.trim();
  throw FormatException('$path must be a non-empty string.');
}

int _integer(Object? value, String path) {
  if (value is int) return value;
  throw FormatException('$path must be an integer.');
}

String _bssid(Object? value, String path) {
  final normalized = _string(value, path).toUpperCase();
  if (!RegExp(r'^[0-9A-F]{2}(?::[0-9A-F]{2}){5}$').hasMatch(normalized)) {
    throw FormatException('$path must be a MAC address.');
  }
  return normalized;
}

void _expectKeys(Map<String, Object?> map, Set<String> expected, String path) {
  final actual = map.keys.toSet();
  if (actual.length != expected.length || !actual.containsAll(expected)) {
    throw FormatException('$path expected fields $expected, got $actual.');
  }
}
