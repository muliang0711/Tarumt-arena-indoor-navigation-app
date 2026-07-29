import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/maps/map_bundle_repository.dart';
import 'package:indoor_navigation/application/ports/maps/map_runtime_resource_repository.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_source.dart';
import 'package:indoor_navigation/composition/production_view_model_factory.dart';
import 'package:indoor_navigation/domain/map_bundle/map_bundle_manifest_parser.dart';
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

  test('selects mock, realtime, and disabled presence modes', () {
    expect(
      resolveConfiguredPresenceMode(configuredValue: ' MOCK '),
      PresenceMode.mock,
    );
    expect(
      resolveConfiguredPresenceMode(configuredValue: 'REALTIME'),
      PresenceMode.realtime,
    );
    expect(
      resolveConfiguredPresenceMode(configuredValue: 'hybrid'),
      PresenceMode.hybrid,
    );
    expect(
      resolveConfiguredPresenceMode(configuredValue: 'off'),
      PresenceMode.off,
    );
    expect(
      () => resolveConfiguredPresenceMode(configuredValue: 'redis'),
      throwsArgumentError,
    );
  });

  test('bounds the hybrid remote representative limit to nine', () {
    expect(resolveConfiguredHybridRemoteRepresentativeLimit(), 1);
    expect(
      resolveConfiguredHybridRemoteRepresentativeLimit(configuredValue: '9'),
      9,
    );
    expect(
      () => resolveConfiguredHybridRemoteRepresentativeLimit(
        configuredValue: '10',
      ),
      throwsArgumentError,
    );
    expect(
      () => resolveConfiguredHybridRemoteRepresentativeLimit(
        configuredValue: 'invalid',
      ),
      throwsArgumentError,
    );
  });

  test('trims and validates the presence gateway base URL', () {
    expect(
      resolveConfiguredPresenceBaseUrl(
        configuredValue: '  http://127.0.0.1:8080/  ',
      ),
      Uri.parse('http://127.0.0.1:8080/'),
    );
    expect(
      () => resolveConfiguredPresenceBaseUrl(
        configuredValue: 'http://127.0.0.1:8080~',
      ),
      throwsArgumentError,
    );
    expect(
      () => resolveConfiguredPresenceBaseUrl(
        configuredValue: 'redis://127.0.0.1:6379',
      ),
      throwsArgumentError,
    );
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

  test('shows removable native Wi-Fi diagnostics only on Android', () {
    expect(
      shouldShowNativeWifiDiagnostics(
        configured: true,
        platform: TargetPlatform.android,
        sourceMode: WifiPositioningSourceMode.native,
      ),
      isTrue,
    );
    expect(
      shouldShowNativeWifiDiagnostics(
        configured: false,
        platform: TargetPlatform.android,
        sourceMode: WifiPositioningSourceMode.native,
      ),
      isFalse,
    );
    expect(
      shouldShowNativeWifiDiagnostics(
        configured: true,
        platform: TargetPlatform.iOS,
        sourceMode: WifiPositioningSourceMode.native,
      ),
      isFalse,
    );
    expect(
      shouldShowNativeWifiDiagnostics(
        configured: true,
        platform: TargetPlatform.android,
        sourceMode: WifiPositioningSourceMode.manual,
      ),
      isFalse,
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
      expect(engine.readingPolicy.isFiltered, isFalse);
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

  test('enables the trained TARUMT reading policy for Android', () async {
    final manager = ManualWifiScanManager(clock: const SystemClock());
    final engine = await createProductionWifiPositioningEngine(
      platform: TargetPlatform.android,
      scanManager: manager,
    );

    expect(engine.readingPolicy.requiredSsidPrefix, 'TARUMT');
    expect(engine.readingPolicy.minimumReadingCount, 3);
    expect(engine.readingPolicy.trainedBssids, hasLength(162));
    await engine.dispose();
  });

  test(
    'pins every production map resource adapter to one remote revision',
    () async {
      final bundle = await _publishedBundle();
      final resources = await resolveProductionMapResources(
        bundleRepository: _FixedMapBundleRepository(bundle),
      );

      expect(resources.bundleRevision, bundle.bundleRevision);
      final runtime = await resources.mapRuntimeRepository.loadCurrent(
        floorId: 'floor-2',
        mapId: 'main-campus',
      );
      final catalog = await resources.campusCatalogRepository
          .loadCampusCatalog();
      final mapping = await resources.wifiNodeMappingRepository.loadMappingJson(
        'ignored',
      );
      expect(runtime.image.kind, MapImageLocationKind.localFile);
      expect(catalog.defaultFloorId, 'floor-2');
      expect(mapping, contains('"floorId": "floor-2"'));
    },
  );

  test(
    'falls back every production map adapter together when offline',
    () async {
      final resources = await resolveProductionMapResources(
        bundleRepository: const _OfflineMapBundleRepository(),
      );

      expect(resources.bundleRevision, isNull);
      final runtime = await resources.mapRuntimeRepository.loadCurrent(
        floorId: 'floor-2',
        mapId: 'main-campus',
      );
      final catalog = await resources.campusCatalogRepository
          .loadCampusCatalog();
      final mapping = await resources.wifiNodeMappingRepository.loadMappingJson(
        defaultWifiNodeMappingAssetPath,
      );
      expect(runtime.image.kind, MapImageLocationKind.bundledAsset);
      expect(catalog.defaultFloorId, 'floor-2');
      expect(mapping, contains('"floorId": "floor-2"'));
    },
  );
}

Future<ResolvedMapBundle> _publishedBundle() async {
  const revision =
      'sha256:a0554887cce7a1249f46d5d819fc851513f137128a4eba6446e54f84202f4493';
  final directory = Directory('../map-data/main-campus/revisions/$revision');
  final manifest = parseMapBundleManifest(
    await File('${directory.path}/manifest.json').readAsString(),
  );
  return ResolvedMapBundle(
    directoryPath: directory.path,
    localAssetPaths: <String, String>{
      for (final asset in manifest.assets)
        asset.assetId: '${directory.path}/${asset.path}',
    },
    manifest: manifest,
    source: MapBundleResolutionSource.downloaded,
  );
}

final class _FixedMapBundleRepository implements MapBundleRepository {
  const _FixedMapBundleRepository(this.bundle);

  final ResolvedMapBundle bundle;

  @override
  Future<ResolvedMapBundle> resolveCurrent(String mapId) async => bundle;
}

final class _OfflineMapBundleRepository implements MapBundleRepository {
  const _OfflineMapBundleRepository();

  @override
  Future<ResolvedMapBundle> resolveCurrent(String mapId) {
    throw const MapBundleUnavailableException('offline');
  }
}
