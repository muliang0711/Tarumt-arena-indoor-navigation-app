import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/sensors/sensor_models.dart';
import 'package:indoor_navigation/application/ports/wifi/manual_wifi_scan_controller.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_api.dart';
import 'package:indoor_navigation/application/view_models/app_shell_view_model.dart';
import 'package:indoor_navigation/application/view_models/floor_rooms_view_model.dart';
import 'package:indoor_navigation/application/view_models/indoor_navigation_view_model.dart';
import 'package:indoor_navigation/application/view_models/view_model_models.dart';
import 'package:indoor_navigation/application/view_models/wifi_positioning_test_lab_view_model.dart';
import 'package:indoor_navigation/domain/campus/campus_catalog_parser.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_node_mapping.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_validation_catalog.dart';
import 'package:indoor_navigation/infrastructure/wifi/manual_wifi_scan_manager.dart';
import 'package:indoor_navigation/ui/app/app.dart';
import 'package:indoor_navigation/ui/app_shell/app_bottom_navigation.dart';
import 'package:indoor_navigation/ui/floor_rooms/floor_rooms_screen.dart';
import 'package:indoor_navigation/ui/floor_selection/floor_selection_screen.dart';
import 'package:indoor_navigation/ui/indoor_navigation_app.dart';
import 'package:indoor_navigation/ui/map/actor/user_presence_marker.dart';
import 'package:indoor_navigation/ui/map/actor/user_view_cone.dart';
import 'package:indoor_navigation/ui/map/effects/route_endpoint_effects.dart';
import 'package:indoor_navigation/ui/navigation/navigation_arrival_dialog.dart';
import 'package:indoor_navigation/ui/navigation/navigation_destination_card.dart';
import 'package:indoor_navigation/ui/navigation/wifi_positioning_map_test_overlay.dart';
import 'package:indoor_navigation/ui/navigation_input/navigation_input.dart';
import 'package:indoor_navigation/ui/saved_places/saved_places_screen.dart';

import '../../support/fakes/fakes.dart';

void main() {
  late String edgesJson;
  late String mapJson;
  late String nodesJson;
  late String roomsJson;

  setUpAll(() {
    mapJson = File('assets/maps/demo_1.tmj.json').readAsStringSync();
    edgesJson = File('assets/maps/demo_1.edges.json').readAsStringSync();
    nodesJson = File('assets/maps/demo_1.nodes.json').readAsStringSync();
    roomsJson = File('assets/campus/main_campus.rooms.json').readAsStringSync();
  });

  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized()
        .handleAppLifecycleStateChanged(AppLifecycleState.resumed);
  });

  testWidgets('starts on Home and exposes all four app sections', (
    tester,
  ) async {
    final harness = _createHarness(mapJson: mapJson, edgesJson: edgesJson);
    await tester.pumpWidget(
      IndoorNavigationApp(
        floorRoomsViewModel: harness.floorRoomsViewModel,
        shellViewModel: harness.shellViewModel,
        viewModel: harness.navigationViewModel,
      ),
    );

    expect(
      find.byKey(const ValueKey<String>('app-section.home')),
      findsOneWidget,
    );
    for (final section in AppSection.values) {
      expect(
        find.byKey(AppBottomNavigationKeys.destination(section)),
        findsOneWidget,
      );
    }
    expect(
      harness.navigationViewModel.state.loadStatus,
      IndoorNavigationLoadStatus.idle,
    );

    await tester.tap(
      find.byKey(AppBottomNavigationKeys.destination(AppSection.saved)),
    );
    await tester.pump();

    expect(
      find.byKey(const ValueKey<String>('app-section.saved')),
      findsOneWidget,
    );
    expect(find.byKey(SavedPlacesScreenKeys.empty), findsOneWidget);
    expect(harness.shellViewModel.state.selectedSection, AppSection.saved);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('production Navigate screen keeps map debug UI hidden', (
    tester,
  ) async {
    final harness = _createHarness(mapJson: mapJson, edgesJson: edgesJson);
    harness.shellViewModel.openMap();
    await tester.pumpWidget(
      IndoorNavigationApp(
        floorRoomsViewModel: harness.floorRoomsViewModel,
        shellViewModel: harness.shellViewModel,
        viewModel: harness.navigationViewModel,
      ),
    );

    await tester.pump();

    expect(find.bySemanticsLabel('Indoor map'), findsOneWidget);
    expect(
      find.byKey(const ValueKey<String>('instruction-bar')),
      findsOneWidget,
    );
    expect(find.text('Tiled Map Phase 1'), findsNothing);
    expect(find.byType(SimulationControls), findsNothing);
    expect(find.byType(DerivedEstimatePanel), findsNothing);
    expect(
      find.byKey(const ValueKey<String>('edge-editor-panel')),
      findsNothing,
    );
    expect(find.byKey(NavigationDestinationCardKeys.card), findsNothing);
    expect(find.byType(RouteStartMarker), findsNothing);
    expect(find.byType(DestinationBeacon), findsNothing);
    expect(find.byKey(WifiPositioningMapTestOverlayKeys.open), findsNothing);
    expect(
      find.byKey(AppBottomNavigationKeys.destination(AppSection.navigate)),
      findsOneWidget,
    );

    await tester.tap(
      find.byKey(AppBottomNavigationKeys.destination(AppSection.home)),
    );
    await tester.pump();
    await tester.pump();

    expect(
      harness.navigationViewModel.state.lifecycleStatus,
      IndoorNavigationLifecycleStatus.paused,
    );

    await tester.pumpWidget(const SizedBox.shrink());
    for (var index = 0; index < 8; index += 1) {
      await tester.pump();
    }
  });

  testWidgets('Navigate opens Select Floor without initializing the map', (
    tester,
  ) async {
    final harness = _createHarness(mapJson: mapJson, edgesJson: edgesJson);
    await tester.pumpWidget(
      IndoorNavigationApp(
        floorRoomsViewModel: harness.floorRoomsViewModel,
        shellViewModel: harness.shellViewModel,
        viewModel: harness.navigationViewModel,
      ),
    );

    await tester.tap(
      find.byKey(AppBottomNavigationKeys.destination(AppSection.navigate)),
    );
    await tester.pump();

    expect(find.byKey(FloorSelectionScreenKeys.screen), findsOneWidget);
    expect(
      harness.navigationViewModel.state.loadStatus,
      IndoorNavigationLoadStatus.idle,
    );
    expect(
      harness.shellViewModel.state.navigatePage,
      AppNavigatePage.selectFloor,
    );

    await tester.tap(find.byKey(FloorSelectionScreenKeys.back));
    await tester.pump();
    expect(
      find.byKey(const ValueKey<String>('app-section.home')),
      findsOneWidget,
    );

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('flows from selected floor to rooms and the clean map', (
    tester,
  ) async {
    final harness = _createHarness(mapJson: mapJson, edgesJson: edgesJson);
    await tester.pumpWidget(
      IndoorNavigationApp(
        floorRoomsViewModel: harness.floorRoomsViewModel,
        shellViewModel: harness.shellViewModel,
        viewModel: harness.navigationViewModel,
      ),
    );

    await tester.tap(
      find.byKey(AppBottomNavigationKeys.destination(AppSection.navigate)),
    );
    await tester.pump();
    await tester.scrollUntilVisible(
      find.byKey(FloorSelectionScreenKeys.floor('floor-3')),
      300,
      scrollable: find.descendant(
        of: find.byKey(FloorSelectionScreenKeys.screen),
        matching: find.byType(Scrollable),
      ),
    );
    await tester.drag(
      find.byKey(FloorSelectionScreenKeys.screen),
      const Offset(0, -160),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(FloorSelectionScreenKeys.floor('floor-3')));
    await tester.pump();

    expect(find.byKey(FloorRoomsScreenKeys.screen), findsOneWidget);
    expect(
      harness.shellViewModel.state.navigatePage,
      AppNavigatePage.floorRooms,
    );
    expect(harness.floorRoomsViewModel.state.selectedFloor.id, 'floor-3');

    await tester.ensureVisible(
      find.byKey(FloorRoomsScreenKeys.navigate('computer-lab-c301')),
    );
    await tester.tap(
      find.byKey(FloorRoomsScreenKeys.navigate('computer-lab-c301')),
    );
    await tester.pump();
    await tester.pump();

    expect(find.bySemanticsLabel('Indoor map'), findsOneWidget);
    expect(harness.shellViewModel.state.navigatePage, AppNavigatePage.map);
    expect(
      harness.floorRoomsViewModel.state.selectedRoom?.id,
      'computer-lab-c301',
    );
    expect(find.byKey(NavigationDestinationCardKeys.card), findsOneWidget);
    expect(find.text('Computer Lab'), findsOneWidget);
    expect(find.text('Third Floor · C301'), findsOneWidget);
    expect(find.text('Preview · 46 m'), findsOneWidget);

    await tester.tap(find.byKey(NavigationDestinationCardKeys.change));
    await tester.pump();
    await tester.pump();
    expect(find.byKey(FloorRoomsScreenKeys.screen), findsOneWidget);
    expect(
      harness.shellViewModel.state.navigatePage,
      AppNavigatePage.floorRooms,
    );
    expect(
      harness.navigationViewModel.state.lifecycleStatus,
      IndoorNavigationLifecycleStatus.paused,
    );

    await tester.pumpWidget(const SizedBox.shrink());
    for (var index = 0; index < 8; index += 1) {
      await tester.pump();
    }
  });

  testWidgets('opens a saved room on its floor and the clean map', (
    tester,
  ) async {
    final harness = _createHarness(mapJson: mapJson, edgesJson: edgesJson);
    harness.floorRoomsViewModel.toggleSavedRoom('gym-g201');
    await tester.pumpWidget(
      IndoorNavigationApp(
        floorRoomsViewModel: harness.floorRoomsViewModel,
        shellViewModel: harness.shellViewModel,
        viewModel: harness.navigationViewModel,
      ),
    );

    await tester.tap(
      find.byKey(AppBottomNavigationKeys.destination(AppSection.saved)),
    );
    await tester.pump();
    expect(find.byKey(SavedPlacesScreenKeys.screen), findsOneWidget);
    expect(find.text('Gym'), findsOneWidget);
    await tester.tap(find.byKey(SavedPlacesScreenKeys.navigate('gym-g201')));
    await tester.pump();
    await tester.pump();

    expect(find.bySemanticsLabel('Indoor map'), findsOneWidget);
    expect(harness.floorRoomsViewModel.state.selectedFloor.id, 'floor-2');
    expect(harness.floorRoomsViewModel.state.selectedRoom?.id, 'gym-g201');
    expect(find.text('Gym'), findsOneWidget);
    expect(find.text('Second Floor · G201'), findsOneWidget);
    expect(find.byKey(NavigationDestinationCardKeys.card), findsOneWidget);

    await tester.tap(
      find.byKey(AppBottomNavigationKeys.destination(AppSection.saved)),
    );
    await tester.pump();
    await tester.pump();
    expect(find.byKey(SavedPlacesScreenKeys.screen), findsOneWidget);
    expect(
      harness.navigationViewModel.state.lifecycleStatus,
      IndoorNavigationLifecycleStatus.paused,
    );

    await tester.pumpWidget(const SizedBox.shrink());
    for (var index = 0; index < 8; index += 1) {
      await tester.pump();
    }
  });

  testWidgets('production room starts its route, Bob, cone, and real sensors', (
    tester,
  ) async {
    final catalog = parseCampusCatalogBundle(
      edgeDocumentJson: edgesJson,
      nodeCatalogJson: nodesJson,
      roomCatalogJson: roomsJson,
    );
    final floorRoomsViewModel = FloorRoomsViewModel(
      initialState: createFloorRoomsViewState(catalog),
    )..selectRoom('TA257');
    final harness = _createHarness(
      edgesJson: edgesJson,
      floorRoomsViewModel: floorRoomsViewModel,
      mapJson: mapJson,
    );
    harness.shellViewModel.openMap();
    await tester.pumpWidget(
      IndoorNavigationApp(
        floorRoomsViewModel: harness.floorRoomsViewModel,
        shellViewModel: harness.shellViewModel,
        viewModel: harness.navigationViewModel,
      ),
    );
    for (var index = 0; index < 5; index += 1) {
      await tester.pump();
    }

    expect(
      harness.navigationViewModel.state.bootstrap!.mapModel.routePath.map(
        (node) => node.nodeId,
      ),
      ['node-21', 'node-20'],
    );
    expect(
      harness.navigationViewModel.state.bootstrap!.routeMetrics.totalMeters,
      3,
    );
    expect(
      harness.navigationViewModel.state.rawMotion!.status.wireValue,
      'running',
    );
    expect(find.text('Preview · 3 m'), findsOneWidget);
    expect(find.byType(UserPresenceMarker), findsOneWidget);
    expect(find.byType(RouteStartMarker), findsOneWidget);
    expect(find.byType(DestinationBeacon), findsOneWidget);
    expect(find.byType(UserViewCone), findsNothing);
    expect(find.byType(SimulationControls), findsNothing);
    expect(find.byType(DerivedEstimatePanel), findsNothing);

    harness.sensor.emit(
      HeadingSensorEvent(
        headingDegrees: 90,
        receivedAtMs: 1000,
        source: SensorHeadingSource.magnetometer,
      ),
    );
    await tester.pump();
    await tester.pump();
    expect(find.byType(UserViewCone), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    for (var index = 0; index < 8; index += 1) {
      await tester.pump();
    }
  });

  testWidgets('arrival ends navigation and returns to Home on confirmation', (
    tester,
  ) async {
    final catalog = parseCampusCatalogBundle(
      edgeDocumentJson: edgesJson,
      nodeCatalogJson: nodesJson,
      roomCatalogJson: roomsJson,
    );
    final floorRoomsViewModel = FloorRoomsViewModel(
      initialState: createFloorRoomsViewState(catalog),
    )..selectRoom('TA257');
    final harness = _createHarness(
      edgesJson: edgesJson,
      floorRoomsViewModel: floorRoomsViewModel,
      mapJson: mapJson,
    );
    final wifiClock = FakeClock(initialNowMs: 1000);
    final wifiManager = ManualWifiScanManager(clock: wifiClock)
      ..replaceReadings(<ManualWifiAccessPointReading>[
        ManualWifiAccessPointReading(bssid: 'AA:BB:CC:DD:EE:FF', rssi: -55),
      ]);
    final wifiTestLabViewModel = WifiPositioningTestLabViewModel(
      api: _StaticNodeApi(),
      clock: wifiClock,
      mappingRegistry: WifiNodeMappingRegistry(
        floorId: 'floor-2',
        mappings: const {'node-1': 'node-1'},
        unmappedServerNodes: const {},
      ),
      scanController: wifiManager,
      validationCatalog: WifiValidationCatalog(<WifiValidationSample>[
        WifiValidationSample(
          locationId: 'node-1',
          orientation: 'unknown',
          readings: const <WifiValidationAccessPoint>[
            WifiValidationAccessPoint(
              bssid: 'AA:BB:CC:DD:EE:FF',
              frequencyMhz: 2412,
              rssi: -55,
            ),
          ],
          scanId: 1,
          sessionId: 'test-session',
          timestampMs: 1000,
        ),
      ]),
    );
    harness.shellViewModel.openMap();
    await tester.pumpWidget(
      IndoorNavigationApp(
        floorRoomsViewModel: harness.floorRoomsViewModel,
        shellViewModel: harness.shellViewModel,
        viewModel: harness.navigationViewModel,
        wifiTestLabViewModel: wifiTestLabViewModel,
      ),
    );
    for (var index = 0; index < 5; index += 1) {
      await tester.pump();
    }

    harness.navigationViewModel.stepSimulationForward();
    harness.navigationViewModel.stepSimulationForward();
    for (var index = 0; index < 4; index += 1) {
      await tester.pump();
    }

    expect(find.byKey(NavigationArrivalDialogKeys.overlay), findsOneWidget);
    expect(find.text('Destination Reached'), findsOneWidget);
    expect(find.text('You have arrived at TA257.'), findsOneWidget);
    expect(
      find.descendant(
        of: find.byKey(NavigationArrivalDialogKeys.card),
        matching: find.text('Second Floor · TA257'),
      ),
      findsOneWidget,
    );
    expect(
      harness.navigationViewModel.state.navigationSessionStatus,
      NavigationSessionStatus.arrived,
    );
    expect(
      harness.navigationViewModel.state.rawMotion!.status.wireValue,
      'stopped',
    );
    expect(harness.navigationViewModel.state.wrongWay!.isRunning, isFalse);

    await tester.tap(find.byKey(NavigationArrivalDialogKeys.confirm));
    for (var index = 0; index < 4; index += 1) {
      await tester.pump();
    }

    expect(
      find.byKey(const ValueKey<String>('app-section.home')),
      findsOneWidget,
    );
    expect(find.byKey(NavigationArrivalDialogKeys.overlay), findsNothing);
    expect(harness.floorRoomsViewModel.state.selectedRoom, isNull);
    expect(
      harness.navigationViewModel.state.navigationSessionStatus,
      NavigationSessionStatus.completed,
    );
    expect(wifiManager.readings, isEmpty);
    expect(wifiTestLabViewModel.state.phase, WifiPositioningTestLabPhase.idle);

    await tester.pumpWidget(const SizedBox.shrink());
    for (var index = 0; index < 8; index += 1) {
      await tester.pump();
    }
  });
}

_AppShellHarness _createHarness({
  required String edgesJson,
  FloorRoomsViewModel? floorRoomsViewModel,
  required String mapJson,
}) {
  final clock = FakeClock(initialNowMs: 1000);
  final repository = FakeMapAssetRepository()
    ..enqueueTiledMapJson(
      assetPath: 'assets/maps/demo_1.tmj.json',
      json: mapJson,
    )
    ..enqueueRouteGraphEdgesJson(
      assetPath: 'assets/maps/demo_1.edges.json',
      json: edgesJson,
    );
  final sensor = FakeSensorDeviceManager();
  return _AppShellHarness(
    floorRoomsViewModel: floorRoomsViewModel ?? FloorRoomsViewModel(),
    navigationViewModel: IndoorNavigationViewModel(
      clock: clock,
      edgeDocumentExporter: FakeEdgeDocumentExporter(),
      mapAssetRepository: repository,
      periodicScheduler: FakePeriodicScheduler(clock: clock),
      sensorDebugSink: FakeSensorDebugSink(),
      sensorDeviceManager: sensor,
    ),
    sensor: sensor,
    shellViewModel: AppShellViewModel(),
  );
}

final class _AppShellHarness {
  const _AppShellHarness({
    required this.floorRoomsViewModel,
    required this.navigationViewModel,
    required this.sensor,
    required this.shellViewModel,
  });

  final FloorRoomsViewModel floorRoomsViewModel;
  final IndoorNavigationViewModel navigationViewModel;
  final FakeSensorDeviceManager sensor;
  final AppShellViewModel shellViewModel;
}

final class _StaticNodeApi implements WifiPositioningApi {
  @override
  Future<WifiPositioningResponse> findClosestNode(
    WifiPositioningRequest request,
  ) async => WifiPositioningResponse(serverNodeId: 'node-1');
}
