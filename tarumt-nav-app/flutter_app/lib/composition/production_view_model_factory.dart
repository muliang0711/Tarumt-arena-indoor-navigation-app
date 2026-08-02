import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:indoor_navigation/application/orchestration/journey/journey_lifecycle_coordinator.dart';
import 'package:indoor_navigation/application/orchestration/presence/realtime_presence_coordinator.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_engine.dart';
import 'package:indoor_navigation/application/ports/assets/campus_catalog_repository.dart';
import 'package:indoor_navigation/application/ports/journey/journey_lifecycle_gateway.dart';
import 'package:indoor_navigation/application/ports/logging/wifi_diagnostic_log.dart';
import 'package:indoor_navigation/application/ports/maps/map_bundle_repository.dart';
import 'package:indoor_navigation/application/ports/maps/map_runtime_resource_repository.dart';
import 'package:indoor_navigation/application/ports/presence/user_profile_store.dart';
import 'package:indoor_navigation/application/ports/sensors/sensor_device_manager.dart';
import 'package:indoor_navigation/application/ports/time/clock.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_node_mapping_repository.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_source.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_manager.dart';
import 'package:indoor_navigation/application/view_models/floor_rooms_view_model.dart';
import 'package:indoor_navigation/application/view_models/home_view_model.dart';
import 'package:indoor_navigation/application/view_models/indoor_navigation_view_model.dart';
import 'package:indoor_navigation/application/view_models/live_map_view_model.dart';
import 'package:indoor_navigation/application/view_models/wifi_positioning_test_lab_view_model.dart';
import 'package:indoor_navigation/domain/campus/campus_catalog.dart';
import 'package:indoor_navigation/domain/map_graph/map_graph.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_node_mapping_parser.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_validation_catalog_parser.dart';
import 'package:indoor_navigation/infrastructure/infrastructure.dart';
import 'package:indoor_navigation/infrastructure/journey/shared_preferences_journey_outbox_store.dart';
import 'package:indoor_navigation/infrastructure/presence/identity/secure_random_installation_id_generator.dart';
import 'package:path_provider/path_provider.dart';

const defaultWifiNodeMappingAssetPath =
    'assets/positioning/floor-2.wifi-node-mapping.json';
const defaultWifiValidationCatalogAssetPath =
    'assets/positioning/wifiscans-15Jul2026.validation.json';
const wifiPositioningSourceEnvironmentKey = 'WIFI_POSITIONING_SOURCE';
const configuredWifiPositioningSource = String.fromEnvironment(
  wifiPositioningSourceEnvironmentKey,
  defaultValue: 'auto',
);

const presenceModeEnvironmentKey = 'PRESENCE_MODE';
const presenceBaseUrlEnvironmentKey = 'PRESENCE_BASE_URL';
const hybridRemoteRepresentativeLimitEnvironmentKey =
    'PRESENCE_REMOTE_VISIBLE_LIMIT';
const configuredPresenceMode = String.fromEnvironment(
  presenceModeEnvironmentKey,
  defaultValue: 'mock',
);
const configuredPresenceBaseUrl = String.fromEnvironment(
  presenceBaseUrlEnvironmentKey,
  defaultValue: 'http://127.0.0.1:8080',
);
const configuredHybridRemoteRepresentativeLimit = String.fromEnvironment(
  hybridRemoteRepresentativeLimitEnvironmentKey,
  defaultValue: '1',
);

enum PresenceMode { mock, realtime, hybrid, off }

final class ProductionPresenceDependencies {
  const ProductionPresenceDependencies({
    required this.coordinator,
    required this.liveMapViewModel,
  });

  final RealtimePresenceCoordinator coordinator;
  final LiveMapViewModel liveMapViewModel;
}

final class ProductionMapResources {
  const ProductionMapResources({
    required this.bundleRevision,
    required this.campusCatalogRepository,
    required this.mapRuntimeRepository,
    required this.wifiNodeMappingRepository,
  });

  final String? bundleRevision;
  final CampusCatalogRepository campusCatalogRepository;
  final MapRuntimeResourceRepository mapRuntimeRepository;
  final WifiNodeMappingRepository wifiNodeMappingRepository;
}

Future<MapBundleRepository> createProductionMapBundleRepository({
  Uri? baseUrl,
  Directory? cacheRoot,
  MapBundleHttpTransport? transport,
}) async {
  final resolvedBaseUrl = baseUrl ?? resolveConfiguredPresenceBaseUrl();
  if (kReleaseMode && resolvedBaseUrl.scheme != 'https') {
    throw StateError('Remote map delivery requires HTTPS in release builds.');
  }
  return RemoteMapBundleRepository(
    baseUrl: resolvedBaseUrl,
    cacheRoot: cacheRoot ?? await getApplicationSupportDirectory(),
    transport: transport ?? DartIoMapBundleHttpTransport(),
  );
}

Future<ProductionMapResources> resolveProductionMapResources({
  MapBundleRepository? bundleRepository,
}) async {
  final repository =
      bundleRepository ?? await createProductionMapBundleRepository();
  try {
    final bundle = await repository.resolveCurrent(mainCampusMapId);
    return ProductionMapResources(
      bundleRevision: bundle.bundleRevision,
      campusCatalogRepository: ResolvedMapCampusCatalogRepository(
        bundle,
        floorId: defaultMapFloorId,
      ),
      mapRuntimeRepository: ResolvedMapRuntimeResourceRepository(bundle),
      wifiNodeMappingRepository: ResolvedMapWifiNodeMappingRepository(
        bundle,
        floorId: defaultMapFloorId,
      ),
    );
  } on MapBundleUnavailableException {
    return ProductionMapResources(
      bundleRevision: null,
      campusCatalogRepository: const FlutterCampusCatalogRepository(),
      mapRuntimeRepository: FlutterMapAssetRepository(),
      wifiNodeMappingRepository: FlutterWifiNodeMappingRepository(),
    );
  }
}

IndoorNavigationViewModel createProductionIndoorNavigationViewModel({
  Clock clock = const SystemClock(),
  MapRuntimeResourceRepository? mapRuntimeRepository,
  ManualWifiScanManager? manualWifiScanManager,
  WifiNodeMappingRepository? wifiNodeMappingRepository,
  WifiDiagnosticLog wifiDiagnosticLog = const NoopWifiDiagnosticLog(),
  WifiPositioningSourceMode? wifiSourceMode,
}) {
  final resolvedSourceMode =
      wifiSourceMode ?? resolveConfiguredWifiPositioningSourceMode();
  return IndoorNavigationViewModel(
    clock: clock,
    edgeDocumentExporter: ShareEdgeDocumentExporter(),
    mapAssetRepository: mapRuntimeRepository ?? FlutterMapAssetRepository(),
    navigationEventSink: const DeveloperNavigationEventSink(),
    periodicScheduler: DartPeriodicScheduler(),
    sensorDebugSink: HttpSensorDebugSink.production(),
    sensorDeviceManager: createProductionSensorDeviceManager(clock: clock),
    wifiDiagnosticLog: wifiDiagnosticLog,
    wifiPositioningEngineFactory: createWifiPositioningEngineFactoryForSource(
      clock: clock,
      manualScanManager: manualWifiScanManager,
      sourceMode: resolvedSourceMode,
      wifiNodeMappingRepository: wifiNodeMappingRepository,
    ),
  );
}

LiveMapViewModel createProductionLiveMapViewModel({
  Clock clock = const SystemClock(),
  MapRuntimeResourceRepository? mapRuntimeRepository,
}) {
  return LiveMapViewModel(
    buildingId: 'main-campus',
    buildingName: mainCampusBuildingName,
    floors: mainCampusFloors,
    mapAssetRepository: mapRuntimeRepository ?? FlutterMapAssetRepository(),
    presenceRepository: MockPresenceRepository(
      clock: clock,
      scheduler: DartPeriodicScheduler(),
    ),
  );
}

ProductionPresenceDependencies createProductionPresenceDependencies({
  Clock clock = const SystemClock(),
  MapRuntimeResourceRepository? mapRuntimeRepository,
  PresenceMode? mode,
  Uri? baseUrl,
  int? hybridRemoteRepresentativeLimit,
  UserProfileStore? userProfileStore,
}) {
  final resolvedMode = mode ?? resolveConfiguredPresenceMode();
  final resolvedBaseUrl = baseUrl ?? resolveConfiguredPresenceBaseUrl();
  final resolvedHybridRemoteRepresentativeLimit =
      resolvedMode == PresenceMode.hybrid
      ? hybridRemoteRepresentativeLimit ??
            resolveConfiguredHybridRemoteRepresentativeLimit()
      : 1;
  if ((resolvedMode == PresenceMode.realtime ||
          resolvedMode == PresenceMode.hybrid) &&
      kReleaseMode &&
      resolvedBaseUrl.scheme != 'https') {
    throw StateError('Realtime presence requires HTTPS in release builds.');
  }
  RealtimePresenceRepository createRealtimeRepository() =>
      RealtimePresenceRepository(
        baseUrl: resolvedBaseUrl,
        identityStore: SharedPreferencesInstallationIdentityStore(),
        sessionApi: AnonymousSessionApi(baseUrl: resolvedBaseUrl),
        userProfileStore: userProfileStore,
      );
  final repository = switch (resolvedMode) {
    PresenceMode.mock => MockPresenceRepository(
      clock: clock,
      scheduler: DartPeriodicScheduler(),
    ),
    PresenceMode.realtime => createRealtimeRepository(),
    PresenceMode.hybrid => HybridPresenceRepository(
      localRepository: MockPresenceRepository(
        clock: clock,
        representativeLimit: 1,
        scheduler: DartPeriodicScheduler(),
      ),
      remoteRepresentativeLimit: resolvedHybridRemoteRepresentativeLimit,
      remoteRepository: createRealtimeRepository(),
    ),
    PresenceMode.off => const DisabledPresenceRepository(),
  };
  final journeyCoordinator = repository is JourneyLifecycleGateway
      ? JourneyLifecycleCoordinator(
          clock: clock,
          gateway: repository as JourneyLifecycleGateway,
          idGenerator: SecureRandomInstallationIdGenerator().generate,
          mapId: mainCampusMapId,
          mapRevision: mainCampusMapRevision,
          outboxStore: SharedPreferencesJourneyOutboxStore(),
        )
      : null;
  return ProductionPresenceDependencies(
    coordinator: RealtimePresenceCoordinator(
      buildingId: 'main-campus',
      clock: clock,
      journeyCoordinator: journeyCoordinator,
      repository: repository,
    ),
    liveMapViewModel: LiveMapViewModel(
      buildingId: 'main-campus',
      buildingName: mainCampusBuildingName,
      disposePresenceRepository: false,
      floors: mainCampusFloors,
      mapAssetRepository: mapRuntimeRepository ?? FlutterMapAssetRepository(),
      presenceRepository: repository,
    ),
  );
}

PresenceMode resolveConfiguredPresenceMode({
  String configuredValue = configuredPresenceMode,
}) => switch (configuredValue.trim().toLowerCase()) {
  'mock' || '' => PresenceMode.mock,
  'realtime' => PresenceMode.realtime,
  'hybrid' => PresenceMode.hybrid,
  'off' => PresenceMode.off,
  final invalid => throw ArgumentError.value(
    invalid,
    presenceModeEnvironmentKey,
    'must be mock, realtime, hybrid, or off',
  ),
};

int resolveConfiguredHybridRemoteRepresentativeLimit({
  String configuredValue = configuredHybridRemoteRepresentativeLimit,
}) {
  final value = int.tryParse(configuredValue.trim());
  if (value == null || value < 1 || value >= maxPresenceRepresentatives) {
    throw ArgumentError.value(
      configuredValue,
      hybridRemoteRepresentativeLimitEnvironmentKey,
      'must be an integer from 1 to ${maxPresenceRepresentatives - 1}',
    );
  }
  return value;
}

Uri resolveConfiguredPresenceBaseUrl({
  String configuredValue = configuredPresenceBaseUrl,
}) {
  final value = configuredValue.trim();
  try {
    final uri = Uri.parse(value);
    // Accessing port also validates an explicitly supplied port value.
    uri.port;
    if ((uri.scheme != 'http' && uri.scheme != 'https') || uri.host.isEmpty) {
      throw const FormatException('expected an absolute HTTP or HTTPS URL');
    }
    if (uri.hasQuery || uri.hasFragment || uri.userInfo.isNotEmpty) {
      throw const FormatException(
        'query, fragment, and user information are not supported',
      );
    }
    return uri;
  } on FormatException catch (error) {
    throw ArgumentError.value(
      configuredValue,
      presenceBaseUrlEnvironmentKey,
      'must be a valid absolute HTTP or HTTPS URL (${error.message})',
    );
  }
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

bool shouldShowNativeWifiDiagnostics({
  required bool configured,
  TargetPlatform? platform,
  required WifiPositioningSourceMode sourceMode,
}) {
  return configured &&
      (platform ?? defaultTargetPlatform) == TargetPlatform.android &&
      sourceMode == WifiPositioningSourceMode.native;
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
  WifiNodeMappingRepository? wifiNodeMappingRepository,
}) {
  final scanManager = createWifiScanManagerForSource(
    clock: clock,
    manualScanManager: manualScanManager,
    platform: platform,
    sourceMode: sourceMode,
  );
  if (scanManager == null) return null;
  return () => createProductionWifiPositioningEngine(
    filterNativeReadings: sourceMode == WifiPositioningSourceMode.native,
    platform: platform,
    scanManager: scanManager,
    wifiNodeMappingRepository: wifiNodeMappingRepository,
  );
}

Future<WifiPositioningEngine> createProductionWifiPositioningEngine({
  bool? filterNativeReadings,
  TargetPlatform? platform,
  WifiScanManager? scanManager,
  WifiNodeMappingRepository? wifiNodeMappingRepository,
}) async {
  final resolvedPlatform = platform ?? defaultTargetPlatform;
  final shouldFilterNativeReadings =
      filterNativeReadings ?? resolvedPlatform == TargetPlatform.android;
  final mappingRepository =
      wifiNodeMappingRepository ?? FlutterWifiNodeMappingRepository();
  final mappingSource = await mappingRepository.loadMappingJson(
    defaultWifiNodeMappingAssetPath,
  );
  final readingPolicy = shouldFilterNativeReadings
      ? await _loadCampusWifiReadingPolicy()
      : const WifiPositioningReadingPolicy.unfiltered();
  return WifiPositioningEngine(
    api: HttpWifiPositioningApi.production(),
    mappingRegistry: parseWifiNodeMappingRegistryJson(mappingSource),
    readingPolicy: readingPolicy,
    scanManager:
        scanManager ??
        createProductionWifiScanManager(platform: resolvedPlatform),
  );
}

Future<WifiPositioningReadingPolicy> _loadCampusWifiReadingPolicy() async {
  final source = await FlutterWifiValidationCatalogRepository()
      .loadValidationCatalogJson(defaultWifiValidationCatalogAssetPath);
  final catalog = parseWifiValidationCatalogJson(source);
  return WifiPositioningReadingPolicy.campus(
    trainedBssids: catalog.samples.expand(
      (sample) => sample.readings.map((reading) => reading.bssid),
    ),
  );
}

Future<WifiPositioningTestLabViewModel>
createProductionWifiPositioningTestLabViewModel({
  required Clock clock,
  required ManualWifiScanManager manualWifiScanManager,
  WifiNodeMappingRepository? wifiNodeMappingRepository,
}) async {
  final mappingRepository =
      wifiNodeMappingRepository ?? FlutterWifiNodeMappingRepository();
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
createProductionCampusViewModels({
  CampusCatalogRepository? campusCatalogRepository,
}) async {
  final catalog =
      await (campusCatalogRepository ?? const FlutterCampusCatalogRepository())
          .loadCampusCatalog();
  return (
    floorRoomsViewModel: FloorRoomsViewModel(
      initialState: createFloorRoomsViewState(catalog),
    ),
    homeViewModel: HomeViewModel.fromCatalog(catalog),
  );
}
