import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';

void main() {
  test('access state is ready only when every Android requirement is met', () {
    const ready = WifiScanAccessState(
      locationServicesEnabled: true,
      permission: WifiScanPermissionStatus.granted,
      platformSupport: WifiScanPlatformSupport.supported,
      wifiEnabled: true,
    );

    expect(ready.canScan, isTrue);
    for (final blocked in <WifiScanAccessState>[
      const WifiScanAccessState(
        locationServicesEnabled: false,
        permission: WifiScanPermissionStatus.granted,
        platformSupport: WifiScanPlatformSupport.supported,
        wifiEnabled: true,
      ),
      const WifiScanAccessState(
        locationServicesEnabled: true,
        permission: WifiScanPermissionStatus.denied,
        platformSupport: WifiScanPlatformSupport.supported,
        wifiEnabled: true,
      ),
      const WifiScanAccessState(
        locationServicesEnabled: true,
        permission: WifiScanPermissionStatus.granted,
        platformSupport: WifiScanPlatformSupport.unsupported,
        wifiEnabled: true,
      ),
      const WifiScanAccessState(
        locationServicesEnabled: true,
        permission: WifiScanPermissionStatus.granted,
        platformSupport: WifiScanPlatformSupport.supported,
        wifiEnabled: false,
      ),
    ]) {
      expect(blocked.canScan, isFalse);
    }
  });

  test('reading normalizes identifiers while preserving positioning data', () {
    final reading = WifiAccessPointReading(
      bssid: ' aa:bb:cc:dd:ee:ff ',
      frequencyMhz: 5180,
      observedAtMs: 100,
      rssi: -61,
      ssid: ' Campus WiFi ',
    );

    expect(reading.bssid, 'AA:BB:CC:DD:EE:FF');
    expect(reading.rssi, -61);
    expect(reading.frequencyMhz, 5180);
    expect(reading.observedAtMs, 100);
    expect(reading.ssid, 'Campus WiFi');
  });

  test('rejects malformed readings and invalid batch chronology', () {
    expect(
      () => WifiAccessPointReading(
        bssid: 'bad',
        frequencyMhz: 2412,
        observedAtMs: 1,
        rssi: -50,
        ssid: null,
      ),
      throwsArgumentError,
    );
    expect(
      () =>
          WifiScanBatch(completedAtMs: 9, readings: const [], startedAtMs: 10),
      throwsArgumentError,
    );
  });

  test('batch owns an immutable snapshot of readings', () {
    final mutable = <WifiAccessPointReading>[];
    final batch = WifiScanBatch(
      completedAtMs: 2,
      readings: mutable,
      startedAtMs: 1,
    );
    mutable.add(
      WifiAccessPointReading(
        bssid: 'AA:BB:CC:DD:EE:FF',
        frequencyMhz: 2412,
        observedAtMs: 1,
        rssi: -50,
        ssid: null,
      ),
    );

    expect(batch.readings, isEmpty);
    expect(() => batch.readings.add(mutable.single), throwsUnsupportedError);
  });
}
