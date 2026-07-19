import 'dart:convert';

import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_api.dart';

String encodeWifiPositioningRequest(WifiPositioningRequest request) {
  return jsonEncode(<String, Object?>{
    'timestamp': request.timestampMs,
    'readings': request.readings
        .map(
          (reading) => <String, Object?>{
            // The backend's trained access-point vocabulary uses lowercase
            // BSSIDs and currently performs a case-sensitive lookup.
            'bssid': reading.bssid.toLowerCase(),
            'rssi': reading.rssi,
            'timestamp': reading.observedAtMs,
            'frequency': reading.frequencyMhz,
            'ssid': reading.ssid,
          },
        )
        .toList(growable: false),
    'checkedNodeIds': request.checkedServerNodeIds,
  });
}

WifiPositioningResponse decodeWifiPositioningResponse(String source) {
  final decoded = jsonDecode(source);
  if (decoded is! Map<String, Object?>) {
    throw const FormatException('Positioning response must be an object.');
  }
  if (decoded.length != 1 || !decoded.containsKey('nodeId')) {
    throw FormatException(
      'Positioning response must contain only nodeId, got ${decoded.keys}.',
    );
  }
  final nodeId = decoded['nodeId'];
  if (nodeId is! String || nodeId.trim().isEmpty) {
    throw const FormatException(
      'Positioning nodeId must be a non-empty string.',
    );
  }
  return WifiPositioningResponse(serverNodeId: nodeId);
}
