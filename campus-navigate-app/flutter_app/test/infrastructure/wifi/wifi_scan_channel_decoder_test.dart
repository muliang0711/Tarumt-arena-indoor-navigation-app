import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';
import 'package:indoor_navigation/infrastructure/wifi/wifi_scan_channel_decoder.dart';

void main() {
  test('decodes every access state field', () {
    final state = WifiScanChannelDecoder.decodeAccess(<String, Object?>{
      'schemaVersion': 1,
      'platformSupport': 'supported',
      'permission': 'permanentlyDenied',
      'wifiEnabled': true,
      'locationServicesEnabled': false,
    });

    expect(state.platformSupport, WifiScanPlatformSupport.supported);
    expect(state.permission, WifiScanPermissionStatus.permanentlyDenied);
    expect(state.wifiEnabled, isTrue);
    expect(state.locationServicesEnabled, isFalse);
    expect(state.canScan, isFalse);
  });

  test('decodes a fresh scan batch with optional SSID', () {
    final batch = WifiScanChannelDecoder.decodeBatch(<String, Object?>{
      'schemaVersion': 1,
      'startedAtMs': 100,
      'completedAtMs': 200,
      'readings': <Object?>[
        <String, Object?>{
          'bssid': 'aa:bb:cc:dd:ee:ff',
          'rssi': -55,
          'observedAtMs': 150,
          'frequencyMhz': 2412,
          'ssid': null,
        },
      ],
    });

    expect(batch.startedAtMs, 100);
    expect(batch.completedAtMs, 200);
    expect(batch.readings.single.bssid, 'AA:BB:CC:DD:EE:FF');
    expect(batch.readings.single.rssi, -55);
    expect(batch.readings.single.ssid, isNull);
  });

  test('rejects unknown schema, enum values, and malformed readings', () {
    for (final raw in <Object?>[
      null,
      <String, Object?>{
        'schemaVersion': 2,
        'platformSupport': 'supported',
        'permission': 'granted',
        'wifiEnabled': true,
        'locationServicesEnabled': true,
      },
      <String, Object?>{
        'schemaVersion': 1,
        'platformSupport': 'sometimes',
        'permission': 'granted',
        'wifiEnabled': true,
        'locationServicesEnabled': true,
      },
      <String, Object?>{
        'schemaVersion': 1,
        'platformSupport': 'supported',
        'permission': 'approximate',
        'wifiEnabled': true,
        'locationServicesEnabled': true,
      },
    ]) {
      expect(
        () => WifiScanChannelDecoder.decodeAccess(raw),
        throwsFormatException,
      );
    }

    expect(
      () => WifiScanChannelDecoder.decodeBatch(<String, Object?>{
        'schemaVersion': 1,
        'startedAtMs': 100,
        'completedAtMs': 200,
        'readings': <Object?>[
          <String, Object?>{
            'bssid': 'bad',
            'rssi': -55,
            'observedAtMs': 150,
            'frequencyMhz': 2412,
            'ssid': null,
          },
        ],
      }),
      throwsArgumentError,
    );
  });

  test('requires exact fields for access, batch, and control responses', () {
    expect(
      () => WifiScanChannelDecoder.decodeAccess(<String, Object?>{
        'schemaVersion': 1,
        'platformSupport': 'supported',
        'permission': 'granted',
        'wifiEnabled': true,
        'locationServicesEnabled': true,
        'extra': true,
      }),
      throwsFormatException,
    );
    expect(
      () => WifiScanChannelDecoder.decodeBatch(<String, Object?>{
        'schemaVersion': 1,
        'startedAtMs': 1,
        'completedAtMs': 2,
        'readings': const <Object?>[],
        'extra': true,
      }),
      throwsFormatException,
    );
    expect(
      () => WifiScanChannelDecoder.expectControlResponse(<String, Object?>{
        'schemaVersion': 1,
      }),
      returnsNormally,
    );
  });
}
