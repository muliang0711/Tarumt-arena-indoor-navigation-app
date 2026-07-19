import 'package:flutter/widgets.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_source.dart';
import 'package:indoor_navigation/composition/composition.dart';
import 'package:indoor_navigation/infrastructure/time/system_clock.dart';
import 'package:indoor_navigation/infrastructure/wifi/manual_wifi_scan_manager.dart';
import 'package:indoor_navigation/ui/indoor_navigation_app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  const clock = SystemClock();
  final wifiSourceMode = resolveConfiguredWifiPositioningSourceMode();
  final manualWifiScanManager =
      wifiSourceMode == WifiPositioningSourceMode.manual
      ? ManualWifiScanManager(clock: clock)
      : null;
  final wifiTestLabViewModel = manualWifiScanManager == null
      ? null
      : await createProductionWifiPositioningTestLabViewModel(
          clock: clock,
          manualWifiScanManager: manualWifiScanManager,
        );
  final campusViewModels = await createProductionCampusViewModels();
  runApp(
    IndoorNavigationApp(
      floorRoomsViewModel: campusViewModels.floorRoomsViewModel,
      homeViewModel: campusViewModels.homeViewModel,
      viewModel: createProductionIndoorNavigationViewModel(
        manualWifiScanManager: manualWifiScanManager,
        wifiSourceMode: wifiSourceMode,
      ),
      wifiTestLabViewModel: wifiTestLabViewModel,
    ),
  );
}
