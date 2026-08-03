import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:indoor_navigation/application/orchestration/navigation/route_traffic_resolver.dart';
import 'package:indoor_navigation/application/orchestration/presence/realtime_presence_coordinator.dart';
import 'package:indoor_navigation/application/view_models/app_shell_view_model.dart';
import 'package:indoor_navigation/application/view_models/floor_rooms_view_model.dart';
import 'package:indoor_navigation/application/view_models/floor_selection_view_model.dart';
import 'package:indoor_navigation/application/view_models/home_view_model.dart';
import 'package:indoor_navigation/application/view_models/indoor_navigation_view_model.dart';
import 'package:indoor_navigation/application/view_models/indoor_navigation_view_state.dart';
import 'package:indoor_navigation/application/view_models/live_map_view_model.dart';
import 'package:indoor_navigation/application/view_models/view_model_models.dart';
import 'package:indoor_navigation/application/view_models/wifi_diagnostics_view_model.dart';
import 'package:indoor_navigation/application/view_models/wifi_positioning_test_lab_view_model.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';
import 'package:indoor_navigation/ui/app_shell/app_bottom_navigation.dart';
import 'package:indoor_navigation/ui/floor_rooms/floor_rooms_screen.dart';
import 'package:indoor_navigation/ui/floor_selection/floor_selection_screen.dart';
import 'package:indoor_navigation/ui/home/home_screen.dart';
import 'package:indoor_navigation/ui/indoor_navigation_screen.dart';
import 'package:indoor_navigation/ui/live_map/live_map_screen.dart';
import 'package:indoor_navigation/ui/navigation/navigation_arrival_dialog.dart';
import 'package:indoor_navigation/ui/navigation/navigation_exit_bar.dart';
import 'package:indoor_navigation/ui/navigation/wifi_positioning_diagnostics_overlay.dart';
import 'package:indoor_navigation/ui/navigation/wifi_positioning_map_test_overlay.dart';
import 'package:indoor_navigation/ui/saved_places/saved_places_screen.dart';
import 'package:indoor_navigation/ui/search/destination_search_delegate.dart';
import 'package:indoor_navigation/ui/settings/settings_screen.dart';

final class AppShellScreen extends StatefulWidget {
  const AppShellScreen({
    required this.floorSelectionViewModel,
    required this.floorRoomsViewModel,
    required this.displayName,
    required this.indoorNavigationViewModel,
    required this.liveMapViewModel,
    this.presenceCoordinator,
    required this.shellViewModel,
    this.showWifiDiagnostics = false,
    required this.uiConfig,
    required this.homeViewModel,
    this.disposeFloorSelectionViewModel = true,
    this.disposeFloorRoomsViewModel = true,
    this.disposeIndoorNavigationViewModel = true,
    this.disposeLiveMapViewModel = true,
    this.disposePresenceCoordinator = true,
    this.disposeShellViewModel = true,
    this.disposeWifiTestLabViewModel = true,
    this.disposeWifiDiagnosticsViewModel = true,
    this.wifiTestLabViewModel,
    this.wifiDiagnosticsViewModel,
    super.key,
  });

  final bool disposeFloorSelectionViewModel;
  final bool disposeFloorRoomsViewModel;
  final bool disposeIndoorNavigationViewModel;
  final bool disposeLiveMapViewModel;
  final bool disposePresenceCoordinator;
  final bool disposeShellViewModel;
  final bool disposeWifiTestLabViewModel;
  final bool disposeWifiDiagnosticsViewModel;
  final FloorSelectionViewModel floorSelectionViewModel;
  final FloorRoomsViewModel floorRoomsViewModel;
  final String displayName;
  final HomeViewModel homeViewModel;
  final IndoorNavigationViewModel indoorNavigationViewModel;
  final LiveMapViewModel liveMapViewModel;
  final RealtimePresenceCoordinator? presenceCoordinator;
  final AppShellViewModel shellViewModel;
  final bool showWifiDiagnostics;
  final AppUiConfig uiConfig;
  final WifiPositioningTestLabViewModel? wifiTestLabViewModel;
  final WifiDiagnosticsViewModel? wifiDiagnosticsViewModel;

  @override
  State<AppShellScreen> createState() => _AppShellScreenState();
}

final class _AppShellScreenState extends State<AppShellScreen>
    with WidgetsBindingObserver {
  late AppShellViewState _state;
  late final StreamSubscription<AppShellViewState> _subscription;
  late IndoorNavigationViewState _navigationState;
  late final StreamSubscription<IndoorNavigationViewState>
  _navigationSubscription;
  StreamSubscription<PresenceSnapshot>? _trafficSubscription;
  PresenceSnapshot? _trafficSnapshot;
  bool _isDisposing = false;
  bool _isCompletingArrival = false;
  bool _isEndingNavigation = false;
  bool _isConfirmingNavigationExit = false;
  bool _navigationRebuildScheduled = false;
  _NavigationExitTarget? _pendingNavigationExit;
  int? _announcedArrivalSessionId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(widget.presenceCoordinator?.start());
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
      final presenceUpdate = widget.presenceCoordinator?.updateNavigation(
        floorId: widget.floorRoomsViewModel.state.selectedFloorId,
        state: state,
      );
      if (presenceUpdate != null) {
        unawaited(
          presenceUpdate.catchError((Object error, StackTrace stackTrace) {
            debugPrint('Realtime presence update failed: $error');
            debugPrintStack(stackTrace: stackTrace);
          }),
        );
      }
      _scheduleNavigationRebuild();
      if (shouldAnnounce) {
        _announcedArrivalSessionId = sessionId;
        unawaited(_announceArrival());
      }
    });
    _trafficSubscription = widget.presenceCoordinator?.trafficSnapshots.listen((
      snapshot,
    ) {
      if (!_isDisposing && mounted) {
        setState(() => _trafficSnapshot = snapshot);
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(widget.presenceCoordinator?.resume());
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.detached ||
        state == AppLifecycleState.hidden) {
      unawaited(widget.presenceCoordinator?.pause());
    }
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
    if (previousSection == AppSection.navigate &&
        _state.navigatePage == AppNavigatePage.map) {
      _requestNavigationExit(_NavigationExitTarget.section(section));
      return;
    }
    widget.shellViewModel.selectSection(section);
  }

  void _openNavigateRoot() {
    final wasShowingMap =
        _state.selectedSection == AppSection.navigate &&
        _state.navigatePage == AppNavigatePage.map;
    if (wasShowingMap) {
      _requestNavigationExit(const _NavigationExitTarget.selectFloor());
      return;
    }
    widget.shellViewModel.openNavigateRoot();
  }

  void _openFloorRooms() {
    final wasShowingMap =
        _state.selectedSection == AppSection.navigate &&
        _state.navigatePage == AppNavigatePage.map;
    if (wasShowingMap) {
      _requestNavigationExit(const _NavigationExitTarget.floorRooms());
      return;
    }
    widget.shellViewModel.openFloorRooms();
  }

  void _requestNavigationExit(_NavigationExitTarget target) {
    _pendingNavigationExit = target;
    if (_isEndingNavigation || _isConfirmingNavigationExit) return;
    unawaited(_confirmAndRunNavigationExit());
  }

  Future<void> _confirmAndRunNavigationExit() async {
    if (!mounted) return;
    final shouldConfirm =
        _navigationState.navigationSessionStatus ==
        NavigationSessionStatus.navigating;
    if (shouldConfirm) {
      _isConfirmingNavigationExit = true;
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Exit navigation?'),
          content: const Text(
            'Your current route will end, but you can start a new route at any time.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Continue navigating'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Exit navigation'),
            ),
          ],
        ),
      );
      _isConfirmingNavigationExit = false;
      if (!mounted) return;
      if (confirmed != true) {
        _pendingNavigationExit = null;
        return;
      }
    }
    await _runNavigationExit();
  }

  Future<void> _runNavigationExit() async {
    if (_isEndingNavigation) return;
    if (mounted) setState(() => _isEndingNavigation = true);
    final sessionId =
        widget.indoorNavigationViewModel.state.navigationSessionId;
    final presenceEnd = widget.presenceCoordinator?.endNavigationPresence(
      navigationSessionId: sessionId,
    );
    if (presenceEnd != null) {
      unawaited(
        presenceEnd.catchError((Object error, StackTrace stackTrace) {
          debugPrint('Remote navigation cleanup failed: $error');
          debugPrintStack(stackTrace: stackTrace);
        }),
      );
    }
    try {
      await widget.indoorNavigationViewModel.cancelNavigation().timeout(
        const Duration(seconds: 3),
      );
    } catch (error, stackTrace) {
      debugPrint('Navigation cleanup failed: $error');
      debugPrintStack(stackTrace: stackTrace);
    }

    if (!_isDisposing && mounted) {
      _resetWifiTestSession();
      widget.floorRoomsViewModel.resetNavigationDraft();
      final target = _pendingNavigationExit;
      _pendingNavigationExit = null;
      switch (target) {
        case _NavigationExitTarget(
          page: AppNavigatePage.floorRooms,
          section: AppSection.navigate,
        ):
          widget.shellViewModel.openFloorRooms();
        case _NavigationExitTarget(
          page: AppNavigatePage.selectFloor,
          section: AppSection.navigate,
        ):
          widget.shellViewModel.openNavigateRoot();
        case _NavigationExitTarget(:final section?):
          widget.shellViewModel.selectSection(section, resetNavigatePage: true);
        case null:
          break;
        default:
          throw StateError('Unsupported navigation exit target.');
      }
    }
    if (!_isDisposing && mounted) {
      setState(() => _isEndingNavigation = false);
    } else {
      _isEndingNavigation = false;
    }
  }

  Widget _buildMapScreen() {
    final floorRoomsState = widget.floorRoomsViewModel.state;
    final destinationRoom = floorRoomsState.selectedRoom;
    final trafficSnapshot = _trafficSnapshot;
    final edgeOccupancies =
        trafficSnapshot?.floorId == floorRoomsState.selectedFloorId
        ? trafficSnapshot!.edgeOccupancies
        : const <EdgeOccupancy>[];
    final routeTrafficBySegmentKey = const RouteTrafficResolver().resolve(
      segments: _navigationState.remainingPathSegments,
      occupancies: edgeOccupancies,
    );
    final mapScreen = IndoorNavigationScreen(
      displayName: widget.displayName,
      destinationFloor: destinationRoom == null
          ? null
          : floorRoomsState.selectedFloor,
      destinationRoom: destinationRoom,
      disposeViewModel: false,
      navigationStartNodeId: floorRoomsState.navigationStartNodeId,
      onChangeDestination: destinationRoom == null ? null : _openFloorRooms,
      routeTrafficBySegmentKey: routeTrafficBySegmentKey,
      uiConfig: widget.uiConfig,
      viewModel: widget.indoorNavigationViewModel,
    );
    Widget decoratedMap = mapScreen;
    if (widget.showWifiDiagnostics) {
      final diagnosticsViewModel = widget.wifiDiagnosticsViewModel;
      assert(
        diagnosticsViewModel != null,
        'Wi-Fi diagnostics require a diagnostics ViewModel.',
      );
      decoratedMap = WifiPositioningDiagnosticsOverlay(
        diagnosticsViewModel: diagnosticsViewModel!,
        onRetry: _requestImmediateWifiFix,
        state: _navigationState.wifiPositioning,
        child: decoratedMap,
      );
    }
    final testLabViewModel = widget.wifiTestLabViewModel;
    if (testLabViewModel != null) {
      decoratedMap = WifiPositioningMapTestOverlay(
        onSampleReady: _requestImmediateWifiFix,
        viewModel: testLabViewModel,
        child: decoratedMap,
      );
    }
    if (destinationRoom != null &&
        _navigationState.navigationSessionStatus !=
            NavigationSessionStatus.arrived) {
      decoratedMap = Stack(
        fit: StackFit.expand,
        children: [
          decoratedMap,
          Positioned(
            left: 16,
            right: 16,
            bottom: 16,
            child: SafeArea(
              top: false,
              child: NavigationExitBar(
                isEnding: _isEndingNavigation,
                onExit: () => _requestNavigationExit(
                  const _NavigationExitTarget.floorRooms(),
                ),
              ),
            ),
          ),
        ],
      );
    }
    return decoratedMap;
  }

  void _requestImmediateWifiFix() {
    if (widget.indoorNavigationViewModel.state.isReady) {
      widget.indoorNavigationViewModel.retryWifiPositioning();
    }
  }

  void _openMapWithFreshWifiTestSession() {
    _resetWifiTestSession();
    widget.shellViewModel.openMap();
  }

  void _resetWifiTestSession() {
    widget.wifiTestLabViewModel?.resetSession();
  }

  void _navigateToSavedRoom(CampusRoom room) {
    if (!room.navigationAvailable) {
      return;
    }
    widget.floorRoomsViewModel.selectFloor(room.floorId);
    widget.floorRoomsViewModel.selectRoom(room.id);
    _openMapWithFreshWifiTestSession();
  }

  Future<void> _openDestinationSearch() async {
    final floorRoomsState = widget.floorRoomsViewModel.state;
    final room = await showSearch<CampusRoom?>(
      context: context,
      delegate: DestinationSearchDelegate(
        floors: floorRoomsState.floors,
        rooms: floorRoomsState.rooms,
      ),
    );
    if (!mounted || room == null) return;
    widget.floorRoomsViewModel.selectFloor(room.floorId);
    widget.floorRoomsViewModel.selectRoom(room.id);
    _openMapWithFreshWifiTestSession();
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
    WidgetsBinding.instance.removeObserver(this);
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
      if (widget.disposeLiveMapViewModel) widget.liveMapViewModel.dispose(),
      if (widget.disposeShellViewModel) widget.shellViewModel.dispose(),
      if (widget.disposeWifiTestLabViewModel &&
          widget.wifiTestLabViewModel != null)
        widget.wifiTestLabViewModel!.dispose(),
      if (widget.disposeWifiDiagnosticsViewModel &&
          widget.wifiDiagnosticsViewModel != null)
        widget.wifiDiagnosticsViewModel!.dispose(),
      if (widget.disposePresenceCoordinator &&
          widget.presenceCoordinator != null)
        widget.presenceCoordinator!.dispose(),
    ];
    await _subscription.cancel();
    await _navigationSubscription.cancel();
    await _trafficSubscription?.cancel();
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
    final isNavigatingMap =
        _state.selectedSection == AppSection.navigate &&
        _state.navigatePage == AppNavigatePage.map &&
        _navigationState.navigationSessionStatus ==
            NavigationSessionStatus.navigating;
    final scaffold = Scaffold(
      body: switch (_state.selectedSection) {
        AppSection.home => HomeScreen(
          onOpenNavigate: () => _selectSection(AppSection.navigate),
          onSearchDestination: () => unawaited(_openDestinationSearch()),
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
            onNavigate: (_) => _openMapWithFreshWifiTestSession(),
            viewModel: widget.floorRoomsViewModel,
          ),
          AppNavigatePage.map => _buildMapScreen(),
        },
        AppSection.liveMap => LiveMapScreen(
          displayName: widget.displayName,
          viewModel: widget.liveMapViewModel,
        ),
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
      canPop: !showArrival && !isNavigatingMap,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && isNavigatingMap && !showArrival) {
          _requestNavigationExit(const _NavigationExitTarget.floorRooms());
        }
      },
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

final class _NavigationExitTarget {
  const _NavigationExitTarget.floorRooms()
    : page = AppNavigatePage.floorRooms,
      section = AppSection.navigate;

  const _NavigationExitTarget.selectFloor()
    : page = AppNavigatePage.selectFloor,
      section = AppSection.navigate;

  const _NavigationExitTarget.section(this.section)
    : page = AppNavigatePage.selectFloor;

  final AppNavigatePage page;
  final AppSection? section;
}
