import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_api.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';
import 'package:indoor_navigation/infrastructure/wifi_positioning/wifi_positioning_codec.dart';

void main() {
  test('encodes the exact live PositioningRequest schema', () {
    final request = WifiPositioningRequest(
      checkedServerNodeIds: const ['node-1', 'node-2'],
      readings: <WifiAccessPointReading>[
        WifiAccessPointReading(
          bssid: 'aa:bb:cc:dd:ee:ff',
          frequencyMhz: 5180,
          observedAtMs: 1_700_000_000_100,
          rssi: -61,
          ssid: 'Campus',
        ),
      ],
      timestampMs: 1_700_000_000_200,
    );

    expect(jsonDecode(encodeWifiPositioningRequest(request)), <String, Object?>{
      'timestamp': 1_700_000_000_200,
      'readings': <Object?>[
        <String, Object?>{
          'bssid': 'aa:bb:cc:dd:ee:ff',
          'rssi': -61,
          'timestamp': 1_700_000_000_100,
          'frequency': 5180,
          'ssid': 'Campus',
        },
      ],
      'checkedNodeIds': <Object?>['node-1', 'node-2'],
    });
  });

  test('decodes only the exact closest-node response', () {
    expect(
      decodeWifiPositioningResponse('{"nodeId":" node-12 "}').serverNodeId,
      'node-12',
    );
    for (final source in <String>[
      'null',
      '[]',
      '{}',
      '{"node":"node-12"}',
      '{"nodeId":""}',
      '{"nodeId":"node-12","extra":true}',
    ]) {
      expect(
        () => decodeWifiPositioningResponse(source),
        throwsFormatException,
      );
    }
  });

  test('request rejects empty readings and checked-node constraints', () {
    final reading = WifiAccessPointReading(
      bssid: 'AA:BB:CC:DD:EE:FF',
      frequencyMhz: 2412,
      observedAtMs: 1,
      rssi: -50,
      ssid: null,
    );
    expect(
      () => WifiPositioningRequest(
        checkedServerNodeIds: const [],
        readings: [reading],
        timestampMs: 2,
      ),
      throwsArgumentError,
    );
    expect(
      () => WifiPositioningRequest(
        checkedServerNodeIds: const ['node-1'],
        readings: const [],
        timestampMs: 2,
      ),
      throwsArgumentError,
    );
  });
}
