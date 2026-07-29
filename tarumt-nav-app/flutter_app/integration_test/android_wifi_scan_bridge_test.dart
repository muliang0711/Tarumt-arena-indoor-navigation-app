import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';
import 'package:indoor_navigation/infrastructure/wifi/android_wifi_scan_manager.dart';
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('reads Android Wi-Fi access state and completes a fresh scan', (
    tester,
  ) async {
    if (defaultTargetPlatform != TargetPlatform.android) return;

    final manager = AndroidWifiScanManager();
    addTearDown(manager.dispose);

    final access = await manager.checkAccess();
    expect(access.platformSupport, WifiScanPlatformSupport.supported);
    expect(
      access.permission,
      WifiScanPermissionStatus.granted,
      reason: 'Grant precise location permission before running this test.',
    );
    expect(access.wifiEnabled, isTrue);
    expect(access.locationServicesEnabled, isTrue);

    final batch = await manager.scan();
    expect(batch.completedAtMs, greaterThanOrEqualTo(batch.startedAtMs));
    for (final reading in batch.readings) {
      expect(reading.observedAtMs, lessThanOrEqualTo(batch.completedAtMs));
      expect(reading.frequencyMhz, greaterThan(0));
    }
  });
}
