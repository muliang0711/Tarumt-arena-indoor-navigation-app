import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_source.dart';
import 'package:indoor_navigation/composition/production_view_model_factory.dart';
import 'package:indoor_navigation/infrastructure/sensors/android_motion_sensor_device_manager.dart';
import 'package:indoor_navigation/infrastructure/sensors/core_motion_sensor_device_manager.dart';
import 'package:indoor_navigation/infrastructure/time/system_clock.dart';
import 'package:indoor_navigation/infrastructure/wifi/android_wifi_scan_manager.dart';
import 'package:indoor_navigation/infrastructure/wifi/manual_wifi_scan_manager.dart';
import 'package:indoor_navigation/infrastructure/wifi/unsupported_wifi_scan_manager.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('selects the native sensor access layer for each mobile platform', () {
    final android = createProductionSensorDeviceManager(
      clock: const SystemClock(),
      platform: TargetPlatform.android,
    );
    final ios = createProductionSensorDeviceManager(
      clock: const SystemClock(),
      platform: TargetPlatform.iOS,
    );

    expect(android, isA<AndroidMotionSensorDeviceManager>());
    expect(ios, isA<CoreMotionSensorDeviceManager>());
    expect(
      () => createProductionSensorDeviceManager(
        clock: const SystemClock(),
        platform: TargetPlatform.macOS,
      ),
      throwsUnsupportedError,
    );
  });

  test('enables Wi-Fi scanning only on Android', () {
    final android = createProductionWifiScanManager(
      platform: TargetPlatform.android,
    );
    final ios = createProductionWifiScanManager(platform: TargetPlatform.iOS);

    expect(android, isA<AndroidWifiScanManager>());
    expect(ios, isA<UnsupportedWifiScanManager>());
  });

  test('selects native, manual, and off positioning sources', () {
    const clock = SystemClock();
    final manual = ManualWifiScanManager(clock: clock);

    expect(
      defaultWifiPositioningSourceMode(platform: TargetPlatform.android),
      WifiPositioningSourceMode.native,
    );
    expect(
      defaultWifiPositioningSourceMode(platform: TargetPlatform.iOS),
      WifiPositioningSourceMode.off,
    );
    expect(
      resolveConfiguredWifiPositioningSourceMode(configuredValue: 'manual'),
      WifiPositioningSourceMode.manual,
    );
    expect(
      resolveConfiguredWifiPositioningSourceMode(
        platform: TargetPlatform.android,
      ),
      WifiPositioningSourceMode.native,
    );
    expect(
      () => resolveConfiguredWifiPositioningSourceMode(
        configuredValue: 'invalid',
      ),
      throwsArgumentError,
    );
    expect(
      createWifiScanManagerForSource(
        clock: clock,
        platform: TargetPlatform.android,
        sourceMode: WifiPositioningSourceMode.native,
      ),
      isA<AndroidWifiScanManager>(),
    );
    expect(
      createWifiScanManagerForSource(
        clock: clock,
        manualScanManager: manual,
        platform: TargetPlatform.iOS,
        sourceMode: WifiPositioningSourceMode.manual,
      ),
      same(manual),
    );
    expect(
      createWifiPositioningEngineFactoryForSource(
        clock: clock,
        platform: TargetPlatform.iOS,
        sourceMode: WifiPositioningSourceMode.off,
      ),
      isNull,
    );
  });

  test(
    'assembles the shared positioning engine for manual iOS input',
    () async {
      const clock = SystemClock();
      final manual = ManualWifiScanManager(clock: clock);
      final factory = createWifiPositioningEngineFactoryForSource(
        clock: clock,
        manualScanManager: manual,
        platform: TargetPlatform.iOS,
        sourceMode: WifiPositioningSourceMode.manual,
      );

      final engine = await factory!();

      expect(engine.scanManager, same(manual));
      expect(engine.mappingRegistry.floorId, 'floor-2');
      expect(engine.mappingRegistry.mappings, hasLength(11));
      await engine.dispose();
    },
  );

  test('assembles the Test Lab with all mapped validation nodes', () async {
    const clock = SystemClock();
    final manager = ManualWifiScanManager(clock: clock);

    final viewModel = await createProductionWifiPositioningTestLabViewModel(
      clock: clock,
      manualWifiScanManager: manager,
    );

    expect(viewModel.validationCatalog.samples, hasLength(130));
    expect(viewModel.validationCatalog.samplesByLocation, hasLength(13));
    expect(viewModel.selectableNodeIds, <String>[
      'node-1',
      'node-2',
      'node-12',
      'node-13',
      'node-14',
      'node-15',
      'node-16',
      'node-17',
      'node-18',
      'node-19',
      'node-20',
    ]);
    await viewModel.dispose();
    await manager.dispose();
  });

  test('assembles positioning with the bundled validated mapping', () async {
    final engine = await createProductionWifiPositioningEngine(
      platform: TargetPlatform.iOS,
    );

    expect(engine.mappingRegistry.floorId, 'floor-2');
    expect(engine.mappingRegistry.mappings, hasLength(11));
    expect(engine.mappingRegistry.unmappedServerNodes, hasLength(2));
    expect(engine.scanManager, isA<UnsupportedWifiScanManager>());
    await engine.dispose();
  });
}
