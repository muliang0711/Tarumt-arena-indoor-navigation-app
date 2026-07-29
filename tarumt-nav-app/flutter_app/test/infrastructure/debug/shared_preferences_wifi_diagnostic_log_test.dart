import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/infrastructure/debug/shared_preferences_wifi_diagnostic_log.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fakes/fake_clock.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  test(
    'persists a bounded event history and exports structured JSON',
    () async {
      final clock = FakeClock(initialNowMs: 1000);
      final log = await SharedPreferencesWifiDiagnosticLog.create(
        clock: clock,
        maxEvents: 2,
      );

      log.record(category: 'runtime', event: 'started');
      clock.advanceByMs(10);
      log.record(
        category: 'positioning',
        event: 'attempt_failed',
        details: const <String, Object?>{
          'readings': <Object?>[
            <String, Object?>{'bssid': 'AA:BB:CC:DD:EE:FF', 'rssi': -55},
          ],
        },
      );
      clock.advanceByMs(10);
      log.record(category: 'lifecycle', event: 'paused');
      await log.flush();

      expect(log.state.eventCount, 2);
      expect(log.state.lastEventAtMs, 1020);
      final document =
          jsonDecode(await log.exportJson()) as Map<String, Object?>;
      expect(document['schemaVersion'], 1);
      expect(document['kind'], 'wifi-positioning-diagnostics');
      expect(document['containsSensitiveWifiIdentifiers'], isTrue);
      expect(document['eventCount'], 2);
      final events = document['events'] as List<Object?>;
      expect(events.map((value) => (value as Map<String, Object?>)['event']), [
        'attempt_failed',
        'paused',
      ]);

      final restored = await SharedPreferencesWifiDiagnosticLog.create(
        clock: clock,
        maxEvents: 2,
      );
      expect(restored.state.eventCount, 2);
      expect(await restored.exportJson(), contains('AA:BB:CC:DD:EE:FF'));

      await restored.clear();
      expect(restored.state.eventCount, 0);
      final empty = await SharedPreferencesWifiDiagnosticLog.create(
        clock: clock,
      );
      expect(empty.state.eventCount, 0);
    },
  );

  test('ignores malformed persisted diagnostics', () async {
    SharedPreferences.setMockInitialValues(<String, Object>{
      'wifiPositioningDiagnostics.v1': '{not-json',
    });

    final log = await SharedPreferencesWifiDiagnosticLog.create(
      clock: FakeClock(),
    );

    expect(log.state.eventCount, 0);
  });
}
