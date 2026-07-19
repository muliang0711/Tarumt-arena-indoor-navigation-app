import 'package:flutter/foundation.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_engine.dart';
import 'package:indoor_navigation/application/ports/sensors/sensor_device_manager.dart';
import 'package:indoor_navigation/application/ports/time/clock.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_source.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_manager.dart';
import 'package:indoor_navigation/application/view_models/floor_rooms_view_model.dart';
import 'package:indoor_navigation/application/view_models/home_view_model.dart';
import 'package:indoor_navigation/application/view_models/indoor_navigation_view_model.dart';
import 'package:indoor_navigation/application/view_models/wifi_positioning_test_lab_view_model.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_node_mapping_parser.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_validation_catalog_parser.dart';
import 'package:indoor_navigation/infrastructure/infrastructure.dart';

const defaultWifiNodeMappingAssetPath =
    'assets/positioning/floor-2.wifi-node-mapping.json';
const defaultWifiValidationCatalogAssetPath =
    'assets/positioning/wifiscans-15Jul2026.validation.json';
const wifiPositioningSourceEnvironmentKey = 'WIFI_POSITIONING_SOURCE';
const configuredWifiPositioningSource = String.fromEnvironment(
  wifiPositioningSourceEnvironmentKey,
  defaultValue: 'auto',
);

IndoorNavigationViewModel createProductionIndoorNavigationViewModel({
  Clock clock = const SystemClock(),
  ManualWifiScanManager? manualWifiScanManager,
  WifiPositioningSourceMode? wifiSourceMode,
}) {
  final resolvedSourceMode =
      wifiSourceMode ?? resolveConfiguredWifiPositioningSourceMode();
  return IndoorNavigationViewModel(
    clock: clock,
    edgeDocumentExporter: ShareEdgeDocumentExporter(),
    mapAssetRepository: FlutterMapAssetRepository(),
    navigationEventSink: const DeveloperNavigationEventSink(),
    periodicScheduler: DartPeriodicScheduler(),
    sensorDebugSink: HttpSensorDebugSink.production(),
    sensorDeviceManager: createProductionSensorDeviceManager(clock: clock),
    wifiPositioningEngineFactory: createWifiPositioningEngineFactoryForSource(
      clock: clock,
      manualScanManager: manualWifiScanManager,
      sourceMode: resolvedSourceMode,
    ),
  );
}

SensorDeviceManager createProductionSensorDeviceManager({
  required Clock clock,
  TargetPlatform? platform,
}) {
  return switch (platform ?? defaultTargetPlatform) {
    TargetPlatform.android => AndroidMotionSensorDeviceManager(clock: clock),
    TargetPlatform.iOS => CoreMotionSensorDeviceManager(clock: clock),
    final unsupported => throw UnsupportedError(
      'Indoor navigation sensors are unavailable on ${unsupported.name}.',
    ),
  };
}

WifiScanManager createProductionWifiScanManager({TargetPlatform? platform}) {
  final target = platform ?? defaultTargetPlatform;
  return switch (target) {
    TargetPlatform.android => AndroidWifiScanManager(),
    _ => UnsupportedWifiScanManager(platformName: target.name),
  };
}

WifiPositioningSourceMode defaultWifiPositioningSourceMode({
  TargetPlatform? platform,
}) => (platform ?? defaultTargetPlatform) == TargetPlatform.android
    ? WifiPositioningSourceMode.native
    : WifiPositioningSourceMode.off;

WifiPositioningSourceMode resolveConfiguredWifiPositioningSourceMode({
  String configuredValue = configuredWifiPositioningSource,
  TargetPlatform? platform,
}) {
  return switch (configuredValue.trim().toLowerCase()) {
    'auto' || '' => defaultWifiPositioningSourceMode(platform: platform),
    'native' => WifiPositioningSourceMode.native,
    'manual' => WifiPositioningSourceMode.manual,
    'off' => WifiPositioningSourceMode.off,
    final invalid => throw ArgumentError.value(
      invalid,
      wifiPositioningSourceEnvironmentKey,
      'must be auto, native, manual, or off',
    ),
  };
}

WifiScanManager? createWifiScanManagerForSource({
  required Clock clock,
  ManualWifiScanManager? manualScanManager,
  TargetPlatform? platform,
  required WifiPositioningSourceMode sourceMode,
}) {
  return switch (sourceMode) {
    WifiPositioningSourceMode.native => createProductionWifiScanManager(
      platform: platform,
    ),
    WifiPositioningSourceMode.manual =>
      manualScanManager ?? ManualWifiScanManager(clock: clock),
    WifiPositioningSourceMode.off => null,
  };
}

WifiPositioningEngineFactory? createWifiPositioningEngineFactoryForSource({
  required Clock clock,
  ManualWifiScanManager? manualScanManager,
  TargetPlatform? platform,
  required WifiPositioningSourceMode sourceMode,
}) {
  final scanManager = createWifiScanManagerForSource(
    clock: clock,
    manualScanManager: manualScanManager,
    platform: platform,
    sourceMode: sourceMode,
  );
  if (scanManager == null) return null;
  return () => createProductionWifiPositioningEngine(
    platform: platform,
    scanManager: scanManager,
  );
}

Future<WifiPositioningEngine> createProductionWifiPositioningEngine({
  TargetPlatform? platform,
  WifiScanManager? scanManager,
}) async {
  final repository = FlutterWifiNodeMappingRepository();
  final source = await repository.loadMappingJson(
    defaultWifiNodeMappingAssetPath,
  );
  return WifiPositioningEngine(
    api: HttpWifiPositioningApi.production(),
    mappingRegistry: parseWifiNodeMappingRegistryJson(source),
    scanManager:
        scanManager ?? createProductionWifiScanManager(platform: platform),
  );
}

Future<WifiPositioningTestLabViewModel>
createProductionWifiPositioningTestLabViewModel({
  required Clock clock,
  required ManualWifiScanManager manualWifiScanManager,
}) async {
  final mappingRepository = FlutterWifiNodeMappingRepository();
  final validationRepository = FlutterWifiValidationCatalogRepository();
  final sources = await Future.wait(<Future<String>>[
    mappingRepository.loadMappingJson(defaultWifiNodeMappingAssetPath),
    validationRepository.loadValidationCatalogJson(
      defaultWifiValidationCatalogAssetPath,
    ),
  ]);
  final mappingSource = sources[0];
  final validationSource = sources[1];
  return WifiPositioningTestLabViewModel(
    api: HttpWifiPositioningApi.production(),
    clock: clock,
    mappingRegistry: parseWifiNodeMappingRegistryJson(mappingSource),
    scanController: manualWifiScanManager,
    validationCatalog: parseWifiValidationCatalogJson(validationSource),
  );
}

Future<({FloorRoomsViewModel floorRoomsViewModel, HomeViewModel homeViewModel})>
createProductionCampusViewModels() async {
  final catalog = await const FlutterCampusCatalogRepository()
      .loadCampusCatalog();
  return (
    floorRoomsViewModel: FloorRoomsViewModel(
      initialState: createFloorRoomsViewState(catalog),
    ),
    homeViewModel: HomeViewModel.fromCatalog(catalog),
  );
}
