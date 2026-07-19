import 'dart:async';

import 'package:indoor_navigation/application/ports/time/clock.dart';
import 'package:indoor_navigation/application/ports/time/periodic_scheduler.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/reroute/logic/junction_position.dart';
import 'package:indoor_navigation/domain/reroute/logic/wrong_way_reroute.dart';
import 'package:indoor_navigation/domain/reroute/reroute_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

final class WrongWayRerouteMonitorState {
  const WrongWayRerouteMonitorState({
    required this.isRunning,
    required this.result,
  });

  final bool isRunning;
  final WrongWayRerouteResult result;
}

final class WrongWayRerouteMonitor {
  factory WrongWayRerouteMonitor({
    List<double>? acceptedExpectedHeadingDegrees,
    required Clock clock,
    WrongWayRerouteConfig config = defaultWrongWayRerouteConfig,
    required double observedHeadingDegrees,
    required List<OverlayRouteNode> routeNodes,
    required RoutePosition routePosition,
    required PeriodicScheduler scheduler,
  }) {
    return WrongWayRerouteMonitor._(
      acceptedExpectedHeadingDegrees,
      clock,
      config,
      observedHeadingDegrees,
      routeNodes,
      routePosition,
      scheduler,
    );
  }

  WrongWayRerouteMonitor._(
    List<double>? acceptedExpectedHeadingDegrees,
    this._clock,
    this._config,
    this._observedHeadingDegrees,
    List<OverlayRouteNode> routeNodes,
    this._routePosition,
    this._scheduler,
  ) : _acceptedExpectedHeadingDegrees = acceptedExpectedHeadingDegrees == null
          ? null
          : List.unmodifiable(acceptedExpectedHeadingDegrees),
      _routeNodes = List.unmodifiable(routeNodes) {
    final initialEvaluationState = createWrongWayRerouteState();
    _evaluationState = initialEvaluationState;
    _state = WrongWayRerouteMonitorState(
      isRunning: false,
      result: evaluateWrongWayReroute(
        acceptedExpectedHeadingDegrees: _acceptedExpectedHeadingDegrees,
        config: _config,
        expectedHeadingDegrees: _routePosition.headingDegrees,
        nowMs: _clock.nowMs(),
        observedHeadingDegrees: _observedHeadingDegrees,
        state: initialEvaluationState,
      ),
    );
  }

  List<double>? _acceptedExpectedHeadingDegrees;
  final Clock _clock;
  final WrongWayRerouteConfig _config;
  double _observedHeadingDegrees;
  List<OverlayRouteNode> _routeNodes;
  RoutePosition _routePosition;
  final PeriodicScheduler _scheduler;
  final StreamController<WrongWayRerouteMonitorState> _statesController =
      StreamController<WrongWayRerouteMonitorState>.broadcast(sync: true);

  late WrongWayRerouteState _evaluationState;
  late WrongWayRerouteMonitorState _state;
  PeriodicTaskHandle? _timer;
  bool _disposed = false;
  int _runToken = 0;

  WrongWayRerouteMonitorState get state => _state;

  Stream<WrongWayRerouteMonitorState> get states => _statesController.stream;

  void start() {
    _ensureNotDisposed();
    if (_state.isRunning) {
      return;
    }
    _runToken += 1;
    final token = _runToken;
    _runCheck(isRunning: true, token: token);
    if (_disposed || token != _runToken || !_state.isRunning) {
      return;
    }
    _timer = _scheduler.schedulePeriodic(
      intervalMs: _config.wrongWayCheckIntervalMs,
      callback: () => _runCheck(isRunning: true, token: token),
    );
  }

  void resume() {
    start();
  }

  void pause() {
    _ensureNotDisposed();
    if (!_state.isRunning) {
      return;
    }
    _cancelTimer();
    _emit(WrongWayRerouteMonitorState(isRunning: false, result: _state.result));
  }

  void reset() {
    _ensureNotDisposed();
    _evaluationState = createWrongWayRerouteState();
    final currentResult = _state.result;
    final resetResult = WrongWayRerouteResult(
      candidateNode: currentResult.candidateNode,
      currentNode: currentResult.currentNode,
      isConfidenceOffRoute: currentResult.isConfidenceOffRoute,
      isAtJunction: currentResult.isAtJunction,
      isHeadingOpposite: currentResult.isHeadingOpposite,
      isLegalGraphMovement: currentResult.isLegalGraphMovement,
      oppositeHeadingDurationMs: 0,
      reason: currentResult.reason,
      shouldSuggestReroute: false,
      state: _evaluationState,
    );
    _emit(
      WrongWayRerouteMonitorState(
        isRunning: _state.isRunning,
        result: resetResult,
      ),
    );
  }

  void updateAcceptedExpectedHeadingDegrees(List<double>? headings) {
    _ensureNotDisposed();
    _acceptedExpectedHeadingDegrees = headings == null
        ? null
        : List.unmodifiable(headings);
  }

  void updateObservedHeadingDegrees(double headingDegrees) {
    _ensureNotDisposed();
    _observedHeadingDegrees = headingDegrees;
  }

  void updateRouteNodes(List<OverlayRouteNode> routeNodes) {
    _ensureNotDisposed();
    _routeNodes = List.unmodifiable(routeNodes);
  }

  void updateRoutePosition(RoutePosition routePosition) {
    _ensureNotDisposed();
    _routePosition = routePosition;
  }

  Future<void> dispose() async {
    if (_disposed) {
      return;
    }
    _disposed = true;
    _cancelTimer();
    await _statesController.close();
  }

  void _runCheck({required bool isRunning, required int token}) {
    if (_disposed || token != _runToken) {
      return;
    }
    final currentNode = findCurrentJunctionNode(
      config: _config,
      position: _routePosition,
      routeNodes: _routeNodes,
    );
    final currentRouteNode = currentNode == null
        ? null
        : CurrentRouteNode(nodeId: currentNode.nodeId, type: currentNode.type);
    final result = evaluateWrongWayReroute(
      acceptedExpectedHeadingDegrees: _acceptedExpectedHeadingDegrees,
      config: _config,
      currentNode: currentRouteNode,
      expectedHeadingDegrees: _routePosition.headingDegrees,
      nowMs: _clock.nowMs(),
      observedHeadingDegrees: _observedHeadingDegrees,
      state: _evaluationState,
    );
    _evaluationState = result.state;
    _emit(WrongWayRerouteMonitorState(isRunning: isRunning, result: result));
  }

  void _cancelTimer() {
    _runToken += 1;
    _timer?.cancel();
    _timer = null;
  }

  void _emit(WrongWayRerouteMonitorState nextState) {
    if (_disposed) {
      return;
    }
    _state = nextState;
    _statesController.add(nextState);
  }

  void _ensureNotDisposed() {
    if (_disposed) {
      throw StateError('WrongWayRerouteMonitor is disposed.');
    }
  }
}
