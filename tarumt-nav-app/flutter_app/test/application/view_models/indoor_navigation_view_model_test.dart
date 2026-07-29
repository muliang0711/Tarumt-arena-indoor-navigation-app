import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/orchestration/edge_editor/edge_editor_engine.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_pdr_fusion_engine.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_engine.dart';
import 'package:indoor_navigation/application/ports/logging/navigation_event_sink.dart';
import 'package:indoor_navigation/application/ports/maps/map_runtime_resource_repository.dart';
import 'package:indoor_navigation/application/ports/sensors/sensor_device_manager.dart';
import 'package:indoor_navigation/application/ports/sensors/sensor_models.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_api.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_manager.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';
import 'package:indoor_navigation/application/view_models/indoor_navigation_view_model.dart';
import 'package:indoor_navigation/application/view_models/indoor_navigation_view_state.dart';
import 'package:indoor_navigation/application/view_models/view_model_models.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/navigation_input/navigation_input_models.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_node_mapping.dart';

import '../../support/fakes/fakes.dart';

void main() {
  late String mapJson;
  late String edgesJson;

  setUpAll(() {
    mapJson = File('assets/maps/demo_1.tmj.json').readAsStringSync();
    edgesJson = File('assets/maps/demo_1.edges.json').readAsStringSync();
  });

  test('initializes the complete immutable 46m view state once', () async {
    final harness = _createHarness(mapJson: mapJson, edgesJson: edgesJson);
    final states = <IndoorNavigationViewState>[];
    final subscription = harness.viewModel.states.listen(states.add);

    await harness.viewModel.initialize();
    await harness.viewModel.initialize();

    final state = harness.viewModel.state;
    expect(states.first.loadStatus, IndoorNavigationLoadStatus.loading);
    expect(state.loadStatus, IndoorNavigationLoadStatus.ready);
    expect(state.bootstrap!.routeMetrics.totalMeters, 46);
    expect(state.routeSimulation!.routeDistancePixels.round(), 2542);
    expect(state.navigation!.currentSegment, 'node-21 -> node-20');
    expect(state.mode, IndoorNavigationMode.navigate);
    expect(state.zoom, 1);
    expect(state.rawMotion!.status, RawMotionConsumerStatus.idle);
    expect(state.wrongWay!.isRunning, isTrue);
    expect(harness.mapRepository.invocations, hasLength(2));
    expect(harness.scheduler.activeTaskCount, 1);
    expect(state.remainingPathSegments.clear, throwsUnsupportedError);
    expect(
      () => state.acceptedRouteHeadingDegrees.add(12),
      throwsUnsupportedError,
    );

    await harness.viewModel.dispose();
    await subscription.cancel();
  });

  test('ends runtime once on arrival and completes the session', () async {
    final harness = _createHarness(mapJson: mapJson, edgesJson: edgesJson);
    final destination = _room('TA257', 'node-20');

    await harness.viewModel.startNavigation(
      destination: destination,
      startNodeId: 'node-21',
    );
    expect(
      harness.viewModel.state.navigationSessionStatus,
      NavigationSessionStatus.navigating,
    );
    expect(harness.viewModel.state.navigationSessionId, 1);

    harness.viewModel.stepSimulationForward();
    harness.viewModel.stepSimulationForward();
    await _flush();
    await _flush();

    expect(
      harness.viewModel.state.navigationSessionStatus,
      NavigationSessionStatus.arrived,
    );
    expect(
      harness.viewModel.state.rawMotion!.status,
      RawMotionConsumerStatus.stopped,
    );
    expect(harness.viewModel.state.wrongWay!.isRunning, isFalse);
    expect(
      harness.navigationSink.events.where(
        (event) => event.type == NavigationEventType.arrived,
      ),
      hasLength(1),
    );

    await harness.viewModel.completeArrivedNavigation();
    expect(
      harness.viewModel.state.navigationSessionStatus,
      NavigationSessionStatus.completed,
    );
    expect(
      harness.navigationSink.events.map((event) => event.type),
      containsAllInOrder([
        NavigationEventType.arrived,
        NavigationEventType.navigationCompleted,
        NavigationEventType.stopped,
      ]),
    );

    await harness.viewModel.startNavigation(
      destination: destination,
      startNodeId: 'node-21',
    );
    expect(
      harness.viewModel.state.navigationSessionStatus,
      NavigationSessionStatus.navigating,
    );
    expect(harness.viewModel.state.navigationSessionId, 2);

    await harness.viewModel.dispose();
  });

  test(
    'cancels navigation state and starts a fresh session next time',
    () async {
      final harness = _createHarness(mapJson: mapJson, edgesJson: edgesJson);
      final destination = _room('TA257', 'node-20');

      await harness.viewModel.startNavigation(
        destination: destination,
        startNodeId: 'node-21',
      );
      expect(harness.viewModel.state.navigationSessionId, 1);
      expect(harness.sensor.isRunning, isTrue);

      await harness.viewModel.cancelNavigation();

      final cancelled = harness.viewModel.state;
      expect(cancelled.navigationSessionId, isNull);
      expect(cancelled.navigationSessionStatus, isNull);
      expect(cancelled.sensorRouteSnap, isNull);
      expect(cancelled.rawMotion!.status, RawMotionConsumerStatus.stopped);
      expect(cancelled.routeSimulation!.routeProgressPixels, 0);
      expect(cancelled.wrongWay!.isRunning, isFalse);
      expect(harness.sensor.isRunning, isFalse);
      final stopped = harness.navigationSink.events.lastWhere(
        (event) => event.type == NavigationEventType.stopped,
      );
      expect(stopped.details['reason'], 'user_left_map');

      await harness.viewModel.startNavigation(
        destination: destination,
        startNodeId: 'node-21',
      );

      expect(harness.viewModel.state.navigationSessionId, 2);
      expect(
        harness.viewModel.state.navigationSessionStatus,
        NavigationSessionStatus.navigating,
      );
      expect(harness.viewModel.state.wrongWay!.isRunning, isTrue);
      expect(harness.sensor.isRunning, isTrue);

      await harness.viewModel.dispose();
    },
  );

  test(
    'uses the first Wi-Fi fix to initialize the marker and PDR origin',
    () async {
      final scanManager = _ImmediateWifiScanManager();
      final harness = _createHarness(
        mapJson: mapJson,
        edgesJson: edgesJson,
        wifiPositioningEngineFactory: () async => WifiPositioningEngine(
          api: const _FixedNodeWifiApi('server-node-20'),
          mappingRegistry: WifiNodeMappingRegistry(
            floorId: 'floor-2',
            mappings: const {'server-node-20': 'node-20'},
            unmappedServerNodes: const {},
          ),
          scanManager: scanManager,
        ),
      );

      await harness.viewModel.startNavigation(
        destination: _room('TA256', 'node-19'),
        startNodeId: 'node-21',
      );
      for (var attempt = 0; attempt < 8; attempt += 1) {
        await _flush();
        if (harness.viewModel.state.wifiCorrectionVisual != null) break;
      }
      expect(
        harness.viewModel.state.wifiCorrectionVisual?.phase,
        WifiCorrectionVisualPhase.recalculating,
      );
      expect(
        harness.viewModel.state.wifiCorrectionVisual?.recalculatesRoute,
        isTrue,
      );
      await Future<void>.delayed(
        const Duration(milliseconds: wifiRouteRecalculationDelayMs + 50),
      );
      await _flush();

      final state = harness.viewModel.state;
      final trustedNode = state.bootstrap!.mapModel.routeNodes.singleWhere(
        (node) => node.nodeId == 'node-20',
      );
      final blueMarker = state.blueMarkerPosition!;
      expect(scanManager.scanCount, 1);
      expect(state.wifiPositioning.lastFix?.localNodeId, 'node-20');
      expect(blueMarker.screenX, trustedNode.screenX);
      expect(blueMarker.screenY, trustedNode.screenY);
      expect(state.navigationSessionStatus, NavigationSessionStatus.navigating);
      expect(state.navigation!.currentSegment, 'node-20 -> node-19');

      await harness.viewModel.dispose();
    },
  );

  test(
    'a destination Wi-Fi fix skips rerouting and arrives directly',
    () async {
      final scanManager = _ImmediateWifiScanManager();
      final harness = _createHarness(
        mapJson: mapJson,
        edgesJson: edgesJson,
        wifiPositioningEngineFactory: () async => WifiPositioningEngine(
          api: const _FixedNodeWifiApi('server-destination'),
          mappingRegistry: WifiNodeMappingRegistry(
            floorId: 'floor-2',
            mappings: const {'server-destination': 'node-20'},
            unmappedServerNodes: const {},
          ),
          scanManager: scanManager,
        ),
      );

      await harness.viewModel.startNavigation(
        destination: _room('TA257', 'node-20'),
        startNodeId: 'node-21',
      );
      for (var attempt = 0; attempt < 12; attempt += 1) {
        await _flush();
        if (harness.viewModel.state.navigationSessionStatus ==
            NavigationSessionStatus.arrived) {
          break;
        }
      }

      expect(
        harness.viewModel.state.navigationSessionStatus,
        NavigationSessionStatus.arrived,
      );
      expect(
        harness.viewModel.state.wifiCorrectionVisual?.recalculatesRoute,
        isFalse,
      );
      expect(scanManager.scanCount, 1);

      await harness.viewModel.dispose();
    },
  );

  test('coordinates shell, simulation, and Edge Editor state', () async {
    final harness = _createHarness(mapJson: mapJson, edgesJson: edgesJson);
    await harness.viewModel.initialize();

    for (var index = 0; index < 10; index += 1) {
      harness.viewModel.zoomIn();
    }
    expect(harness.viewModel.state.zoom, 2);
    for (var index = 0; index < 10; index += 1) {
      harness.viewModel.zoomOut();
    }
    expect(harness.viewModel.state.zoom, 0.5);
    harness.viewModel.setZoom(1.37);
    expect(harness.viewModel.state.zoom, 1.37);
    harness.viewModel.setZoom(20);
    expect(harness.viewModel.state.zoom, 2);
    harness.viewModel.setZoom(-20);
    expect(harness.viewModel.state.zoom, 0.5);

    harness.viewModel.startSimulation();
    harness.scheduler.advanceByMs(100);
    expect(harness.viewModel.state.routeSimulation!.routeProgressPixels, 14);
    expect(harness.viewModel.state.navigation!.status.wireValue, 'moving');
    harness.viewModel.stepSimulationForward();
    expect(harness.viewModel.state.routeSimulation!.routeProgressPixels, 110);
    expect(harness.viewModel.state.routeSimulation!.status.wireValue, 'paused');
    harness.viewModel.resetSimulation();
    expect(harness.viewModel.state.routeSimulation!.routeProgressPixels, 0);

    final first = harness.viewModel.state.bootstrap!.mapModel.routeNodes.first;
    final second = harness.viewModel.state.bootstrap!.mapModel.routeNodes[1];
    harness.viewModel.selectRouteNode(first);
    expect(harness.viewModel.state.edgeEditor!.selectedNodeIds, isEmpty);
    harness.viewModel.changeMode(IndoorNavigationMode.edges);
    harness.viewModel.selectRouteNode(first);
    harness.viewModel.selectRouteNode(second);
    expect(harness.viewModel.state.edgeEditor!.selectedNodeIds, [
      first.nodeId,
      second.nodeId,
    ]);
    harness.viewModel.setEdgeId('phase7-test-edge');
    harness.viewModel.setEdgeDistance('5');
    harness.viewModel.addEdgeField();
    harness.viewModel.updateEdgeField(0, EdgeFieldProperty.key, 'floor');
    harness.viewModel.updateEdgeField(0, EdgeFieldProperty.value, '2');
    expect(harness.viewModel.saveEdge(), isTrue);
    expect(
      harness.viewModel.state.edgeEditor!.edges.last.id,
      'phase7-test-edge',
    );
    expect(harness.viewModel.state.bootstrap!.routeMetrics.totalMeters, 46);

    await harness.viewModel.exportEdges();
    expect(harness.exporter.requests, hasLength(1));
    expect(
      harness.exporter.requests.single.jsonBody,
      contains('phase7-test-edge'),
    );
    harness.viewModel.selectRouteNode(first);
    harness.viewModel.changeMode(IndoorNavigationMode.navigate);
    expect(harness.viewModel.state.edgeEditor!.selectedNodeIds, isEmpty);

    await harness.viewModel.dispose();
  });

  test(
    'starts a room route, real sensors, movement logs, and replaces destination',
    () async {
      final harness = _createHarness(mapJson: mapJson, edgesJson: edgesJson);

      await harness.viewModel.startNavigation(
        destination: _room('TA257', 'node-20'),
        startNodeId: 'node-21',
      );
      await _flush();

      var state = harness.viewModel.state;
      expect(state.bootstrap!.mapModel.routePath.map((node) => node.nodeId), [
        'node-21',
        'node-20',
      ]);
      expect(state.bootstrap!.routeMetrics.totalMeters, 3);
      expect(state.rawMotion!.status, RawMotionConsumerStatus.running);
      expect(harness.sensor.lastStartRequest, isNotNull);
      expect(
        harness.navigationSink.events.map((event) => event.type),
        containsAllInOrder([
          NavigationEventType.sessionStarted,
          NavigationEventType.sensorStatusChanged,
        ]),
      );

      harness.sensor.emit(
        HeadingSensorEvent(
          headingDegrees: 90,
          receivedAtMs: harness.clock.nowMs(),
          source: SensorHeadingSource.magnetometer,
        ),
      );
      await _flush();
      harness.scheduler.advanceByMs(2000);
      await _flush();
      expect(
        harness.viewModel.state.wrongWay!.result.shouldSuggestReroute,
        isTrue,
      );
      expect(
        harness.navigationSink.events.map((event) => event.type),
        contains(NavigationEventType.wrongWayDetected),
      );

      harness.sensor.emit(
        HeadingSensorEvent(
          headingDegrees: 270,
          receivedAtMs: harness.clock.nowMs(),
          source: SensorHeadingSource.magnetometer,
        ),
      );
      await _flush();
      harness.scheduler.advanceByMs(1000);
      await _flush();
      expect(
        harness.viewModel.state.wrongWay!.result.shouldSuggestReroute,
        isFalse,
      );
      expect(
        harness.navigationSink.events.map((event) => event.type),
        contains(NavigationEventType.directionRecovered),
      );

      harness.viewModel.runReplayStep();
      state = harness.viewModel.state;
      expect(state.sensorRouteSnap, isNotNull);
      expect(
        harness.navigationSink.events.map((event) => event.type),
        contains(NavigationEventType.positionUpdated),
      );

      await harness.viewModel.pause();
      expect(
        harness.navigationSink.events.map((event) => event.type),
        contains(NavigationEventType.paused),
      );
      await harness.viewModel.startNavigation(
        destination: _room('TA256', 'node-19'),
        startNodeId: 'node-21',
      );
      await _flush();
      state = harness.viewModel.state;
      expect(state.bootstrap!.mapModel.routePath.map((node) => node.nodeId), [
        'node-21',
        'node-20',
        'node-19',
      ]);
      expect(state.bootstrap!.routeMetrics.totalMeters, 6);
      expect(state.sensorRouteSnap, isNull);
      expect(state.rawMotion!.status, RawMotionConsumerStatus.stopped);
      await harness.viewModel.resume();
      await _flush();
      expect(
        harness.viewModel.state.rawMotion!.status,
        RawMotionConsumerStatus.running,
      );
      expect(
        harness.navigationSink.events.map((event) => event.type),
        contains(NavigationEventType.resumed),
      );
      expect(
        harness.navigationSink.events.map((event) => event.type),
        containsAllInOrder([
          NavigationEventType.stopped,
          NavigationEventType.routeChanged,
          NavigationEventType.sessionStarted,
        ]),
      );

      await harness.viewModel.dispose();
    },
  );

  test(
    'maps device compass heading onto the fixed Navigation floor plan',
    () async {
      final harness = _createHarness(mapJson: mapJson, edgesJson: edgesJson);
      final destination = _room('TA257', 'node-20');
      await harness.viewModel.startNavigation(
        destination: destination,
        startNodeId: 'node-21',
      );

      harness.sensor.emit(
        HeadingSensorEvent(
          headingDegrees: 350,
          receivedAtMs: harness.clock.nowMs(),
          source: SensorHeadingSource.magnetometer,
        ),
      );
      await _flush();
      expect(harness.viewModel.state.navigationMapHeadingDegrees, 80);
      expect(harness.viewModel.state.navigationDisplayHeadingDegrees, 80);

      harness.sensor.emit(
        HeadingSensorEvent(
          headingDegrees: 80,
          receivedAtMs: harness.clock.nowMs(),
          source: SensorHeadingSource.magnetometer,
        ),
      );
      await _flush();
      expect(harness.viewModel.state.navigationMapHeadingDegrees, 170);
      expect(harness.viewModel.state.navigationDisplayHeadingDegrees, 170);

      await harness.viewModel.cancelNavigation(reason: 'test');
      await harness.viewModel.startNavigation(
        destination: destination,
        startNodeId: 'node-21',
      );
      harness.sensor.emit(
        HeadingSensorEvent(
          headingDegrees: 120,
          receivedAtMs: harness.clock.nowMs(),
          source: SensorHeadingSource.magnetometer,
        ),
      );
      await _flush();
      expect(harness.viewModel.state.navigationMapHeadingDegrees, 210);
      expect(harness.viewModel.state.navigationDisplayHeadingDegrees, 210);

      await harness.viewModel.dispose();
    },
  );

  test(
    'detects wrong way using the same floor-plan heading shown by Bob',
    () async {
      final harness = _createHarness(mapJson: mapJson, edgesJson: edgesJson);
      await harness.viewModel.startNavigation(
        destination: _room('TA257', 'node-20'),
        startNodeId: 'node-21',
      );

      expect(harness.viewModel.state.blueMarkerPosition!.headingDegrees, 0);
      harness.sensor.emit(
        HeadingSensorEvent(
          headingDegrees: 80,
          receivedAtMs: harness.clock.nowMs(),
          source: SensorHeadingSource.magnetometer,
        ),
      );
      await _flush();
      expect(harness.viewModel.state.navigationDisplayHeadingDegrees, 170);

      harness.scheduler.advanceByMs(2000);
      await _flush();
      expect(
        harness.viewModel.state.wrongWay!.result.shouldSuggestReroute,
        isTrue,
      );

      await harness.viewModel.dispose();
    },
  );

  test(
    'runs normalized sensor input through PDR, markers, debug, and reset',
    () async {
      final harness = _createHarness(mapJson: mapJson, edgesJson: edgesJson);
      await harness.viewModel.initialize();

      await harness.viewModel.startRawMotion();
      expect(harness.viewModel.state.rawMotion!.status.wireValue, 'running');
      expect(
        harness.viewModel.state.routeSimulation!.status.wireValue,
        'paused',
      );
      expect(harness.sensor.lastStartRequest!.motionUpdateIntervalMs, 30);
      expect(harness.sensor.lastStartRequest!.headingUpdateIntervalMs, 50);

      final nowMs = harness.clock.nowMs();
      expect(
        harness.sensor.emit(
          HeadingSensorEvent(
            headingDegrees: 45,
            receivedAtMs: nowMs,
            source: SensorHeadingSource.magnetometer,
          ),
        ),
        isTrue,
      );
      expect(
        harness.sensor.emit(
          MotionSensorEvent(
            accelerationMetersPerSecondSquared: const MotionVector(
              x: 0.1,
              y: 0.1,
              z: 0.1,
            ),
            fallbackHeadingDegrees: null,
            receivedAtMs: nowMs,
          ),
        ),
        isTrue,
      );
      await _flush();
      expect(
        harness.viewModel.state.derivedEstimate!.redMarker.headingDegrees,
        135,
      );

      harness.scheduler.advanceByMs(60);
      await _flush();
      final state = harness.viewModel.state;
      expect(state.rawMotion!.lastPdrResult, isNotNull);
      expect(state.rawMotion!.stats.totalBatches, 1);
      expect(state.derivedEstimate!.latestEstimate, isNotNull);
      expect(state.sensorRouteSnap, isNotNull);
      expect(state.navigation!.status.wireValue, 'moving');
      expect(harness.debugSink.events, hasLength(2));

      harness.viewModel.resetNavigationInput();
      expect(harness.viewModel.state.rawMotion!.status.wireValue, 'running');
      expect(harness.viewModel.state.rawMotion!.lastPdrResult, isNull);
      expect(
        harness.viewModel.state.derivedEstimate!.buffer.acceptedEstimates,
        isEmpty,
      );
      expect(harness.viewModel.state.sensorRouteSnap, isNull);

      await harness.viewModel.stopRawMotion();
      expect(harness.debugSink.events, hasLength(3));
      await harness.viewModel.dispose();
    },
  );

  test(
    'pauses, resumes, and disposes every owned runtime exactly once',
    () async {
      final harness = _createHarness(mapJson: mapJson, edgesJson: edgesJson);
      final done = harness.viewModel.states.drain<void>();
      await harness.viewModel.initialize();
      await harness.viewModel.startRawMotion();
      harness.viewModel.startSimulation();
      expect(harness.scheduler.activeTaskCount, 3);

      await harness.viewModel.pause();
      expect(
        harness.viewModel.state.lifecycleStatus,
        IndoorNavigationLifecycleStatus.paused,
      );
      expect(harness.scheduler.activeTaskCount, 0);

      await harness.viewModel.resume();
      expect(
        harness.viewModel.state.lifecycleStatus,
        IndoorNavigationLifecycleStatus.active,
      );
      expect(harness.viewModel.state.rawMotion!.status.wireValue, 'running');
      expect(
        harness.viewModel.state.routeSimulation!.status.wireValue,
        'moving',
      );
      expect(harness.scheduler.activeTaskCount, 3);

      await harness.viewModel.dispose();
      await done;
      expect(
        harness.viewModel.state.lifecycleStatus,
        IndoorNavigationLifecycleStatus.disposed,
      );
      expect(harness.scheduler.activeTaskCount, 0);
      expect(harness.sensor.disposeCallCount, 1);
      await expectLater(harness.viewModel.dispose(), completes);
      expect(harness.viewModel.initialize, throwsStateError);
    },
  );

  test('lifecycle preserves inactive simulation state', () async {
    final harness = _createHarness(mapJson: mapJson, edgesJson: edgesJson);
    await harness.viewModel.initialize();
    expect(harness.viewModel.state.routeSimulation!.status.wireValue, 'ready');

    await harness.viewModel.pause();
    expect(harness.viewModel.state.routeSimulation!.status.wireValue, 'ready');
    expect(harness.scheduler.activeTaskCount, 0);

    await harness.viewModel.resume();
    expect(harness.viewModel.state.routeSimulation!.status.wireValue, 'ready');
    expect(harness.scheduler.activeTaskCount, 1);

    await harness.viewModel.dispose();
  });

  test(
    'serializes overlapping lifecycle transitions without losing resume',
    () async {
      final clock = FakeClock(initialNowMs: 1000);
      final scheduler = FakePeriodicScheduler(clock: clock);
      final repository = FakeMapAssetRepository()
        ..enqueueTiledMapJson(
          assetPath: 'assets/maps/demo_1.tmj.json',
          json: mapJson,
        )
        ..enqueueRouteGraphEdgesJson(
          assetPath: 'assets/maps/demo_1.edges.json',
          json: edgesJson,
        );
      final sensor = _DelayedStopSensorDeviceManager();
      final viewModel = IndoorNavigationViewModel(
        clock: clock,
        edgeDocumentExporter: FakeEdgeDocumentExporter(),
        mapAssetRepository: repository,
        periodicScheduler: scheduler,
        sensorDebugSink: FakeSensorDebugSink(),
        sensorDeviceManager: sensor,
      );
      await viewModel.initialize();
      await viewModel.startRawMotion();
      viewModel.startSimulation();

      final stopGate = sensor.delayNextStop();
      final firstPause = viewModel.pause();
      await _flush();
      final overlappingResume = viewModel.resume();
      final secondPause = viewModel.pause();
      stopGate.complete();
      await Future.wait([firstPause, overlappingResume, secondPause]);

      expect(
        viewModel.state.lifecycleStatus,
        IndoorNavigationLifecycleStatus.paused,
      );
      expect(viewModel.state.rawMotion!.status.wireValue, 'stopped');
      expect(viewModel.state.routeSimulation!.status.wireValue, 'paused');

      await viewModel.resume();
      expect(
        viewModel.state.lifecycleStatus,
        IndoorNavigationLifecycleStatus.active,
      );
      expect(viewModel.state.rawMotion!.status.wireValue, 'running');
      expect(viewModel.state.routeSimulation!.status.wireValue, 'moving');
      expect(scheduler.activeTaskCount, 3);

      await viewModel.dispose();
    },
  );

  test(
    'deduplicates initialization and suppresses completion after dispose',
    () async {
      final clock = FakeClock(initialNowMs: 1000);
      final repository = _ControlledMapAssetRepository();
      final sensor = FakeSensorDeviceManager();
      final viewModel = IndoorNavigationViewModel(
        clock: clock,
        edgeDocumentExporter: FakeEdgeDocumentExporter(),
        mapAssetRepository: repository,
        periodicScheduler: FakePeriodicScheduler(clock: clock),
        sensorDebugSink: FakeSensorDebugSink(),
        sensorDeviceManager: sensor,
      );
      final states = <IndoorNavigationViewState>[];
      final done = viewModel.states.listen(states.add).asFuture<void>();

      final first = viewModel.initialize();
      final second = viewModel.initialize();
      expect(identical(first, second), isTrue);
      expect(repository.loadCount, 1);

      await viewModel.dispose();
      repository.resources.complete(
        MapRuntimeResources(
          bundleRevision: null,
          edgeDocumentJson: edgesJson,
          floorId: 'floor-2',
          graphRevision: null,
          image: const MapImageLocation.bundledAsset(defaultMapImageAssetPath),
          mapId: 'main-campus',
          tiledMapJson: mapJson,
        ),
      );
      await Future.wait([first, second]);
      await done;

      expect(states.map((state) => state.loadStatus), [
        IndoorNavigationLoadStatus.loading,
        IndoorNavigationLoadStatus.loading,
      ]);
      expect(
        viewModel.state.lifecycleStatus,
        IndoorNavigationLifecycleStatus.disposed,
      );
      expect(sensor.disposeCallCount, 1);
    },
  );

  test(
    'surfaces bootstrap failure and disposes an unused sensor manager',
    () async {
      final clock = FakeClock(initialNowMs: 1000);
      final repository = FakeMapAssetRepository()
        ..enqueueTiledMapFailure(
          assetPath: 'assets/maps/demo_1.tmj.json',
          error: StateError('map unavailable'),
        );
      final sensor = FakeSensorDeviceManager();
      final viewModel = IndoorNavigationViewModel(
        clock: clock,
        edgeDocumentExporter: FakeEdgeDocumentExporter(),
        mapAssetRepository: repository,
        periodicScheduler: FakePeriodicScheduler(clock: clock),
        sensorDebugSink: FakeSensorDebugSink(),
        sensorDeviceManager: sensor,
      );

      await expectLater(viewModel.initialize(), throwsStateError);
      expect(viewModel.state.loadStatus, IndoorNavigationLoadStatus.error);
      expect(viewModel.state.loadError, isA<StateError>());
      await viewModel.dispose();
      expect(sensor.disposeCallCount, 1);
    },
  );
}

_ViewModelHarness _createHarness({
  required String mapJson,
  required String edgesJson,
  WifiPositioningEngineFactory? wifiPositioningEngineFactory,
}) {
  final clock = FakeClock(initialNowMs: 1000);
  final scheduler = FakePeriodicScheduler(clock: clock);
  final mapRepository = FakeMapAssetRepository()
    ..enqueueTiledMapJson(
      assetPath: 'assets/maps/demo_1.tmj.json',
      json: mapJson,
    )
    ..enqueueRouteGraphEdgesJson(
      assetPath: 'assets/maps/demo_1.edges.json',
      json: edgesJson,
    );
  final sensor = FakeSensorDeviceManager();
  final debugSink = FakeSensorDebugSink();
  final navigationSink = FakeNavigationEventSink();
  final exporter = FakeEdgeDocumentExporter();
  final viewModel = IndoorNavigationViewModel(
    clock: clock,
    edgeDocumentExporter: exporter,
    mapAssetRepository: mapRepository,
    navigationEventSink: navigationSink,
    periodicScheduler: scheduler,
    sensorDebugSink: debugSink,
    sensorDeviceManager: sensor,
    wifiPositioningEngineFactory: wifiPositioningEngineFactory,
  );
  return _ViewModelHarness(
    clock: clock,
    debugSink: debugSink,
    exporter: exporter,
    mapRepository: mapRepository,
    navigationSink: navigationSink,
    scheduler: scheduler,
    sensor: sensor,
    viewModel: viewModel,
  );
}

final class _ViewModelHarness {
  const _ViewModelHarness({
    required this.clock,
    required this.debugSink,
    required this.exporter,
    required this.mapRepository,
    required this.navigationSink,
    required this.scheduler,
    required this.sensor,
    required this.viewModel,
  });

  final FakeClock clock;
  final FakeSensorDebugSink debugSink;
  final FakeEdgeDocumentExporter exporter;
  final FakeMapAssetRepository mapRepository;
  final FakeNavigationEventSink navigationSink;
  final FakePeriodicScheduler scheduler;
  final FakeSensorDeviceManager sensor;
  final IndoorNavigationViewModel viewModel;
}

CampusRoom _room(String id, String nodeId) {
  return CampusRoom(
    category: CampusRoomCategory.classroom,
    floorId: 'floor-2',
    id: id,
    name: id,
    navigationNodeId: nodeId,
    roomCode: id,
    typeLabel: 'Classroom',
    visual: CampusRoomVisual.lectureHall,
    walkMinutes: 1,
  );
}

Future<void> _flush() => Future<void>.delayed(Duration.zero);

final class _FixedNodeWifiApi implements WifiPositioningApi {
  const _FixedNodeWifiApi(this.serverNodeId);

  final String serverNodeId;

  @override
  Future<WifiPositioningResponse> findClosestNode(
    WifiPositioningRequest request,
  ) async => WifiPositioningResponse(serverNodeId: serverNodeId);
}

final class _ImmediateWifiScanManager implements WifiScanManager {
  int scanCount = 0;

  @override
  Future<WifiScanAccessState> checkAccess() async => _grantedWifiAccess;

  @override
  Future<void> dispose() async {}

  @override
  Future<WifiScanAccessState> requestPermission() async => _grantedWifiAccess;

  @override
  Future<WifiScanBatch> scan({bool requestActiveScan = true}) async {
    scanCount += 1;
    return WifiScanBatch(
      completedAtMs: 1000,
      readings: [
        WifiAccessPointReading(
          bssid: 'AA:BB:CC:DD:EE:FF',
          frequencyMhz: 2412,
          observedAtMs: 1000,
          rssi: -55,
          ssid: 'Campus',
        ),
      ],
      source: WifiScanBatchSource.active,
      startedAtMs: 1000,
    );
  }
}

const _grantedWifiAccess = WifiScanAccessState(
  locationServicesEnabled: true,
  permission: WifiScanPermissionStatus.granted,
  platformSupport: WifiScanPlatformSupport.supported,
  wifiEnabled: true,
);

final class _ControlledMapAssetRepository
    implements MapRuntimeResourceRepository {
  final Completer<MapRuntimeResources> resources =
      Completer<MapRuntimeResources>();
  var loadCount = 0;

  @override
  Future<MapRuntimeResources> loadCurrent({
    required String floorId,
    required String mapId,
  }) {
    loadCount += 1;
    return resources.future;
  }
}

final class _DelayedStopSensorDeviceManager implements SensorDeviceManager {
  final FakeSensorDeviceManager _delegate = FakeSensorDeviceManager();
  Completer<void>? _nextStopGate;

  Completer<void> delayNextStop() {
    final gate = Completer<void>();
    _nextStopGate = gate;
    return gate;
  }

  @override
  Future<SensorAvailability> checkAvailability() {
    return _delegate.checkAvailability();
  }

  @override
  Future<void> dispose() => _delegate.dispose();

  @override
  Stream<NormalizedSensorEvent> get events => _delegate.events;

  @override
  Future<SensorPermissionStatus> requestPermissions() {
    return _delegate.requestPermissions();
  }

  @override
  Future<void> start(SensorSamplingRequest request) => _delegate.start(request);

  @override
  Future<void> stop() async {
    await _delegate.stop();
    final gate = _nextStopGate;
    _nextStopGate = null;
    await gate?.future;
  }
}
