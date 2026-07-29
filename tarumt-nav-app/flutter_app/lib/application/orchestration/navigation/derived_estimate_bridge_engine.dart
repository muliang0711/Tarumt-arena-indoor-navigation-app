import 'dart:async';

import 'package:indoor_navigation/application/ports/time/clock.dart';
import 'package:indoor_navigation/domain/navigation/derived_navigation_estimate.dart';
import 'package:indoor_navigation/domain/navigation_input/logic/debug_replay_estimate.dart';
import 'package:indoor_navigation/domain/navigation_input/logic/derived_estimate_buffer.dart';
import 'package:indoor_navigation/domain/navigation_input/logic/derived_estimate_marker.dart';
import 'package:indoor_navigation/domain/navigation_input/navigation_input_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

final class DerivedEstimateBridgeState {
  const DerivedEstimateBridgeState({
    required this.buffer,
    required this.headingOnlyDegrees,
    required this.lastResult,
    required this.latestEstimate,
    required this.observedHeadingDegrees,
    required this.redMarker,
    required this.replaySequenceIndex,
    required this.routePosition,
    required this.surface,
  });

  final DerivedEstimateBuffer buffer;
  final double? headingOnlyDegrees;
  final DerivedEstimateIngestResult? lastResult;
  final DerivedNavigationEstimate? latestEstimate;
  final double? observedHeadingDegrees;
  final RedMarkerState redMarker;
  final int replaySequenceIndex;
  final RoutePosition routePosition;
  final SurfaceRect surface;
}

final class DerivedEstimateBridgeEngine {
  DerivedEstimateBridgeEngine({
    required this.clock,
    required this.initialRedMarker,
    required RoutePosition routePosition,
    required SurfaceRect surface,
  }) {
    _state = _createState(
      buffer: createDerivedEstimateBuffer(),
      headingOnlyDegrees: null,
      lastResult: null,
      replaySequenceIndex: 0,
      routePosition: routePosition,
      surface: surface,
    );
  }

  final Clock clock;
  final RedMarkerState initialRedMarker;
  final StreamController<DerivedEstimateBridgeState> _statesController =
      StreamController<DerivedEstimateBridgeState>.broadcast(sync: true);

  late DerivedEstimateBridgeState _state;
  bool _disposed = false;

  DerivedEstimateBridgeState get state => _state;

  Stream<DerivedEstimateBridgeState> get states => _statesController.stream;

  DerivedEstimateIngestResult ingestExternalEstimate(
    DerivedNavigationEstimate estimate,
  ) {
    _ensureNotDisposed();
    final result = ingestDerivedEstimate(
      buffer: _state.buffer,
      estimate: estimate,
    );
    _emit(
      _createState(
        buffer: result.buffer,
        headingOnlyDegrees: _state.headingOnlyDegrees,
        lastResult: result,
        replaySequenceIndex: _state.replaySequenceIndex,
        routePosition: _state.routePosition,
        surface: _state.surface,
      ),
    );
    return result;
  }

  DerivedEstimateIngestResult runReplayStep() {
    _ensureNotDisposed();
    final estimate = createDebugReplayEstimate(
      nowMs: clock.nowMs(),
      routePosition: _state.routePosition,
      sequenceIndex: _state.replaySequenceIndex,
    );
    final result = ingestDerivedEstimate(
      buffer: _state.buffer,
      estimate: estimate,
    );
    _emit(
      _createState(
        buffer: result.buffer,
        headingOnlyDegrees: _state.headingOnlyDegrees,
        lastResult: result,
        replaySequenceIndex: _state.replaySequenceIndex + 1,
        routePosition: _state.routePosition,
        surface: _state.surface,
      ),
    );
    return result;
  }

  void updateHeadingOnly(double? headingDegrees) {
    _ensureNotDisposed();
    if (_state.headingOnlyDegrees == headingDegrees) {
      return;
    }
    _emit(
      _createState(
        buffer: _state.buffer,
        headingOnlyDegrees: headingDegrees,
        lastResult: _state.lastResult,
        replaySequenceIndex: _state.replaySequenceIndex,
        routePosition: _state.routePosition,
        surface: _state.surface,
      ),
    );
  }

  void updateRoutePosition(RoutePosition routePosition) {
    _ensureNotDisposed();
    _emit(
      _createState(
        buffer: _state.buffer,
        headingOnlyDegrees: _state.headingOnlyDegrees,
        lastResult: _state.lastResult,
        replaySequenceIndex: _state.replaySequenceIndex,
        routePosition: routePosition,
        surface: _state.surface,
      ),
    );
  }

  void reset() {
    _ensureNotDisposed();
    _emit(
      _createState(
        buffer: createDerivedEstimateBuffer(),
        headingOnlyDegrees: null,
        lastResult: null,
        replaySequenceIndex: 0,
        routePosition: _state.routePosition,
        surface: _state.surface,
      ),
    );
  }

  Future<void> dispose() async {
    if (_disposed) {
      return;
    }
    _disposed = true;
    await _statesController.close();
  }

  DerivedEstimateBridgeState _createState({
    required DerivedEstimateBuffer buffer,
    required double? headingOnlyDegrees,
    required DerivedEstimateIngestResult? lastResult,
    required int replaySequenceIndex,
    required RoutePosition routePosition,
    required SurfaceRect surface,
  }) {
    final latestEstimate = getLatestDerivedEstimate(buffer);
    final baseMarker = latestEstimate == null
        ? initialRedMarker
        : redMarkerFromDerivedEstimate(latestEstimate, surface);
    final redMarker = headingOnlyDegrees == null
        ? baseMarker
        : RedMarkerState(
            headingDegrees: headingOnlyDegrees,
            screenX: baseMarker.screenX,
            screenY: baseMarker.screenY,
            tiledX: baseMarker.tiledX,
            tiledY: baseMarker.tiledY,
          );
    return DerivedEstimateBridgeState(
      buffer: buffer,
      headingOnlyDegrees: headingOnlyDegrees,
      lastResult: lastResult,
      latestEstimate: latestEstimate,
      observedHeadingDegrees:
          headingOnlyDegrees ?? latestEstimate?.headingDegrees,
      redMarker: redMarker,
      replaySequenceIndex: replaySequenceIndex,
      routePosition: routePosition,
      surface: surface,
    );
  }

  void _emit(DerivedEstimateBridgeState nextState) {
    if (_disposed) {
      return;
    }
    _state = nextState;
    _statesController.add(nextState);
  }

  void _ensureNotDisposed() {
    if (_disposed) {
      throw StateError('DerivedEstimateBridgeEngine is disposed.');
    }
  }
}
