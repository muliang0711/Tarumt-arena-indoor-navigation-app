import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:indoor_navigation/application/ports/logging/wifi_diagnostic_log.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_source.dart';
import 'package:indoor_navigation/application/view_models/wifi_diagnostics_view_model.dart';
import 'package:indoor_navigation/composition/composition.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/infrastructure/debug/shared_preferences_wifi_diagnostic_log.dart';
import 'package:indoor_navigation/infrastructure/export/share_wifi_diagnostic_exporter.dart';
import 'package:indoor_navigation/infrastructure/time/system_clock.dart';
import 'package:indoor_navigation/infrastructure/wifi/manual_wifi_scan_manager.dart';
import 'package:indoor_navigation/ui/indoor_navigation_app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  const clock = SystemClock();
  final wifiSourceMode = resolveConfiguredWifiPositioningSourceMode();
  final showWifiDiagnostics = shouldShowNativeWifiDiagnostics(
    configured: wifiDebugPanelEnabled,
    sourceMode: wifiSourceMode,
  );
  final WifiDiagnosticLog wifiDiagnosticLog = showWifiDiagnostics
      ? await SharedPreferencesWifiDiagnosticLog.create(clock: clock)
      : const NoopWifiDiagnosticLog();
  WifiDiagnosticsViewModel? wifiDiagnosticsViewModel;
  if (showWifiDiagnostics) {
    wifiDiagnosticLog.record(
      category: 'runtime',
      event: 'app_started',
      details: <String, Object?>{
        'platform': defaultTargetPlatform.name,
        'releaseMode': kReleaseMode,
        'profileMode': kProfileMode,
        'wifiSourceMode': wifiSourceMode.name,
      },
    );
    wifiDiagnosticsViewModel = WifiDiagnosticsViewModel(
      clock: clock,
      exporter: ShareWifiDiagnosticExporter(),
      log: wifiDiagnosticLog,
    );
  }
  final manualWifiScanManager =
      wifiSourceMode == WifiPositioningSourceMode.manual
      ? ManualWifiScanManager(clock: clock)
      : null;
  final mapResources = await resolveProductionMapResources();
  final wifiTestLabViewModel = manualWifiScanManager == null
      ? null
      : await createProductionWifiPositioningTestLabViewModel(
          clock: clock,
          manualWifiScanManager: manualWifiScanManager,
          wifiNodeMappingRepository: mapResources.wifiNodeMappingRepository,
        );
  final campusViewModels = await createProductionCampusViewModels(
    campusCatalogRepository: mapResources.campusCatalogRepository,
  );
  final presenceDependencies = createProductionPresenceDependencies(
    mapRuntimeRepository: mapResources.mapRuntimeRepository,
  );
  runApp(
    IndoorNavigationApp(
      floorRoomsViewModel: campusViewModels.floorRoomsViewModel,
      homeViewModel: campusViewModels.homeViewModel,
      liveMapViewModel: presenceDependencies.liveMapViewModel,
      presenceCoordinator: presenceDependencies.coordinator,
      viewModel: createProductionIndoorNavigationViewModel(
        mapRuntimeRepository: mapResources.mapRuntimeRepository,
        manualWifiScanManager: manualWifiScanManager,
        wifiDiagnosticLog: wifiDiagnosticLog,
        wifiSourceMode: wifiSourceMode,
        wifiNodeMappingRepository: mapResources.wifiNodeMappingRepository,
      ),
      showWifiDiagnostics: showWifiDiagnostics,
      wifiDiagnosticsViewModel: wifiDiagnosticsViewModel,
      wifiTestLabViewModel: wifiTestLabViewModel,
    ),
  );
}
