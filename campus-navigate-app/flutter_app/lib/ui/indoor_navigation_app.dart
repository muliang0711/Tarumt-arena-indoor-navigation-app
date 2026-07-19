import 'package:flutter/material.dart';
import 'package:indoor_navigation/application/view_models/app_shell_view_model.dart';
import 'package:indoor_navigation/application/view_models/floor_rooms_view_model.dart';
import 'package:indoor_navigation/application/view_models/floor_selection_view_model.dart';
import 'package:indoor_navigation/application/view_models/home_view_model.dart';
import 'package:indoor_navigation/application/view_models/indoor_navigation_view_model.dart';
import 'package:indoor_navigation/application/view_models/wifi_positioning_test_lab_view_model.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/ui/app_shell/app_shell_screen.dart';
import 'package:indoor_navigation/ui/theme/indoor_navigation_theme.dart';

final class IndoorNavigationApp extends StatefulWidget {
  const IndoorNavigationApp({
    required this.viewModel,
    this.disposeFloorSelectionViewModel = true,
    this.disposeFloorRoomsViewModel = true,
    this.disposeViewModel = true,
    this.disposeShellViewModel = true,
    this.disposeWifiTestLabViewModel = true,
    this.floorSelectionViewModel,
    this.floorRoomsViewModel,
    this.homeViewModel = const HomeViewModel(),
    this.initialNavigatePage = AppNavigatePage.selectFloor,
    this.initialSection = AppSection.home,
    this.shellViewModel,
    this.uiConfig = productionAppUiConfig,
    this.wifiTestLabViewModel,
    super.key,
  });

  final bool disposeFloorSelectionViewModel;
  final bool disposeFloorRoomsViewModel;
  final bool disposeShellViewModel;
  final bool disposeViewModel;
  final bool disposeWifiTestLabViewModel;
  final FloorSelectionViewModel? floorSelectionViewModel;
  final FloorRoomsViewModel? floorRoomsViewModel;
  final HomeViewModel homeViewModel;
  final AppNavigatePage initialNavigatePage;
  final AppSection initialSection;
  final AppShellViewModel? shellViewModel;
  final AppUiConfig uiConfig;
  final IndoorNavigationViewModel viewModel;
  final WifiPositioningTestLabViewModel? wifiTestLabViewModel;

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
        disposeShellViewModel: widget.disposeShellViewModel,
        disposeWifiTestLabViewModel: widget.disposeWifiTestLabViewModel,
        floorSelectionViewModel: _floorSelectionViewModel,
        floorRoomsViewModel: _floorRoomsViewModel,
        homeViewModel: widget.homeViewModel,
        indoorNavigationViewModel: widget.viewModel,
        shellViewModel: _shellViewModel,
        uiConfig: widget.uiConfig,
        wifiTestLabViewModel: widget.wifiTestLabViewModel,
      ),
    );
  }
}
