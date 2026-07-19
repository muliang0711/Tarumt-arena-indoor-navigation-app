import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:indoor_navigation/application/view_models/app_shell_view_model.dart';
import 'package:indoor_navigation/application/view_models/floor_rooms_view_model.dart';
import 'package:indoor_navigation/application/view_models/floor_selection_view_model.dart';
import 'package:indoor_navigation/application/view_models/home_view_model.dart';
import 'package:indoor_navigation/application/view_models/indoor_navigation_view_model.dart';
import 'package:indoor_navigation/application/view_models/indoor_navigation_view_state.dart';
import 'package:indoor_navigation/application/view_models/view_model_models.dart';
import 'package:indoor_navigation/application/view_models/wifi_positioning_test_lab_view_model.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/ui/app_shell/app_bottom_navigation.dart';
import 'package:indoor_navigation/ui/floor_rooms/floor_rooms_screen.dart';
import 'package:indoor_navigation/ui/floor_selection/floor_selection_screen.dart';
import 'package:indoor_navigation/ui/home/home_screen.dart';
import 'package:indoor_navigation/ui/indoor_navigation_screen.dart';
import 'package:indoor_navigation/ui/navigation/navigation_arrival_dialog.dart';
import 'package:indoor_navigation/ui/navigation/wifi_positioning_map_test_overlay.dart';
import 'package:indoor_navigation/ui/saved_places/saved_places_screen.dart';
import 'package:indoor_navigation/ui/settings/settings_screen.dart';

final class AppShellScreen extends StatefulWidget {
  const AppShellScreen({
    required this.floorSelectionViewModel,
    required this.floorRoomsViewModel,
    required this.indoorNavigationViewModel,
    required this.shellViewModel,
    required this.uiConfig,
    required this.homeViewModel,
    this.disposeFloorSelectionViewModel = true,
    this.disposeFloorRoomsViewModel = true,
    this.disposeIndoorNavigationViewModel = true,
    this.disposeShellViewModel = true,
    this.disposeWifiTestLabViewModel = true,
    this.wifiTestLabViewModel,
    super.key,
  });

  final bool disposeFloorSelectionViewModel;
  final bool disposeFloorRoomsViewModel;
  final bool disposeIndoorNavigationViewModel;
  final bool disposeShellViewModel;
  final bool disposeWifiTestLabViewModel;
  final FloorSelectionViewModel floorSelectionViewModel;
  final FloorRoomsViewModel floorRoomsViewModel;
  final HomeViewModel homeViewModel;
  final IndoorNavigationViewModel indoorNavigationViewModel;
  final AppShellViewModel shellViewModel;
  final AppUiConfig uiConfig;
  final WifiPositioningTestLabViewModel? wifiTestLabViewModel;

  @override
  State<AppShellScreen> createState() => _AppShellScreenState();
}

final class _AppShellScreenState extends State<AppShellScreen> {
  late AppShellViewState _state;
  late final StreamSubscription<AppShellViewState> _subscription;
  late IndoorNavigationViewState _navigationState;
  late final StreamSubscription<IndoorNavigationViewState>
  _navigationSubscription;
  bool _isDisposing = false;
  bool _isCompletingArrival = false;
  bool _navigationRebuildScheduled = false;
  int? _announcedArrivalSessionId;

  @override
  void initState() {
    super.initState();
    _state = widget.shellViewModel.state;
    _navigationState = widget.indoorNavigationViewModel.state;
    _subscription = widget.shellViewModel.states.listen((state) {
      if (!_isDisposing && mounted) {
        setState(() => _state = state);
      }
    });
    _navigationSubscription = widget.indoorNavigationViewModel.states.listen((
      state,
    ) {
      if (_isDisposing || !mounted) {
        return;
      }
      final sessionId = state.navigationSessionId;
      final shouldAnnounce =
          state.navigationSessionStatus == NavigationSessionStatus.arrived &&
          sessionId != null &&
          sessionId != _announcedArrivalSessionId;
      _navigationState = state;
      _scheduleNavigationRebuild();
      if (shouldAnnounce) {
        _announcedArrivalSessionId = sessionId;
        unawaited(_announceArrival());
      }
    });
  }

  void _scheduleNavigationRebuild() {
    if (SchedulerBinding.instance.schedulerPhase !=
        SchedulerPhase.persistentCallbacks) {
      setState(() {});
      return;
    }
    if (_navigationRebuildScheduled) {
      return;
    }
    _navigationRebuildScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _navigationRebuildScheduled = false;
      if (!_isDisposing && mounted) {
        setState(() {});
      }
    });
  }

  Future<void> _announceArrival() async {
    try {
      await HapticFeedback.mediumImpact();
    } catch (_) {
      // Haptics are a best-effort arrival cue.
    }
  }

  void _selectSection(AppSection section) {
    if (section == AppSection.navigate) {
      _openNavigateRoot();
      return;
    }
    final previousSection = _state.selectedSection;
    if (previousSection == section) {
      return;
    }
    widget.shellViewModel.selectSection(section);
    if (previousSection == AppSection.navigate &&
        _state.navigatePage == AppNavigatePage.map &&
        widget.indoorNavigationViewModel.state.isReady) {
      unawaited(widget.indoorNavigationViewModel.pause());
    }
  }

  void _openNavigateRoot() {
    final wasShowingMap =
        _state.selectedSection == AppSection.navigate &&
        _state.navigatePage == AppNavigatePage.map;
    widget.shellViewModel.openNavigateRoot();
    if (wasShowingMap && widget.indoorNavigationViewModel.state.isReady) {
      unawaited(widget.indoorNavigationViewModel.pause());
    }
  }

  void _openFloorRooms() {
    final wasShowingMap =
        _state.selectedSection == AppSection.navigate &&
        _state.navigatePage == AppNavigatePage.map;
    widget.shellViewModel.openFloorRooms();
    if (wasShowingMap && widget.indoorNavigationViewModel.state.isReady) {
      unawaited(widget.indoorNavigationViewModel.pause());
    }
  }

  Widget _buildMapScreen() {
    final floorRoomsState = widget.floorRoomsViewModel.state;
    final destinationRoom = floorRoomsState.selectedRoom;
    final mapScreen = IndoorNavigationScreen(
      destinationFloor: destinationRoom == null
          ? null
          : floorRoomsState.selectedFloor,
      destinationRoom: destinationRoom,
      disposeViewModel: false,
      navigationStartNodeId: floorRoomsState.navigationStartNodeId,
      onChangeDestination: destinationRoom == null ? null : _openFloorRooms,
      uiConfig: widget.uiConfig,
      viewModel: widget.indoorNavigationViewModel,
    );
    final testLabViewModel = widget.wifiTestLabViewModel;
    if (testLabViewModel == null) return mapScreen;
    return WifiPositioningMapTestOverlay(
      onSampleReady: _requestImmediateWifiFix,
      viewModel: testLabViewModel,
      child: mapScreen,
    );
  }

  void _requestImmediateWifiFix() {
    if (widget.indoorNavigationViewModel.state.isReady) {
      widget.indoorNavigationViewModel.retryWifiPositioning();
    }
  }

  void _navigateToSavedRoom(CampusRoom room) {
    if (!room.navigationAvailable) {
      return;
    }
    widget.floorRoomsViewModel.selectFloor(room.floorId);
    widget.floorRoomsViewModel.selectRoom(room.id);
    widget.shellViewModel.openMap();
  }

  Future<void> _completeArrival() async {
    if (_isCompletingArrival || _isDisposing) {
      return;
    }
    _isCompletingArrival = true;
    try {
      await widget.indoorNavigationViewModel.completeArrivedNavigation();
      if (_isDisposing) {
        return;
      }
      widget.wifiTestLabViewModel?.resetSession();
      widget.floorRoomsViewModel.clearSelectedRoom();
      widget.shellViewModel.selectSection(AppSection.home);
    } finally {
      _isCompletingArrival = false;
    }
  }

  @override
  void dispose() {
    _isDisposing = true;
    unawaited(_disposeResources());
    super.dispose();
  }

  Future<void> _disposeResources() async {
    final ownedResourceDisposals = <Future<void>>[
      if (widget.disposeFloorSelectionViewModel)
        widget.floorSelectionViewModel.dispose(),
      if (widget.disposeFloorRoomsViewModel)
        widget.floorRoomsViewModel.dispose(),
      if (widget.disposeIndoorNavigationViewModel)
        widget.indoorNavigationViewModel.dispose(),
      if (widget.disposeShellViewModel) widget.shellViewModel.dispose(),
      if (widget.disposeWifiTestLabViewModel &&
          widget.wifiTestLabViewModel != null)
        widget.wifiTestLabViewModel!.dispose(),
    ];
    await _subscription.cancel();
    await _navigationSubscription.cancel();
    await Future.wait(ownedResourceDisposals);
  }

  @override
  Widget build(BuildContext context) {
    final room = widget.floorRoomsViewModel.state.selectedRoom;
    final showArrival =
        _state.selectedSection == AppSection.navigate &&
        _state.navigatePage == AppNavigatePage.map &&
        _navigationState.navigationSessionStatus ==
            NavigationSessionStatus.arrived &&
        room != null;
    final scaffold = Scaffold(
      body: switch (_state.selectedSection) {
        AppSection.home => HomeScreen(
          onOpenNavigate: () => _selectSection(AppSection.navigate),
          onOpenSaved: () => _selectSection(AppSection.saved),
          onOpenSettings: () => _selectSection(AppSection.settings),
          viewModel: widget.homeViewModel,
        ),
        AppSection.navigate => switch (_state.navigatePage) {
          AppNavigatePage.selectFloor => FloorSelectionScreen(
            onBack: () => _selectSection(AppSection.home),
            onFloorSelected: (floor) {
              widget.floorRoomsViewModel.selectFloor(floor.id);
              widget.shellViewModel.openFloorRooms();
            },
            viewModel: widget.floorSelectionViewModel,
          ),
          AppNavigatePage.floorRooms => FloorRoomsScreen(
            onBack: widget.shellViewModel.openNavigateRoot,
            onNavigate: (_) => widget.shellViewModel.openMap(),
            viewModel: widget.floorRoomsViewModel,
          ),
          AppNavigatePage.map => _buildMapScreen(),
        },
        AppSection.saved => SavedPlacesScreen(
          onBrowseRooms: widget.shellViewModel.openNavigateRoot,
          onNavigate: _navigateToSavedRoom,
          viewModel: widget.floorRoomsViewModel,
        ),
        AppSection.settings => SettingsScreen(
          wifiTestLabViewModel: widget.wifiTestLabViewModel,
        ),
      },
      bottomNavigationBar: AppBottomNavigation(
        onSectionSelected: _selectSection,
        selectedSection: _state.selectedSection,
      ),
    );
    return PopScope(
      canPop: !showArrival,
      child: Stack(
        fit: StackFit.expand,
        children: [
          scaffold,
          if (showArrival)
            Positioned.fill(
              child: NavigationArrivalDialog(
                floor: widget.floorRoomsViewModel.state.selectedFloor,
                onConfirm: _isCompletingArrival
                    ? null
                    : () => unawaited(_completeArrival()),
                room: room,
              ),
            ),
        ],
      ),
    );
  }
}
