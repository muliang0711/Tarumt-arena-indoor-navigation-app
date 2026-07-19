import 'dart:async';
import 'dart:math' as math;

import 'package:indoor_navigation/application/orchestration/bootstrap/map_bootstrap_engine.dart';
import 'package:indoor_navigation/application/orchestration/bootstrap/map_bootstrap_state.dart';
import 'package:indoor_navigation/application/orchestration/edge_editor/edge_editor_engine.dart';
import 'package:indoor_navigation/application/orchestration/navigation/derived_estimate_bridge_engine.dart';
import 'package:indoor_navigation/application/orchestration/navigation/route_simulation_engine.dart';
import 'package:indoor_navigation/application/orchestration/navigation/wrong_way_reroute_monitor.dart';
import 'package:indoor_navigation/application/orchestration/sensors/raw_motion_pdr_engine.dart';
import 'package:indoor_navigation/application/orchestration/sensors/raw_motion_pdr_engine_state.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_pdr_fusion_engine.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_coordinator.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_coordinator_state.dart';
import 'package:indoor_navigation/application/orchestration/wifi/wifi_positioning_engine.dart';
import 'package:indoor_navigation/application/ports/assets/map_asset_repository.dart';
import 'package:indoor_navigation/application/ports/debug/sensor_debug_sink.dart';
import 'package:indoor_navigation/application/ports/export/edge_document_exporter.dart';
import 'package:indoor_navigation/application/ports/logging/navigation_event_sink.dart';
import 'package:indoor_navigation/application/ports/sensors/sensor_device_manager.dart';
import 'package:indoor_navigation/application/ports/time/clock.dart';
import 'package:indoor_navigation/application/ports/time/periodic_scheduler.dart';
import 'package:indoor_navigation/application/view_models/indoor_navigation_view_state.dart';
import 'package:indoor_navigation/application/view_models/navigation_ui_state.dart';
import 'package:indoor_navigation/application/view_models/view_model_models.dart';
import 'package:indoor_navigation/domain/campus/campus_room.dart';
import 'package:indoor_navigation/domain/common/angle_math.dart';
import 'package:indoor_navigation/domain/common/geometry_math.dart';
import 'package:indoor_navigation/domain/edge_editor/logic/route_metric_model.dart';
import 'package:indoor_navigation/domain/navigation/derived_navigation_estimate.dart';
import 'package:indoor_navigation/domain/navigation/logic/shortest_route.dart';
import 'package:indoor_navigation/domain/navigation_input/navigation_input_models.dart';
import 'package:indoor_navigation/domain/simulation/simulation_models.dart';
import 'package:indoor_navigation/domain/tiled/map/png_map_model.dart';
import 'package:indoor_navigation/domain/tiled/route/route_progress.dart';
import 'package:indoor_navigation/domain/tiled/route/route_turn_gate.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

typedef WifiPositioningEngineFactory = Future<WifiPositioningEngine> Function();

/// The single public MVVM boundary for the migrated Expo application state.
///
/// Flutter widgets are deliberately absent. Phase 8 may bind to [state] and
/// [states], then forward lifecycle calls to [pause] and [resume].
final class IndoorNavigationViewModel {
  factory IndoorNavigationViewModel({
    required Clock clock,
    required EdgeDocumentExporter edgeDocumentExporter,
    required MapAssetRepository mapAssetRepository,
    NavigationEventSink navigationEventSink = const NoopNavigationEventSink(),
    required PeriodicScheduler periodicScheduler,
    required SensorDebugSink sensorDebugSink,
    required SensorDeviceManager sensorDeviceManager,
    WifiPositioningEngineFactory? wifiPositioningEngineFactory,
  }) {
    return IndoorNavigationViewModel._(
      clock,
      edgeDocumentExporter,
      mapAssetRepository,
      navigationEventSink,
      periodicScheduler,
      sensorDebugSink,
      sensorDeviceManager,
      wifiPositioningEngineFactory,
    );
  }

  IndoorNavigationViewModel._(
    this._clock,
    this._edgeDocumentExporter,
    MapAssetRepository mapAssetRepository,
    this._navigationEventSink,
    this._periodicScheduler,
    this._sensorDebugSink,
    this._sensorDeviceManager,
    this._wifiPositioningEngineFactory,
  ) : _bootstrapEngine = MapBootstrapEngine(mapAssetRepository);

  final Clock _clock;
  final EdgeDocumentExporter _edgeDocumentExporter;
  final NavigationEventSink _navigationEventSink;
  final PeriodicScheduler _periodicScheduler;
  final SensorDebugSink _sensorDebugSink;
  final SensorDeviceManager _sensorDeviceManager;
  final WifiPositioningEngineFactory? _wifiPositioningEngineFactory;
  final MapBootstrapEngine _bootstrapEngine;
  final StreamController<IndoorNavigationViewState> _statesController =
      StreamController<IndoorNavigationViewState>.broadcast(sync: true);
  final List<StreamSubscription<Object?>> _childSubscriptions = [];

  IndoorNavigationViewState _state = IndoorNavigationViewState.initial();
  IndoorNavigationMode _mode = IndoorNavigationMode.navigate;
  IndoorNavigationLifecycleStatus _lifecycleStatus =
      IndoorNavigationLifecycleStatus.active;
  int _zoomIndex = indoorNavigationDefaultZoomIndex;
  int _generation = 0;
  bool _disposed = false;
  bool _synchronizing = false;
  bool _resumeRawMotion = false;
  bool _resumeSimulation = false;
  Future<void> _lifecycleTail = Future<void>.value();
  Future<void> _navigationTail = Future<void>.value();
  Future<void>? _initializeFuture;
  MapBootstrapData? _runtimeData;
  RouteSnapResult? _sensorRouteSnap;
  _NavigationDestination? _activeDestination;
  _NavigationDestination? _requestedDestination;
  List<String> _routeNodeIds = const [];
  String? _lastTrustedNodeId;
  RawMotionConsumerStatus? _lastLoggedRawMotionStatus;
  int _navigationSessionSequence = 0;
  int? _activeNavigationSessionId;
  NavigationSessionStatus? _navigationSessionStatus;
  Future<void>? _arrivalShutdownFuture;
  bool _arrivalShutdownStarted = false;
  bool _arrivalLogged = false;
  bool _wrongWayLogged = false;
  int _wifiCorrectionSequence = 0;
  WifiCorrectionVisualState? _wifiCorrectionVisual;
  WifiPositioningCoordinatorState _wifiPositioningState =
      const WifiPositioningCoordinatorState.idle();

  RouteSimulationEngine? _routeSimulationEngine;
  DerivedEstimateBridgeEngine? _derivedEstimateEngine;
  RawMotionPdrEngine? _rawMotionEngine;
  WrongWayRerouteMonitor? _wrongWayMonitor;
  EdgeEditorEngine? _edgeEditorEngine;
  WifiPositioningCoordinator? _wifiPositioningCoordinator;
  WifiPositioningEngine? _wifiPositioningEngine;

  IndoorNavigationViewState get state => _state;
  Stream<IndoorNavigationViewState> get states => _statesController.stream;

  Future<void> initialize() {
    _ensureNotDisposed();
    final existing = _initializeFuture;
    if (existing != null) {
      return existing;
    }
    if (_state.isReady) {
      return Future<void>.value();
    }
    final generation = ++_generation;
    _emitEmpty(loadStatus: IndoorNavigationLoadStatus.loading);
    final future = _runInitialize(generation);
    _initializeFuture = future;
    return future;
  }

  Future<void> startNavigation({
    required CampusRoom destination,
    required String startNodeId,
  }) {
    _ensureNotDisposed();
    final destinationNodeId = destination.navigationNodeId;
    if (!destination.navigationAvailable || destinationNodeId == null) {
      throw StateError('Destination ${destination.id} is not navigable.');
    }
    final requested = _NavigationDestination(
      destinationId: destination.id,
      destinationNodeId: destinationNodeId,
      startNodeId: startNodeId,
    );
    return _enqueueNavigation(() => _startNavigation(requested));
  }

  Future<void> _startNavigation(_NavigationDestination requested) async {
    final previous = _activeDestination;
    final isNewSession = previous != requested;
    _requestedDestination = requested;
    if (isNewSession) {
      _activeNavigationSessionId = ++_navigationSessionSequence;
      _navigationSessionStatus = NavigationSessionStatus.navigating;
      _arrivalShutdownFuture = null;
      _arrivalShutdownStarted = false;
      _arrivalLogged = false;
      _wrongWayLogged = false;
      _lastLoggedRawMotionStatus = null;
      _lastTrustedNodeId = requested.startNodeId;
    }
    await initialize();
    if (_disposed) {
      return;
    }
    if (isNewSession) {
      _wifiPositioningCoordinator?.stop();
      if (previous != null) {
        _recordEvent(NavigationEventType.stopped, destination: previous);
        _activeDestination = null;
      }
    }
    if (_activeDestination != requested) {
      await _replaceNavigationRoute(requested);
    }
    if (isNewSession) {
      _activeDestination = requested;
      _recordEvent(
        NavigationEventType.sessionStarted,
        details: {
          'routeNodeIds': _routeNodeIds,
          'routeDistanceMeters': _runtimeData!.routeMetrics.totalMeters,
        },
      );
    }
    if (_lifecycleStatus == IndoorNavigationLifecycleStatus.active) {
      await startRawMotion();
      _wifiPositioningCoordinator?.start();
    } else {
      _resumeRawMotion = true;
    }
  }

  Future<void> _replaceNavigationRoute(
    _NavigationDestination destination,
  ) async {
    await _rawMotionEngine!.stop();
    final bootstrapData = _bootstrapEngine.state.data!;
    final data = _createRuntimeData(bootstrapData, destination);
    _runtimeData = data;
    _synchronizing = true;
    try {
      _routeSimulationEngine!.replaceRoutePath(data.mapModel.routePath);
      final routePosition = _routeSimulationEngine!.state.routePosition;
      _derivedEstimateEngine!
        ..reset()
        ..updateRoutePosition(routePosition);
      _sensorRouteSnap = null;
      _rawMotionEngine!
        ..updateRouteContext(
          pixelsPerMeter: findPixelsPerMeterAtRoutePosition(
            metrics: data.routeMetrics,
            position: routePosition,
          ),
          routePosition: routePosition,
        )
        ..reset();
      _wrongWayMonitor!.reset();
    } finally {
      _synchronizing = false;
    }
    _recordEvent(
      NavigationEventType.routeChanged,
      destination: destination,
      details: {
        'routeNodeIds': _routeNodeIds,
        'routeDistanceMeters': data.routeMetrics.totalMeters,
      },
    );
    _rebuildReadyState();
  }

  MapBootstrapData _createRuntimeData(
    MapBootstrapData source,
    _NavigationDestination? destination,
  ) {
    if (destination == null) {
      _routeNodeIds = source.mapModel.routePath
          .map((node) => node.nodeId)
          .toList(growable: false);
      return source;
    }
    final routeNodeIds = findShortestRouteNodeIds(
      destinationNodeId: destination.destinationNodeId,
      edges: source.edges,
      startNodeId: destination.startNodeId,
    );
    final mapModel = createPngMapModelWithRoute(source.mapModel, routeNodeIds);
    _routeNodeIds = routeNodeIds;
    return MapBootstrapData(
      edgeDocumentJson: source.edgeDocumentJson,
      edges: source.edges,
      mapModel: mapModel,
      routeMetrics: createRouteMetricModel(mapModel.routePath, source.edges),
      sourceMap: source.sourceMap,
      tiledMapJson: source.tiledMapJson,
    );
  }

  Future<void> _runInitialize(int generation) async {
    try {
      await _bootstrapEngine.initialize();
      if (!_isCurrent(generation)) {
        return;
      }
      final bootstrapData = _bootstrapEngine.state.data;
      if (bootstrapData == null) {
        throw StateError('Map bootstrap completed without ready data.');
      }
      final data = _createRuntimeData(bootstrapData, _requestedDestination);
      _runtimeData = data;
      _activeDestination = _requestedDestination;
      await _loadWifiPositioningEngine();
      _createRuntime(data);
      _rebuildReadyState();
    } catch (error) {
      if (_isCurrent(generation)) {
        _emitEmpty(
          loadStatus: IndoorNavigationLoadStatus.error,
          loadError: error,
        );
      }
      rethrow;
    } finally {
      if (_isCurrent(generation)) {
        _initializeFuture = null;
      }
    }
  }

  Future<void> _loadWifiPositioningEngine() async {
    final factory = _wifiPositioningEngineFactory;
    if (factory == null || _wifiPositioningEngine != null) return;
    try {
      _wifiPositioningEngine = await factory();
    } catch (_) {
      // Wi-Fi positioning must never prevent the map and PDR from starting.
    }
  }

  void _createRuntime(MapBootstrapData data) {
    if (_routeSimulationEngine != null) {
      return;
    }
    final simulation = RouteSimulationEngine(
      scheduler: _periodicScheduler,
      routePath: data.mapModel.routePath,
    );
    final derived = DerivedEstimateBridgeEngine(
      clock: _clock,
      initialRedMarker: data.mapModel.redMarker,
      routePosition: simulation.state.routePosition,
      surface: data.mapModel.surface,
    );
    final edgeEditor = EdgeEditorEngine(_edgeDocumentExporter)
      ..initialize(edges: data.edges, routeNodes: data.mapModel.routeNodes);
    _routeSimulationEngine = simulation;
    _derivedEstimateEngine = derived;
    _edgeEditorEngine = edgeEditor;

    final wrongWay = WrongWayRerouteMonitor(
      acceptedExpectedHeadingDegrees: _acceptedRouteHeadings(),
      clock: _clock,
      observedHeadingDegrees: derived.state.redMarker.headingDegrees,
      routeNodes: data.mapModel.routeNodes,
      routePosition: simulation.state.routePosition,
      scheduler: _periodicScheduler,
    );
    _wrongWayMonitor = wrongWay;

    final rawMotion = RawMotionPdrEngine(
      clock: _clock,
      initialRedMarker: data.mapModel.redMarker,
      initialRoutePosition: _routeMotionTargetPosition(),
      periodicScheduler: _periodicScheduler,
      sensorDebugSink: _sensorDebugSink,
      sensorDeviceManager: _sensorDeviceManager,
      onEstimate: _ingestExternalEstimate,
      onHeading: _updateHeading,
    );
    _rawMotionEngine = rawMotion;
    rawMotion.updateRouteContext(
      pixelsPerMeter: _currentPixelsPerMeter(),
      routePosition: _routeMotionTargetPosition(),
    );

    final wifiEngine = _wifiPositioningEngine;
    if (wifiEngine != null) {
      final coordinator = WifiPositioningCoordinator(
        clock: _clock,
        contextProvider: _createWifiFusionContext,
        onCorrection: _handleWifiCorrection,
        periodicScheduler: _periodicScheduler,
        positioningEngine: wifiEngine,
      );
      _wifiPositioningCoordinator = coordinator;
      _wifiPositioningState = coordinator.state;
    }

    _listenTo(simulation.states);
    _listenTo(derived.states);
    _listenTo(edgeEditor.states);
    _listenTo(wrongWay.states, onData: _handleWrongWayState);
    _listenTo(rawMotion.states, onData: _handleRawMotionState);
    final wifiCoordinator = _wifiPositioningCoordinator;
    if (wifiCoordinator != null) {
      _listenTo(
        wifiCoordinator.states,
        onData: (state) => _wifiPositioningState = state,
      );
    }
    _synchronizing = true;
    try {
      wrongWay.start();
    } finally {
      _synchronizing = false;
    }
  }

  void _listenTo<T>(Stream<T> stream, {void Function(T state)? onData}) {
    _childSubscriptions.add(
      stream.listen((state) {
        onData?.call(state);
        if (!_synchronizing) {
          _rebuildReadyState();
        }
      }),
    );
  }

  WifiFusionContext? _createWifiFusionContext() {
    final destination = _activeDestination;
    final data = _runtimeData;
    if (_disposed ||
        destination == null ||
        data == null ||
        _navigationSessionStatus != NavigationSessionStatus.navigating ||
        _lifecycleStatus != IndoorNavigationLifecycleStatus.active) {
      return null;
    }
    return WifiFusionContext(
      currentPosition: _currentBlueMarkerPosition(),
      destinationNodeId: destination.destinationNodeId,
      pixelsPerMeter: _currentPixelsPerMeter(),
      routeNodes: data.mapModel.routeNodes,
    );
  }

  Future<void> _handleWifiCorrection(WifiCorrectionDecision decision) {
    return _enqueueNavigation(() => _applyWifiCorrection(decision));
  }

  Future<void> _applyWifiCorrection(WifiCorrectionDecision decision) async {
    final destination = _activeDestination;
    final data = _runtimeData;
    if (_disposed ||
        destination == null ||
        data == null ||
        _navigationSessionStatus != NavigationSessionStatus.navigating) {
      return;
    }
    final trustedNode = data.mapModel.routeNodes
        .where((node) => node.nodeId == decision.fix.localNodeId)
        .firstOrNull;
    if (trustedNode == null) return;

    final fromPosition = _currentBlueMarkerPosition();
    final deviceHeading = _rawMotionEngine!.latestDeviceHeadingDegrees;
    final previousTrustedNode = data.mapModel.routeNodes
        .where((node) => node.nodeId == _lastTrustedNodeId)
        .firstOrNull;
    final headingCorrectionDegrees =
        deviceHeading != null &&
            previousTrustedNode != null &&
            previousTrustedNode.nodeId != trustedNode.nodeId
        ? normalizeDegrees(
            headingBetweenPoints(previousTrustedNode, trustedNode) -
                deviceHeading,
          )
        : null;
    final provisionalTarget = RoutePosition(
      distanceAlongRoute: 0,
      headingDegrees: fromPosition.headingDegrees,
      screenX: trustedNode.screenX,
      screenY: trustedNode.screenY,
      segmentIndex: 0,
      tiledX: trustedNode.tiledX,
      tiledY: trustedNode.tiledY,
    );
    _wifiCorrectionVisual = WifiCorrectionVisualState(
      fromPosition: fromPosition,
      kind: decision.kind,
      sequence: ++_wifiCorrectionSequence,
      toPosition: provisionalTarget,
    );
    _rebuildReadyState();

    final correctedDestination = _NavigationDestination(
      destinationId: destination.destinationId,
      destinationNodeId: destination.destinationNodeId,
      startNodeId: decision.fix.localNodeId,
    );
    _activeDestination = correctedDestination;
    _requestedDestination = correctedDestination;
    await _replaceNavigationRoute(correctedDestination);
    if (_disposed || _activeDestination != correctedDestination) return;

    final trustedPosition = _routeSimulationEngine!.state.routePosition;
    _synchronizing = true;
    try {
      _sensorRouteSnap = RouteSnapResult(
        driftPixels: 0,
        position: trustedPosition,
      );
      _derivedEstimateEngine!
        ..reset()
        ..updateRoutePosition(trustedPosition);
      _rawMotionEngine!
        ..updateRouteContext(
          pixelsPerMeter: _currentPixelsPerMeter(),
          routePosition: trustedPosition,
        )
        ..rebase(trustedPosition);
      if (headingCorrectionDegrees != null) {
        _rawMotionEngine!.setHeadingCorrectionDegrees(headingCorrectionDegrees);
      }
      _wrongWayMonitor!.reset();
      _wrongWayLogged = false;
    } finally {
      _synchronizing = false;
    }
    _lastTrustedNodeId = decision.fix.localNodeId;
    _wifiCorrectionVisual = WifiCorrectionVisualState(
      fromPosition: fromPosition,
      kind: decision.kind,
      sequence: _wifiCorrectionSequence,
      toPosition: trustedPosition,
    );
    _recordEvent(
      NavigationEventType.positionUpdated,
      details: {
        'source': 'wifi',
        'correction': decision.kind.name,
        'driftMeters': decision.driftMeters,
        'localNodeId': decision.fix.localNodeId,
        'serverNodeId': decision.fix.serverNodeId,
        'headingCorrectionDegrees': headingCorrectionDegrees,
      },
    );
    _rebuildReadyState();

    await Future<void>.delayed(
      Duration(
        milliseconds: decision.kind == WifiCorrectionKind.teleport ? 520 : 320,
      ),
    );
    if (_disposed ||
        _wifiCorrectionVisual?.sequence != _wifiCorrectionSequence) {
      return;
    }
    _wifiCorrectionVisual = null;
    _rebuildReadyState();
    if (_lifecycleStatus == IndoorNavigationLifecycleStatus.active &&
        _navigationSessionStatus == NavigationSessionStatus.navigating) {
      await _rawMotionEngine!.start();
    } else if (_navigationSessionStatus == NavigationSessionStatus.navigating) {
      _resumeRawMotion = true;
    }
  }

  void _handleRawMotionState(RawMotionPdrEngineState state) {
    _logRawMotionStatus(state.status);
  }

  void _logRawMotionStatus(RawMotionConsumerStatus status) {
    if (_lastLoggedRawMotionStatus == status) {
      return;
    }
    _lastLoggedRawMotionStatus = status;
    _recordEvent(
      NavigationEventType.sensorStatusChanged,
      details: {'status': status.wireValue},
    );
  }

  void _handleWrongWayState(WrongWayRerouteMonitorState state) {
    final isWrongWay = state.result.shouldSuggestReroute;
    if (isWrongWay == _wrongWayLogged) {
      return;
    }
    _wrongWayLogged = isWrongWay;
    _recordEvent(
      isWrongWay
          ? NavigationEventType.wrongWayDetected
          : NavigationEventType.directionRecovered,
      details: {
        'currentNodeId': state.result.currentNode?.nodeId,
        'oppositeHeadingDurationMs': state.result.oppositeHeadingDurationMs,
        'reason': state.result.reason.wireValue,
      },
    );
  }

  void changeMode(IndoorNavigationMode mode) {
    _requireReady();
    if (_mode == mode) {
      return;
    }
    _mode = mode;
    if (mode == IndoorNavigationMode.navigate) {
      _edgeEditorEngine!.clearSelection();
    }
    _rebuildReadyState();
  }

  void zoomIn() {
    _requireReady();
    final next = math.min(indoorNavigationZoomSteps.length - 1, _zoomIndex + 1);
    if (next != _zoomIndex) {
      _zoomIndex = next;
      _rebuildReadyState();
    }
  }

  void zoomOut() {
    _requireReady();
    final next = math.max(0, _zoomIndex - 1);
    if (next != _zoomIndex) {
      _zoomIndex = next;
      _rebuildReadyState();
    }
  }

  void startSimulation() {
    _requireReady();
    _routeSimulationEngine!.start();
  }

  void pauseSimulation() {
    _requireReady();
    _routeSimulationEngine!.pause();
  }

  void stepSimulationForward() {
    _requireReady();
    _routeSimulationEngine!.stepForward();
  }

  void resetSimulation() {
    _requireReady();
    _routeSimulationEngine!.reset();
  }

  Future<void> startRawMotion() async {
    _requireReady();
    _routeSimulationEngine!.pause();
    await _rawMotionEngine!.start();
    _rebuildReadyState();
  }

  Future<void> stopRawMotion() async {
    _requireReady();
    await _rawMotionEngine!.stop();
    _rebuildReadyState();
  }

  void retryWifiPositioning() {
    _requireReady();
    _wifiPositioningCoordinator?.retry();
  }

  Future<void> completeArrivedNavigation() async {
    _requireReady();
    if (_navigationSessionStatus != NavigationSessionStatus.arrived) {
      return;
    }
    await _arrivalShutdownFuture;
    if (_disposed ||
        _navigationSessionStatus != NavigationSessionStatus.arrived) {
      return;
    }
    _recordEvent(NavigationEventType.navigationCompleted);
    _recordEvent(
      NavigationEventType.stopped,
      details: const {'reason': 'arrived'},
    );
    _navigationSessionStatus = NavigationSessionStatus.completed;
    _activeDestination = null;
    _requestedDestination = null;
    _lastTrustedNodeId = null;
    _resumeRawMotion = false;
    _resumeSimulation = false;
    _rebuildReadyState();
  }

  void resetNavigationInput() {
    _requireReady();
    _synchronizing = true;
    try {
      _rawMotionEngine!.reset();
      _derivedEstimateEngine!.reset();
      _wrongWayMonitor!.reset();
      _sensorRouteSnap = null;
    } finally {
      _synchronizing = false;
    }
    _rebuildReadyState();
  }

  void runReplayStep() {
    _requireReady();
    _synchronizing = true;
    try {
      final result = _derivedEstimateEngine!.runReplayStep();
      _applyAcceptedEstimate(result);
    } finally {
      _synchronizing = false;
    }
    _rebuildReadyState();
  }

  void selectRouteNode(OverlayRouteNode node) {
    _requireReady();
    if (_mode == IndoorNavigationMode.edges) {
      _edgeEditorEngine!.selectRouteNode(node.nodeId);
    }
  }

  void setEdgeId(String value) => _readyEdgeEditor().setEdgeId(value);
  void setEdgeDistance(String value) => _readyEdgeEditor().setDistance(value);
  void addEdgeField() => _readyEdgeEditor().addEdgeField();

  void updateEdgeField(int index, EdgeFieldProperty property, String value) {
    _readyEdgeEditor().updateEdgeField(index, property, value);
  }

  void removeEdgeField(int index) => _readyEdgeEditor().removeEdgeField(index);
  bool saveEdge() => _readyEdgeEditor().saveEdge();
  void removeEdge(String edgeId) => _readyEdgeEditor().removeEdge(edgeId);

  Future<void> exportEdges() => _readyEdgeEditor().exportDocument();

  Future<void> pause() {
    _requireReady();
    return _enqueueLifecycle(_pauseLifecycle);
  }

  Future<void> _pauseLifecycle() async {
    if (_disposed || !_state.isReady) {
      return;
    }
    if (_lifecycleStatus == IndoorNavigationLifecycleStatus.paused) {
      return;
    }
    final rawStatus = _rawMotionEngine!.state.status;
    _resumeRawMotion =
        rawStatus == RawMotionConsumerStatus.running ||
        rawStatus == RawMotionConsumerStatus.starting;
    _resumeSimulation =
        _routeSimulationEngine!.state.status == SimulationStatus.moving;
    _lifecycleStatus = IndoorNavigationLifecycleStatus.paused;
    _wifiPositioningCoordinator?.pause();
    _synchronizing = true;
    try {
      if (_resumeSimulation) {
        _routeSimulationEngine!.pause();
      }
      _wrongWayMonitor!.pause();
      if (_resumeRawMotion) {
        await _rawMotionEngine!.pause();
      }
    } finally {
      _synchronizing = false;
    }
    _recordEvent(NavigationEventType.paused);
    _rebuildReadyState();
  }

  Future<void> resume() {
    _requireReady();
    return _enqueueLifecycle(_resumeLifecycle);
  }

  Future<void> _resumeLifecycle() async {
    if (_disposed || !_state.isReady) {
      return;
    }
    if (_lifecycleStatus != IndoorNavigationLifecycleStatus.paused) {
      return;
    }
    _lifecycleStatus = IndoorNavigationLifecycleStatus.active;
    _synchronizing = true;
    try {
      _wrongWayMonitor!.resume();
      if (_resumeSimulation) {
        _routeSimulationEngine!.resume();
      }
      if (_resumeRawMotion) {
        await _rawMotionEngine!.start();
      }
      if (_navigationSessionStatus == NavigationSessionStatus.navigating) {
        _wifiPositioningCoordinator?.resume();
      }
    } finally {
      _resumeRawMotion = false;
      _resumeSimulation = false;
      _synchronizing = false;
    }
    _recordEvent(NavigationEventType.resumed);
    _rebuildReadyState();
  }

  Future<void> _enqueueLifecycle(Future<void> Function() operation) {
    final completion = Completer<void>();
    _lifecycleTail = _lifecycleTail.then((_) async {
      try {
        await operation();
        completion.complete();
      } catch (error, stackTrace) {
        completion.completeError(error, stackTrace);
      }
    });
    return completion.future;
  }

  Future<void> _enqueueNavigation(Future<void> Function() operation) {
    final completion = Completer<void>();
    _navigationTail = _navigationTail.then((_) async {
      try {
        await operation();
        completion.complete();
      } catch (error, stackTrace) {
        completion.completeError(error, stackTrace);
      }
    });
    return completion.future;
  }

  void _ingestExternalEstimate(DerivedNavigationEstimate estimate) {
    if (_disposed ||
        _derivedEstimateEngine == null ||
        _wifiCorrectionVisual != null) {
      return;
    }
    _synchronizing = true;
    try {
      final result = _derivedEstimateEngine!.ingestExternalEstimate(estimate);
      _applyAcceptedEstimate(result);
    } finally {
      _synchronizing = false;
    }
    _rebuildReadyState();
  }

  void _applyAcceptedEstimate(DerivedEstimateIngestResult result) {
    final estimate = result.acceptedEstimate;
    if (estimate == null) {
      return;
    }
    final data = _runtimeData!;
    final snap = constrainEstimateToRouteProgress(
      estimateHeadingDegrees: estimate.headingDegrees,
      estimateScreenX: estimate.x,
      estimateScreenY: estimate.y,
      previousPosition:
          _sensorRouteSnap?.position ??
          _routeSimulationEngine!.state.routePosition,
      routePath: data.mapModel.routePath,
    );
    _sensorRouteSnap = snap;
    _recordEvent(
      NavigationEventType.positionUpdated,
      details: {
        'distanceAlongRoute': snap.position.distanceAlongRoute,
        'headingDegrees': snap.position.headingDegrees,
        'screenX': snap.position.screenX,
        'screenY': snap.position.screenY,
        'segmentIndex': snap.position.segmentIndex,
      },
    );
  }

  void _updateHeading(double headingDegrees) {
    if (_disposed || _derivedEstimateEngine == null) {
      return;
    }
    _synchronizing = true;
    try {
      _derivedEstimateEngine!.updateHeadingOnly(headingDegrees);
    } finally {
      _synchronizing = false;
    }
    _rebuildReadyState();
  }

  void _rebuildReadyState() {
    if (_disposed || _routeSimulationEngine == null) {
      return;
    }
    final data = _runtimeData!;
    final blueMarkerPosition = _currentBlueMarkerPosition();

    if (!_sameRoutePosition(
      _derivedEstimateEngine!.state.routePosition,
      blueMarkerPosition,
    )) {
      final wasSynchronizing = _synchronizing;
      _synchronizing = true;
      _derivedEstimateEngine!.updateRoutePosition(blueMarkerPosition);
      _synchronizing = wasSynchronizing;
    }

    final acceptedHeadings = createAcceptedRouteHeadingDegrees(
      routePath: data.mapModel.routePath,
      routePosition: blueMarkerPosition,
    );
    final pixelsPerMeter = _currentPixelsPerMeter();
    _rawMotionEngine!.updateRouteContext(
      pixelsPerMeter: pixelsPerMeter,
      routePosition: _routeMotionTargetPosition(),
    );
    _wrongWayMonitor!
      ..updateAcceptedExpectedHeadingDegrees(acceptedHeadings)
      ..updateObservedHeadingDegrees(
        _derivedEstimateEngine!.state.redMarker.headingDegrees,
      )
      ..updateRouteNodes(data.mapModel.routeNodes)
      ..updateRoutePosition(blueMarkerPosition);

    final routeDistancePixels =
        _routeSimulationEngine!.state.routeDistancePixels;
    final distanceRemainingPixels = math
        .max(0.0, routeDistancePixels - blueMarkerPosition.distanceAlongRoute)
        .toDouble();
    final navigationStatus = _sensorRouteSnap == null
        ? _routeSimulationEngine!.state.status
        : distanceRemainingPixels <= 0
        ? SimulationStatus.arrived
        : SimulationStatus.moving;
    final remainingPathSegments = createRemainingRouteSegments(
      data.mapModel.routePath,
      blueMarkerPosition.distanceAlongRoute,
    );
    final navigation = createNavigationUiState(
      distanceRemainingPixels: distanceRemainingPixels,
      routeDistancePixels: routeDistancePixels,
      routePath: data.mapModel.routePath,
      routePosition: blueMarkerPosition,
      status: navigationStatus,
    );
    if (navigationStatus == SimulationStatus.arrived &&
        _navigationSessionStatus == NavigationSessionStatus.navigating) {
      _navigationSessionStatus = NavigationSessionStatus.arrived;
      if (!_arrivalLogged) {
        _arrivalLogged = true;
        _recordEvent(NavigationEventType.arrived);
      }
      final sessionId = _activeNavigationSessionId;
      if (!_arrivalShutdownStarted && sessionId != null) {
        _arrivalShutdownStarted = true;
        _arrivalShutdownFuture = _stopRuntimeAfterArrival(sessionId);
      }
    }

    _emit(
      IndoorNavigationViewState(
        acceptedRouteHeadingDegrees: acceptedHeadings,
        blueMarkerPosition: blueMarkerPosition,
        bootstrap: data,
        derivedEstimate: _derivedEstimateEngine!.state,
        edgeEditor: _edgeEditorEngine!.state,
        lifecycleStatus: _lifecycleStatus,
        loadError: null,
        loadStatus: IndoorNavigationLoadStatus.ready,
        mode: _mode,
        navigation: navigation,
        navigationSessionId: _activeNavigationSessionId,
        navigationSessionStatus: _navigationSessionStatus,
        pixelsPerMeter: pixelsPerMeter,
        rawMotion: _rawMotionEngine!.state,
        remainingPathSegments: remainingPathSegments,
        routeSimulation: _routeSimulationEngine!.state,
        sensorRouteSnap: _sensorRouteSnap,
        wrongWay: _wrongWayMonitor!.state,
        wifiCorrectionVisual: _wifiCorrectionVisual,
        wifiPositioning: _wifiPositioningState,
        zoomIndex: _zoomIndex,
      ),
    );
  }

  Future<void> _stopRuntimeAfterArrival(int sessionId) async {
    if (_disposed ||
        _activeNavigationSessionId != sessionId ||
        _navigationSessionStatus != NavigationSessionStatus.arrived) {
      return;
    }
    _resumeRawMotion = false;
    _resumeSimulation = false;
    _wifiPositioningCoordinator?.stop();
    _synchronizing = true;
    try {
      _routeSimulationEngine!.pause();
      _wrongWayMonitor!.pause();
      await _rawMotionEngine!.stop();
    } finally {
      _synchronizing = false;
    }
    if (!_disposed &&
        _activeNavigationSessionId == sessionId &&
        _navigationSessionStatus == NavigationSessionStatus.arrived) {
      _rebuildReadyState();
    }
  }

  RoutePosition _currentBlueMarkerPosition() {
    return _sensorRouteSnap?.position ??
        _routeSimulationEngine!.state.routePosition;
  }

  RoutePosition _routeMotionTargetPosition() {
    final data = _runtimeData!;
    return createTurnAwareRoutePosition(
      observedHeadingDegrees:
          _derivedEstimateEngine!.state.redMarker.headingDegrees,
      routePath: data.mapModel.routePath,
      routePosition: _currentBlueMarkerPosition(),
    );
  }

  List<double> _acceptedRouteHeadings() {
    final data = _runtimeData!;
    return createAcceptedRouteHeadingDegrees(
      routePath: data.mapModel.routePath,
      routePosition: _currentBlueMarkerPosition(),
    );
  }

  double _currentPixelsPerMeter() {
    return findPixelsPerMeterAtRoutePosition(
      metrics: _runtimeData!.routeMetrics,
      position: _currentBlueMarkerPosition(),
    );
  }

  EdgeEditorEngine _readyEdgeEditor() {
    _requireReady();
    return _edgeEditorEngine!;
  }

  void _emitEmpty({
    required IndoorNavigationLoadStatus loadStatus,
    Object? loadError,
  }) {
    _emit(
      IndoorNavigationViewState(
        acceptedRouteHeadingDegrees: const <double>[],
        blueMarkerPosition: null,
        bootstrap: null,
        derivedEstimate: null,
        edgeEditor: null,
        lifecycleStatus: _lifecycleStatus,
        loadError: loadError,
        loadStatus: loadStatus,
        mode: _mode,
        navigation: null,
        navigationSessionId: _activeNavigationSessionId,
        navigationSessionStatus: _navigationSessionStatus,
        pixelsPerMeter: null,
        rawMotion: null,
        remainingPathSegments: const <OverlayPathSegment>[],
        routeSimulation: null,
        sensorRouteSnap: null,
        wrongWay: null,
        wifiCorrectionVisual: null,
        wifiPositioning: _wifiPositioningState,
        zoomIndex: _zoomIndex,
      ),
    );
  }

  void _emit(IndoorNavigationViewState nextState) {
    if (_disposed) {
      return;
    }
    _state = nextState;
    _statesController.add(nextState);
  }

  void _recordEvent(
    NavigationEventType type, {
    _NavigationDestination? destination,
    Map<String, Object?> details = const {},
  }) {
    final target = destination ?? _activeDestination;
    if (target == null) {
      return;
    }
    try {
      _navigationEventSink.record(
        NavigationEvent(
          destinationId: target.destinationId,
          destinationNodeId: target.destinationNodeId,
          details: details,
          timestampMs: _clock.nowMs(),
          type: type,
        ),
      );
    } catch (_) {
      // Navigation telemetry is best-effort and cannot control navigation.
    }
  }

  bool _isCurrent(int generation) => !_disposed && generation == _generation;

  void _requireReady() {
    _ensureNotDisposed();
    if (!_state.isReady) {
      throw StateError('IndoorNavigationViewModel is not initialized.');
    }
  }

  void _ensureNotDisposed() {
    if (_disposed) {
      throw StateError('IndoorNavigationViewModel has been disposed.');
    }
  }

  Future<void> dispose() async {
    if (_disposed) {
      return;
    }
    final destination = _activeDestination;
    if (destination != null) {
      _recordEvent(NavigationEventType.stopped, destination: destination);
    }
    _generation += 1;
    _initializeFuture = null;
    _lifecycleStatus = IndoorNavigationLifecycleStatus.disposed;
    if (_state.isReady) {
      _rebuildReadyState();
    } else {
      _emitEmpty(loadStatus: _state.loadStatus, loadError: _state.loadError);
    }
    _disposed = true;

    for (final subscription in _childSubscriptions) {
      await subscription.cancel();
    }
    _childSubscriptions.clear();
    await _wrongWayMonitor?.dispose();
    await _wifiPositioningCoordinator?.dispose();
    if (_wifiPositioningCoordinator == null) {
      await _wifiPositioningEngine?.dispose();
    }
    await _rawMotionEngine?.dispose();
    if (_rawMotionEngine == null) {
      await _sensorDeviceManager.dispose();
    }
    await _derivedEstimateEngine?.dispose();
    await _routeSimulationEngine?.dispose();
    await _edgeEditorEngine?.dispose();
    await _bootstrapEngine.dispose();
    await _statesController.close();
  }
}

final class _NavigationDestination {
  const _NavigationDestination({
    required this.destinationId,
    required this.destinationNodeId,
    required this.startNodeId,
  });

  final String destinationId;
  final String destinationNodeId;
  final String startNodeId;

  @override
  bool operator ==(Object other) {
    return other is _NavigationDestination &&
        other.destinationId == destinationId &&
        other.destinationNodeId == destinationNodeId &&
        other.startNodeId == startNodeId;
  }

  @override
  int get hashCode =>
      Object.hash(destinationId, destinationNodeId, startNodeId);
}

bool _sameRoutePosition(RoutePosition left, RoutePosition right) {
  return left.distanceAlongRoute == right.distanceAlongRoute &&
      left.headingDegrees == right.headingDegrees &&
      left.screenX == right.screenX &&
      left.screenY == right.screenY &&
      left.segmentIndex == right.segmentIndex &&
      left.tiledX == right.tiledX &&
      left.tiledY == right.tiledY;
}
