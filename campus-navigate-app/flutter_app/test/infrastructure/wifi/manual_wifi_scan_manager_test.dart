import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/wifi/manual_wifi_scan_controller.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';
import 'package:indoor_navigation/infrastructure/wifi/manual_wifi_scan_manager.dart';

import '../../support/fakes/fake_clock.dart';

void main() {
  test(
    'reports hardware-free access and timestamps each scan freshly',
    () async {
      final clock = FakeClock(initialNowMs: 1000);
      final manager = ManualWifiScanManager(
        clock: clock,
        initialReadings: <ManualWifiAccessPointReading>[
          ManualWifiAccessPointReading(
            bssid: 'aa:bb:cc:dd:ee:ff',
            frequencyMhz: 5180,
            rssi: -55,
            ssid: ' Campus ',
          ),
        ],
      );

      expect((await manager.checkAccess()).canScan, isTrue);
      expect((await manager.requestPermission()).canScan, isTrue);
      final first = await manager.scan();
      expect(first.startedAtMs, 1000);
      expect(first.completedAtMs, 1000);
      expect(first.readings.single.bssid, 'AA:BB:CC:DD:EE:FF');
      expect(first.readings.single.frequencyMhz, 5180);
      expect(first.readings.single.observedAtMs, 1000);
      expect(first.readings.single.rssi, -55);
      expect(first.readings.single.ssid, 'Campus');

      clock.advanceByMs(5000);
      final second = await manager.scan();
      expect(second.readings.single.observedAtMs, 6000);
    },
  );

  test('replaces, clears, and defensively freezes manual readings', () async {
    final manager = ManualWifiScanManager(clock: FakeClock(initialNowMs: 1000));
    final input = <ManualWifiAccessPointReading>[
      ManualWifiAccessPointReading(bssid: 'AA:BB:CC:DD:EE:01', rssi: -60),
    ];

    manager.replaceReadings(input);
    input.clear();
    expect(manager.readings, hasLength(1));
    expect(() => manager.readings.clear(), throwsUnsupportedError);

    manager.clearReadings();
    expect((await manager.scan()).readings, isEmpty);
  });

  test('rejects malformed input and use after disposal', () async {
    expect(
      () => ManualWifiAccessPointReading(bssid: 'not-a-bssid', rssi: -55),
      throwsArgumentError,
    );
    final manager = ManualWifiScanManager(clock: FakeClock(initialNowMs: 1000));
    await manager.dispose();

    await expectLater(
      manager.scan(),
      throwsA(
        isA<WifiScanException>().having(
          (error) => error.code,
          'code',
          WifiScanErrorCode.disposed,
        ),
      ),
    );
    expect(
      () => manager.replaceReadings(const []),
      throwsA(isA<WifiScanException>()),
    );
  });
}
