import 'dart:async';
import 'dart:math' as math;

import 'package:indoor_navigation/application/ports/time/periodic_scheduler.dart';
import 'package:indoor_navigation/domain/simulation/simulation_models.dart';
import 'package:indoor_navigation/domain/tiled/route/route_progress.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

const routeSimulationTickMs = 100;
const routeSimulationSpeedPixelsPerSecond = 140.0;
const routeSimulationStepPixels = 96.0;

final class RouteSimulationState {
  RouteSimulationState({
    required this.distanceRemainingPixels,
    required List<OverlayPathSegment> remainingPathSegments,
    required this.routeDistancePixels,
    required this.routePosition,
    required this.routeProgressPixels,
    required this.status,
  }) : remainingPathSegments = List.unmodifiable(remainingPathSegments);

  final double distanceRemainingPixels;
  final List<OverlayPathSegment> remainingPathSegments;
  final double routeDistancePixels;
  final RoutePosition routePosition;
  final double routeProgressPixels;
  final SimulationStatus status;
}

final class RouteSimulationEngine {
  RouteSimulationEngine({
    required this.scheduler,
    required List<OverlayPoint> routePath,
  }) : _routePath = List.unmodifiable(routePath),
       _routeDistancePixels = calculateRouteDistance(routePath) {
    if (routePath.isEmpty) {
      throw ArgumentError.value(routePath, 'routePath', 'must not be empty');
    }
    _state = _createState(status: SimulationStatus.ready, progressPixels: 0);
  }

  List<OverlayPoint> _routePath;
  double _routeDistancePixels;
  final PeriodicScheduler scheduler;
  final StreamController<RouteSimulationState> _statesController =
      StreamController<RouteSimulationState>.broadcast(sync: true);

  late RouteSimulationState _state;
  PeriodicTaskHandle? _timer;
  bool _disposed = false;
  int _runToken = 0;

  RouteSimulationState get state => _state;

  Stream<RouteSimulationState> get states => _statesController.stream;

  void start() {
    _ensureNotDisposed();
    if (_state.status == SimulationStatus.moving) {
      return;
    }
    final progress = _state.routeProgressPixels >= _routeDistancePixels
        ? 0.0
        : _state.routeProgressPixels;
    _beginMoving(progress);
  }

  void resume() {
    _ensureNotDisposed();
    if (_state.status != SimulationStatus.paused) {
      return;
    }
    _beginMoving(_state.routeProgressPixels);
  }

  void pause() {
    _ensureNotDisposed();
    if (_state.status == SimulationStatus.arrived ||
        _state.status == SimulationStatus.paused) {
      return;
    }
    _cancelTimer();
    _emit(
      _createState(
        status: SimulationStatus.paused,
        progressPixels: _state.routeProgressPixels,
      ),
    );
  }

  void stepForward() {
    _ensureNotDisposed();
    _cancelTimer();
    final progress = math.min(
      _routeDistancePixels,
      _state.routeProgressPixels + routeSimulationStepPixels,
    );
    _emit(
      _createState(
        status: progress >= _routeDistancePixels
            ? SimulationStatus.arrived
            : SimulationStatus.paused,
        progressPixels: progress,
      ),
    );
  }

  void reset() {
    _ensureNotDisposed();
    _cancelTimer();
    if (_state.status == SimulationStatus.ready &&
        _state.routeProgressPixels == 0) {
      return;
    }
    _emit(_createState(status: SimulationStatus.ready, progressPixels: 0));
  }

  void replaceRoutePath(List<OverlayPoint> routePath) {
    _ensureNotDisposed();
    if (routePath.isEmpty) {
      throw ArgumentError.value(routePath, 'routePath', 'must not be empty');
    }
    _cancelTimer();
    _routePath = List.unmodifiable(routePath);
    _routeDistancePixels = calculateRouteDistance(routePath);
    _emit(_createState(status: SimulationStatus.ready, progressPixels: 0));
  }

  Future<void> dispose() async {
    if (_disposed) {
      return;
    }
    _disposed = true;
    _cancelTimer();
    await _statesController.close();
  }

  void _beginMoving(double progressPixels) {
    _cancelTimer();
    _emit(
      _createState(
        status: SimulationStatus.moving,
        progressPixels: progressPixels,
      ),
    );
    final token = _runToken;
    if (_disposed || _state.status != SimulationStatus.moving) {
      return;
    }
    _timer = scheduler.schedulePeriodic(
      intervalMs: routeSimulationTickMs,
      callback: () => _tick(token),
    );
  }

  void _tick(int token) {
    if (_disposed ||
        token != _runToken ||
        _state.status != SimulationStatus.moving) {
      return;
    }
    final progress = math.min(
      _routeDistancePixels,
      _state.routeProgressPixels +
          (routeSimulationSpeedPixelsPerSecond * routeSimulationTickMs) / 1000,
    );
    final arrived = progress >= _routeDistancePixels;
    if (arrived) {
      _cancelTimer();
    }
    _emit(
      _createState(
        status: arrived ? SimulationStatus.arrived : SimulationStatus.moving,
        progressPixels: progress,
      ),
    );
  }

  RouteSimulationState _createState({
    required SimulationStatus status,
    required double progressPixels,
  }) {
    return RouteSimulationState(
      distanceRemainingPixels: math.max(
        0,
        _routeDistancePixels - progressPixels,
      ),
      remainingPathSegments: createRemainingRouteSegments(
        _routePath,
        progressPixels,
      ),
      routeDistancePixels: _routeDistancePixels,
      routePosition: interpolateRoutePosition(_routePath, progressPixels),
      routeProgressPixels: progressPixels,
      status: status,
    );
  }

  void _cancelTimer() {
    _runToken += 1;
    _timer?.cancel();
    _timer = null;
  }

  void _emit(RouteSimulationState nextState) {
    if (_disposed) {
      return;
    }
    _state = nextState;
    _statesController.add(nextState);
  }

  void _ensureNotDisposed() {
    if (_disposed) {
      throw StateError('RouteSimulationEngine is disposed.');
    }
  }
}
