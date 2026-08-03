// ignore_for_file: prefer_initializing_formals

import 'dart:async';

import 'package:indoor_navigation/application/orchestration/journey/journey_lifecycle_coordinator.dart';
import 'package:indoor_navigation/application/ports/presence/presence_repository.dart';
import 'package:indoor_navigation/application/ports/time/clock.dart';
import 'package:indoor_navigation/application/view_models/indoor_navigation_view_state.dart';
import 'package:indoor_navigation/application/view_models/view_model_models.dart';
import 'package:indoor_navigation/domain/common/geometry_math.dart';
import 'package:indoor_navigation/domain/journey/journey.dart';
import 'package:indoor_navigation/domain/presence/presence_connection.dart';
import 'package:indoor_navigation/domain/presence/presence_models.dart';

const presencePublishIntervalMs = 500;

final class RealtimePresenceCoordinator {
  RealtimePresenceCoordinator({
    required String buildingId,
    required Clock clock,
    required PresenceRepository repository,
    JourneyLifecycleCoordinator? journeyCoordinator,
  }) : _buildingId = buildingId,
       _clock = clock,
       _repository = repository,
       _journeys = journeyCoordinator {
    _connectionSubscription = _repository.connectionStates.listen(
      _handleConnectionState,
    );
  }

  final String _buildingId;
  final Clock _clock;
  final PresenceRepository _repository;
  final JourneyLifecycleCoordinator? _journeys;

  late final StreamSubscription<PresenceConnectionState>
  _connectionSubscription;

  int _lastPublishAtMs = -presencePublishIntervalMs;
  LocalPresencePosition? _lastPublished;
  int? _endedNavigationSessionId;
  bool _disposed = false;
  bool _foreground = false;
  bool _publishingNavigation = false;
  String? _observedFloorId;
  String? _latestNavigationFloorId;
  IndoorNavigationViewState? _latestNavigationState;

  Stream<PresenceSnapshot> get trafficSnapshots => _repository.snapshots;

  Future<void> start() => resume();

  Future<void> resume() async {
    if (_disposed || _foreground) return;
    _foreground = true;
    await _repository.connect();
    await _journeys?.resume();
  }

  Future<void> pause() async {
    if (_disposed || !_foreground) return;
    _foreground = false;
    if (_publishingNavigation) await _repository.leave();
    _publishingNavigation = false;
    _lastPublished = null;
    await _repository.disconnect();
  }

  Future<void> updateNavigation({
    required String floorId,
    required IndoorNavigationViewState state,
  }) async {
    if (_disposed || !_foreground) return;
    _latestNavigationFloorId = floorId;
    _latestNavigationState = state;
    final sessionId = state.navigationSessionId;
    if (sessionId != null && sessionId == _endedNavigationSessionId) return;
    final journeys = _journeys;
    if (journeys != null &&
        state.navigationSessionStatus == NavigationSessionStatus.arrived) {
      await journeys.end(JourneyOutcome.arrived);
    }
    final position = _mapNavigationPosition(state, floorId);
    if (position == null) {
      if (_publishingNavigation) {
        _publishingNavigation = false;
        _lastPublished = null;
        await _repository.leave();
      }
      if (_observedFloorId != null) {
        _observedFloorId = null;
        await _repository.stop();
      }
      return;
    }
    if (_observedFloorId != floorId) {
      _observedFloorId = floorId;
      try {
        await _repository.start(buildingId: _buildingId, floorId: floorId);
      } catch (_) {
        if (_observedFloorId == floorId) _observedFloorId = null;
        rethrow;
      }
    }
    if (journeys != null && sessionId != null) {
      final route = _plannedRoute(state);
      if (route == null) return;
      final ready = await journeys.synchronizeNavigation(
        navigationSessionId: sessionId,
        route: route,
      );
      if (!ready) return;
    }
    final now = _clock.nowMs();
    if (now - _lastPublishAtMs < presencePublishIntervalMs ||
        !_isMeaningfulChange(_lastPublished, position)) {
      return;
    }
    _publishingNavigation = true;
    _lastPublishAtMs = now;
    _lastPublished = position;
    await _repository.publishLocation(position);
  }

  /// Ends only this device's navigation presence while keeping its app
  /// connection alive for the Live Map and app-wide occupancy count.
  Future<void> endNavigationPresence({int? navigationSessionId}) async {
    if (_disposed) return;
    _endedNavigationSessionId =
        navigationSessionId ?? _endedNavigationSessionId;
    final shouldLeave = _publishingNavigation;
    _publishingNavigation = false;
    _lastPublished = null;
    _lastPublishAtMs = -presencePublishIntervalMs;
    _latestNavigationFloorId = null;
    _latestNavigationState = null;
    await _journeys?.end(JourneyOutcome.cancelled);
    if (shouldLeave) await _repository.leave();
    if (_observedFloorId != null) {
      _observedFloorId = null;
      await _repository.stop();
    }
  }

  LocalPresencePosition? _mapNavigationPosition(
    IndoorNavigationViewState state,
    String floorId,
  ) {
    if (state.navigationSessionStatus != NavigationSessionStatus.navigating) {
      return null;
    }
    final routePosition = state.blueMarkerPosition;
    final route = state.bootstrap?.mapModel.routePath;
    if (routePosition == null || route == null || route.length < 2) return null;
    final segmentIndex = routePosition.segmentIndex.clamp(0, route.length - 2);
    final from = route[segmentIndex];
    final to = route[segmentIndex + 1];
    final length = distanceBetweenPoints(from, to);
    final progress = length <= 0
        ? 0.0
        : (distanceBetweenPoints(from, routePosition) / length)
              .clamp(0, 1)
              .toDouble();
    return LocalPresencePosition(
      buildingId: _buildingId,
      edgeProgress: progress,
      floorId: floorId,
      fromNodeId: from.nodeId,
      headingDegrees: routePosition.headingDegrees,
      movementState: PresenceMovementState.walking,
      observedAt: DateTime.fromMillisecondsSinceEpoch(
        _clock.nowMs(),
        isUtc: true,
      ),
      toNodeId: to.nodeId,
    );
  }

  bool _isMeaningfulChange(
    LocalPresencePosition? previous,
    LocalPresencePosition next,
  ) {
    if (previous == null ||
        previous.floorId != next.floorId ||
        previous.fromNodeId != next.fromNodeId ||
        previous.toNodeId != next.toNodeId) {
      return true;
    }
    return (previous.edgeProgress - next.edgeProgress).abs() >= 0.01 ||
        (previous.headingDegrees - next.headingDegrees).abs() >= 5;
  }

  PlannedJourneyRoute? _plannedRoute(IndoorNavigationViewState state) {
    final data = state.bootstrap;
    final nodes = data?.mapModel.routePath;
    if (data == null || nodes == null || nodes.length < 2) return null;
    final edgeIds = <String>[];
    for (var index = 0; index < nodes.length - 1; index += 1) {
      final from = nodes[index].nodeId;
      final to = nodes[index + 1].nodeId;
      final edge = data.edges
          .where(
            (candidate) =>
                (candidate.from == from && candidate.to == to) ||
                (candidate.from == to && candidate.to == from),
          )
          .firstOrNull;
      if (edge == null) return null;
      edgeIds.add(edge.id);
    }
    return PlannedJourneyRoute(
      originNodeId: nodes.first.nodeId,
      destinationNodeId: nodes.last.nodeId,
      plannedEdgeIds: edgeIds,
    );
  }

  void _handleConnectionState(PresenceConnectionState connection) {
    if (!connection.isConnected || !_foreground || _disposed) return;
    final floorId = _latestNavigationFloorId;
    final state = _latestNavigationState;
    if (floorId == null || state == null) return;
    _lastPublished = null;
    _lastPublishAtMs = -presencePublishIntervalMs;
    unawaited(
      updateNavigation(floorId: floorId, state: state).catchError((
        Object error,
        StackTrace stackTrace,
      ) {
        // A later navigation state or reconnect will retry this synchronization.
      }),
    );
  }

  Future<void> dispose() async {
    if (_disposed) return;
    await pause();
    _disposed = true;
    await _connectionSubscription.cancel();
    await _journeys?.dispose();
    await _repository.dispose();
  }
}
