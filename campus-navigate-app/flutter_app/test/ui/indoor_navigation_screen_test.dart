import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/assets/map_asset_repository.dart';
import 'package:indoor_navigation/application/view_models/app_shell_view_model.dart';
import 'package:indoor_navigation/application/view_models/indoor_navigation_view_model.dart';
import 'package:indoor_navigation/application/view_models/view_model_models.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/ui/indoor_navigation_app.dart';
import 'package:indoor_navigation/ui/map/widgets/map_route_node.dart';

import '../support/fakes/fakes.dart';

void main() {
  late String mapJson;
  late String edgesJson;

  setUpAll(() {
    mapJson = File('assets/maps/demo_1.tmj.json').readAsStringSync();
    edgesJson = File('assets/maps/demo_1.edges.json').readAsStringSync();
  });

  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized()
        .handleAppLifecycleStateChanged(AppLifecycleState.resumed);
  });

  testWidgets('renders loading then the ready application state', (
    tester,
  ) async {
    final repository = _ControlledMapAssetRepository();
    final harness = _createHarness(repository: repository);
    await tester.pumpWidget(_navigationApp(harness.viewModel));
    expect(
      find.byKey(const ValueKey<String>('indoor-navigation-loading')),
      findsOneWidget,
    );
    repository.map.complete(mapJson);
    await tester.pump();
    repository.edges.complete(edgesJson);
    await tester.pump();
    await tester.pump();

    expect(find.text('Tiled Map Phase 1'), findsOneWidget);
    expect(find.bySemanticsLabel('Indoor map'), findsOneWidget);
    expect(harness.viewModel.state.bootstrap!.routeMetrics.totalMeters, 46);

    await tester.pumpWidget(const SizedBox.shrink());
    for (var index = 0; index < 8; index += 1) {
      await tester.pump();
    }
    expect(
      harness.viewModel.state.lifecycleStatus,
      IndoorNavigationLifecycleStatus.disposed,
    );
  });

  testWidgets('renders a map error and retries the same ViewModel', (
    tester,
  ) async {
    final repository = FakeMapAssetRepository()
      ..enqueueTiledMapFailure(
        assetPath: 'assets/maps/demo_1.tmj.json',
        error: StateError('map unavailable'),
      )
      ..enqueueTiledMapJson(
        assetPath: 'assets/maps/demo_1.tmj.json',
        json: mapJson,
      )
      ..enqueueRouteGraphEdgesJson(
        assetPath: 'assets/maps/demo_1.edges.json',
        json: edgesJson,
      );
    final harness = _createHarness(repository: repository);
    await tester.pumpWidget(_navigationApp(harness.viewModel));
    await tester.pump();

    expect(find.text('Unable to load the indoor map'), findsOneWidget);
    expect(find.textContaining('map unavailable'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey<String>('retry-map-load')));
    await tester.pump();
    await tester.pump();

    expect(find.text('Tiled Map Phase 1'), findsOneWidget);
    expect(repository.invocations, hasLength(3));

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('forwards background and foreground lifecycle transitions', (
    tester,
  ) async {
    final harness = _createReadyHarness(mapJson: mapJson, edgesJson: edgesJson);
    await tester.pumpWidget(_navigationApp(harness.viewModel));
    await tester.pump();
    await tester.pump();
    await harness.viewModel.startRawMotion();
    harness.viewModel.startSimulation();
    expect(harness.scheduler.activeTaskCount, 3);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();
    await tester.pump();
    expect(
      harness.viewModel.state.lifecycleStatus,
      IndoorNavigationLifecycleStatus.paused,
    );
    expect(harness.scheduler.activeTaskCount, 0);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    await tester.pump();
    expect(
      harness.viewModel.state.lifecycleStatus,
      IndoorNavigationLifecycleStatus.active,
    );
    expect(harness.scheduler.activeTaskCount, 3);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('applies a background state that arrives during initialization', (
    tester,
  ) async {
    final repository = _ControlledMapAssetRepository();
    final harness = _createHarness(repository: repository);
    await tester.pumpWidget(_navigationApp(harness.viewModel));
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    repository.map.complete(mapJson);
    await tester.pump();
    repository.edges.complete(edgesJson);
    await tester.pump();
    await tester.pump();

    expect(harness.viewModel.state.isReady, isTrue);
    expect(
      harness.viewModel.state.lifecycleStatus,
      IndoorNavigationLifecycleStatus.paused,
    );
    expect(harness.scheduler.activeTaskCount, 0);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('wires navigation, simulation, zoom, and replay interactions', (
    tester,
  ) async {
    final harness = _createReadyHarness(mapJson: mapJson, edgesJson: edgesJson);
    await tester.pumpWidget(_navigationApp(harness.viewModel));
    await tester.pump();
    await tester.pump();

    final routeStatus = tester.widget<Text>(
      find.byKey(const ValueKey<String>('derived-estimate.route')),
    );
    expect(routeStatus.data, contains('46m route'));
    expect(routeStatus.data, contains('0.5m step'));
    expect(
      find.byKey(const ValueKey<String>('instruction-bar')),
      findsOneWidget,
    );
    expect(find.text('100%'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey<String>('zoom-controls.in')));
    await tester.pump();
    expect(find.text('125%'), findsOneWidget);

    final distanceBefore =
        harness.viewModel.state.navigation!.distanceRemainingPixels;
    await tester.tap(
      find.byKey(const ValueKey<String>('simulation-controls.step')),
    );
    await tester.pump();
    expect(
      harness.viewModel.state.navigation!.distanceRemainingPixels,
      lessThan(distanceBefore),
    );

    await tester.tap(
      find.byKey(const ValueKey<String>('derived-estimate.replay')),
    );
    await tester.pump();
    expect(harness.viewModel.state.derivedEstimate!.lastResult, isNotNull);
    expect(harness.viewModel.state.sensorRouteSnap, isNotNull);

    await tester.tap(
      find.byKey(const ValueKey<String>('simulation-controls.start')),
    );
    await tester.pump();
    expect(harness.viewModel.state.navigation!.status.wireValue, 'moving');

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('switches to the edge editor and selects a map node', (
    tester,
  ) async {
    final harness = _createReadyHarness(mapJson: mapJson, edgesJson: edgesJson);
    await tester.pumpWidget(_navigationApp(harness.viewModel));
    await tester.pump();
    await tester.pump();

    await tester.tap(find.byKey(const ValueKey<String>('app-header.edges')));
    await tester.pump();

    expect(
      find.byKey(const ValueKey<String>('edge-editor-panel')),
      findsOneWidget,
    );
    expect(find.byKey(const ValueKey<String>('instruction-bar')), findsNothing);
    expect(
      find.byKey(
        const ValueKey<String>('indoor-navigation-ready.navigation-controls'),
      ),
      findsNothing,
    );

    final map = find.byKey(
      const ValueKey<String>('indoor-navigation-ready.map'),
    );
    final verticalScroller = find
        .descendant(of: map, matching: find.byType(SingleChildScrollView))
        .first;
    await tester.drag(verticalScroller, const Offset(0, -760));
    await tester.pump();
    final node = find.byWidgetPredicate(
      (widget) => widget is MapRouteNode && widget.node.nodeId == 'node-20',
      description: 'the node-20 map route node',
    );
    expect(node, findsOneWidget);
    await tester.ensureVisible(node);
    await tester.pump();
    await tester.tap(node);
    await tester.pump();

    expect(harness.viewModel.state.edgeEditor!.selectedNodeIds, ['node-20']);
    expect(find.text('node-20 -> choose another node'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('keeps the production screen bounded in portrait and landscape', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    final harness = _createReadyHarness(mapJson: mapJson, edgesJson: edgesJson);

    tester.view.physicalSize = const Size(320, 568);
    await tester.pumpWidget(
      IndoorNavigationApp(
        disposeViewModel: false,
        initialNavigatePage: AppNavigatePage.map,
        initialSection: AppSection.navigate,
        uiConfig: developerAppUiConfig,
        viewModel: harness.viewModel,
      ),
    );
    await tester.pump();
    await tester.pump();
    expect(tester.takeException(), isNull);
    expect(find.text('Tiled Map Phase 1'), findsOneWidget);

    tester.view.physicalSize = const Size(568, 320);
    await tester.pump();
    expect(tester.takeException(), isNull);
    expect(
      find.byKey(
        const ValueKey<String>('indoor-navigation-ready.short-layout-sidebar'),
      ),
      findsOneWidget,
    );

    tester.view.physicalSize = const Size(844, 390);
    await tester.pump();
    expect(tester.takeException(), isNull);

    await tester.tap(find.byKey(const ValueKey<String>('app-header.edges')));
    await tester.pump();
    expect(tester.takeException(), isNull);
    expect(
      find.byKey(const ValueKey<String>('edge-editor-panel')),
      findsOneWidget,
    );

    await tester.pumpWidget(const SizedBox.shrink());
    for (var index = 0; index < 8; index += 1) {
      await tester.pump();
    }
  });
}

IndoorNavigationApp _navigationApp(IndoorNavigationViewModel viewModel) {
  return IndoorNavigationApp(
    initialNavigatePage: AppNavigatePage.map,
    initialSection: AppSection.navigate,
    uiConfig: developerAppUiConfig,
    viewModel: viewModel,
  );
}

_ScreenHarness _createReadyHarness({
  required String mapJson,
  required String edgesJson,
}) {
  final repository = FakeMapAssetRepository()
    ..enqueueTiledMapJson(
      assetPath: 'assets/maps/demo_1.tmj.json',
      json: mapJson,
    )
    ..enqueueRouteGraphEdgesJson(
      assetPath: 'assets/maps/demo_1.edges.json',
      json: edgesJson,
    );
  return _createHarness(repository: repository);
}

_ScreenHarness _createHarness({required MapAssetRepository repository}) {
  final clock = FakeClock(initialNowMs: 1000);
  final scheduler = FakePeriodicScheduler(clock: clock);
  final sensor = FakeSensorDeviceManager();
  final viewModel = IndoorNavigationViewModel(
    clock: clock,
    edgeDocumentExporter: FakeEdgeDocumentExporter(),
    mapAssetRepository: repository,
    periodicScheduler: scheduler,
    sensorDebugSink: FakeSensorDebugSink(),
    sensorDeviceManager: sensor,
  );
  return _ScreenHarness(
    scheduler: scheduler,
    sensor: sensor,
    viewModel: viewModel,
  );
}

final class _ScreenHarness {
  const _ScreenHarness({
    required this.scheduler,
    required this.sensor,
    required this.viewModel,
  });

  final FakePeriodicScheduler scheduler;
  final FakeSensorDeviceManager sensor;
  final IndoorNavigationViewModel viewModel;
}

final class _ControlledMapAssetRepository implements MapAssetRepository {
  final Completer<String> edges = Completer<String>();
  final Completer<String> map = Completer<String>();

  @override
  Future<String> loadRouteGraphEdgesJson(String assetPath) => edges.future;

  @override
  Future<String> loadTiledMapJson(String assetPath) => map.future;
}
