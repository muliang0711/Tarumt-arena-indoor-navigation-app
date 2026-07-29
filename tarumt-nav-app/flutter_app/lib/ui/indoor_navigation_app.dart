import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/orchestration/presence/realtime_presence_coordinator.dart';
import 'package:indoor_navigation/application/view_models/app_shell_view_model.dart';
import 'package:indoor_navigation/application/view_models/floor_rooms_view_model.dart';
import 'package:indoor_navigation/application/view_models/floor_selection_view_model.dart';
import 'package:indoor_navigation/application/view_models/home_view_model.dart';
import 'package:indoor_navigation/application/view_models/indoor_navigation_view_model.dart';
import 'package:indoor_navigation/application/view_models/live_map_view_model.dart';
import 'package:indoor_navigation/application/view_models/wifi_diagnostics_view_model.dart';
import 'package:indoor_navigation/application/view_models/wifi_positioning_test_lab_view_model.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/ui/app_shell/app_shell_screen.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

final class IndoorNavigationApp extends StatefulWidget {
  const IndoorNavigationApp({
    required this.viewModel,
    required this.liveMapViewModel,
    this.disposeFloorSelectionViewModel = true,
    this.disposeFloorRoomsViewModel = true,
    this.disposeViewModel = true,
    this.disposeLiveMapViewModel = true,
    this.disposePresenceCoordinator = true,
    this.disposeShellViewModel = true,
    this.disposeWifiTestLabViewModel = true,
    this.disposeWifiDiagnosticsViewModel = true,
    this.floorSelectionViewModel,
    this.floorRoomsViewModel,
    this.homeViewModel = const HomeViewModel(),
    this.initialNavigatePage = AppNavigatePage.selectFloor,
    this.initialSection = AppSection.home,
    this.presenceCoordinator,
    this.shellViewModel,
    this.showWifiDiagnostics = false,
    this.uiConfig = productionAppUiConfig,
    this.wifiTestLabViewModel,
    this.wifiDiagnosticsViewModel,
    super.key,
  });

  final bool disposeFloorSelectionViewModel;
  final bool disposeFloorRoomsViewModel;
  final bool disposeShellViewModel;
  final bool disposeViewModel;
  final bool disposeLiveMapViewModel;
  final bool disposePresenceCoordinator;
  final bool disposeWifiTestLabViewModel;
  final bool disposeWifiDiagnosticsViewModel;
  final FloorSelectionViewModel? floorSelectionViewModel;
  final FloorRoomsViewModel? floorRoomsViewModel;
  final HomeViewModel homeViewModel;
  final AppNavigatePage initialNavigatePage;
  final AppSection initialSection;
  final RealtimePresenceCoordinator? presenceCoordinator;
  final AppShellViewModel? shellViewModel;
  final bool showWifiDiagnostics;
  final AppUiConfig uiConfig;
  final IndoorNavigationViewModel viewModel;
  final LiveMapViewModel liveMapViewModel;
  final WifiPositioningTestLabViewModel? wifiTestLabViewModel;
  final WifiDiagnosticsViewModel? wifiDiagnosticsViewModel;

  @override
  State<IndoorNavigationApp> createState() => _IndoorNavigationAppState();
}

final class _IndoorNavigationAppState extends State<IndoorNavigationApp> {
  late final FloorSelectionViewModel _floorSelectionViewModel;
  late final FloorRoomsViewModel _floorRoomsViewModel;
  late final AppShellViewModel _shellViewModel;

  @override
  void initState() {
    super.initState();
    _floorRoomsViewModel = widget.floorRoomsViewModel ?? FloorRoomsViewModel();
    _floorSelectionViewModel =
        widget.floorSelectionViewModel ??
        FloorSelectionViewModel(
          initialState: FloorSelectionViewState(
            buildingName: _floorRoomsViewModel.state.buildingName,
            floors: _floorRoomsViewModel.state.floors,
            selectedFloorId: _floorRoomsViewModel.state.selectedFloorId,
          ),
        );
    _shellViewModel =
        widget.shellViewModel ??
        AppShellViewModel(
          initialNavigatePage: widget.initialNavigatePage,
          initialSection: widget.initialSection,
        );
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: createIndoorNavigationTheme(),
      home: AppShellScreen(
        disposeFloorSelectionViewModel: widget.disposeFloorSelectionViewModel,
        disposeFloorRoomsViewModel: widget.disposeFloorRoomsViewModel,
        disposeIndoorNavigationViewModel: widget.disposeViewModel,
        disposeLiveMapViewModel: widget.disposeLiveMapViewModel,
        disposePresenceCoordinator: widget.disposePresenceCoordinator,
        disposeShellViewModel: widget.disposeShellViewModel,
        disposeWifiTestLabViewModel: widget.disposeWifiTestLabViewModel,
        disposeWifiDiagnosticsViewModel: widget.disposeWifiDiagnosticsViewModel,
        floorSelectionViewModel: _floorSelectionViewModel,
        floorRoomsViewModel: _floorRoomsViewModel,
        homeViewModel: widget.homeViewModel,
        indoorNavigationViewModel: widget.viewModel,
        liveMapViewModel: widget.liveMapViewModel,
        presenceCoordinator: widget.presenceCoordinator,
        shellViewModel: _shellViewModel,
        showWifiDiagnostics: widget.showWifiDiagnostics,
        uiConfig: widget.uiConfig,
        wifiTestLabViewModel: widget.wifiTestLabViewModel,
        wifiDiagnosticsViewModel: widget.wifiDiagnosticsViewModel,
      ),
    );
  }
}
