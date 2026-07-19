import 'dart:async';
import 'dart:math' as math;

import 'package:indoor_navigation/application/orchestration/sensors/raw_motion_pdr_engine_state.dart';
import 'package:indoor_navigation/application/ports/debug/sensor_debug_sink.dart';
import 'package:indoor_navigation/application/ports/sensors/sensor_device_manager.dart';
import 'package:indoor_navigation/application/ports/sensors/sensor_models.dart';
import 'package:indoor_navigation/application/ports/time/clock.dart';
import 'package:indoor_navigation/application/ports/time/periodic_scheduler.dart';
import 'package:indoor_navigation/domain/common/angle_math.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/navigation/derived_navigation_estimate.dart';
import 'package:indoor_navigation/domain/navigation_input/logic/motion_sample_heading.dart';
import 'package:indoor_navigation/domain/navigation_input/logic/raw_motion_stats.dart';
import 'package:indoor_navigation/domain/navigation_input/navigation_input_models.dart';
import 'package:indoor_navigation/domain/pdr/algorithms/pdr_pipeline.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';
import 'package:indoor_navigation/domain/sensor_debug/sensor_debug_models.dart';
import 'package:indoor_navigation/domain/tiled/tiled_models.dart';

typedef RawMotionEstimateCallback =
    void Function(DerivedNavigationEstimate estimate);
typedef RawMotionHeadingCallback = void Function(double headingDegrees);

/// Non-Widget orchestration for the transient raw-motion PDR pipeline.
final class RawMotionPdrEngine {
  factory RawMotionPdrEngine({
    required Clock clock,
    required RedMarkerState initialRedMarker,
    required RoutePosition initialRoutePosition,
    required PeriodicScheduler periodicScheduler,
    required SensorDebugSink sensorDebugSink,
    required SensorDeviceManager sensorDeviceManager,
    RawMotionEstimateCallback? onEstimate,
    RawMotionHeadingCallback? onHeading,
  }) {
    return RawMotionPdrEngine._(
      clock,
      initialRedMarker,
      initialRoutePosition,
      periodicScheduler,
      sensorDebugSink,
      sensorDeviceManager,
      onEstimate,
      onHeading,
    );
  }

  RawMotionPdrEngine._(
    this._clock,
    this._initialRedMarker,
    this._routePosition,
    this._periodicScheduler,
    this._sensorDebugSink,
    this._sensorDeviceManager,
    this._onEstimate,
    this._onHeading,
  ) {
    _pdrState = PdrPipelineState(
      headingDegrees: _routePosition.headingDegrees,
      timestampMs: 0,
      x: _initialRedMarker.screenX,
      y: _initialRedMarker.screenY,
    );
    _state = RawMotionPdrEngineState(
      lastPdrResult: null,
      stats: createRawMotionBatchStats(),
      status: RawMotionConsumerStatus.idle,
    );
    _sensorSubscription = _sensorDeviceManager.events.listen(
      _handleSensorEvent,
      onError: _handleSensorError,
      onDone: _handleSensorDone,
    );
  }

  static const int flushIntervalMs = 60;
  static const int headingUpdateIntervalMs = 50;
  static const int motionUpdateIntervalMs = 30;

  final Clock _clock;
  final RedMarkerState _initialRedMarker;
  final RawMotionEstimateCallback? _onEstimate;
  final RawMotionHeadingCallback? _onHeading;
  final PeriodicScheduler _periodicScheduler;
  final SensorDebugSink _sensorDebugSink;
  final SensorDeviceManager _sensorDeviceManager;
  final StreamController<RawMotionPdrEngineState> _stateController =
      StreamController<RawMotionPdrEngineState>();
  late final StreamSubscription<NormalizedSensorEvent> _sensorSubscription;

  final List<MotionInputSample> _rawSamples = [];
  int _debugBatchId = 0;
  String? _debugSessionId;
  bool _disposed = false;
  int _generation = 0;
  bool _hasNewRawSampleSinceFlush = false;
  bool _headingSourceAvailable = false;
  double _headingCorrectionDegrees = 0;
  double? _latestDeviceHeadingDegrees;
  double? _latestHeadingDegrees;
  Future<void> _lifecycleTail = Future<void>.value();
  double? _pixelsPerMeter;
  bool _paused = false;
  late PdrPipelineState _pdrState;
  PeriodicTaskHandle? _flushTask;
  late RoutePosition _routePosition;
  bool _sensorRunActive = false;
  late RawMotionPdrEngineState _state;

  RawMotionPdrEngineState get state => _state;

  Stream<RawMotionPdrEngineState> get states => _stateController.stream;

  double? get latestDeviceHeadingDegrees => _latestDeviceHeadingDegrees;

  void updateRouteContext({
    required double? pixelsPerMeter,
    required RoutePosition routePosition,
  }) {
    _ensureNotDisposed();
    _pixelsPerMeter = pixelsPerMeter;
    _routePosition = routePosition;
  }

  Future<void> start() {
    _ensureNotDisposed();
    _paused = false;
    final generation = _beginNewGeneration();
    _cancelFlushTask();
    _endDebugSession();
    _clearTransientSamples();
    _sensorRunActive = false;
    _publish(status: RawMotionConsumerStatus.starting);

    return _enqueueLifecycle(() => _startGeneration(generation));
  }

  Future<void> _startGeneration(int generation) async {
    if (!_isCurrent(generation)) {
      return;
    }
    try {
      await _sensorDeviceManager.stop();
      _sensorRunActive = false;
      if (!_isCurrent(generation)) {
        return;
      }

      final availability = await _sensorDeviceManager.checkAvailability();
      if (!_isCurrent(generation)) {
        return;
      }
      if (!availability.isMotionAvailable) {
        _publish(status: RawMotionConsumerStatus.unavailable);
        return;
      }
      _headingSourceAvailable = availability.isHeadingAvailable;

      final permission = await _sensorDeviceManager.requestPermissions();
      if (!_isCurrent(generation)) {
        return;
      }
      if (permission != SensorPermissionStatus.granted) {
        _publish(status: RawMotionConsumerStatus.permissionDenied);
        return;
      }

      _sensorRunActive = true;
      await _sensorDeviceManager.start(
        SensorSamplingRequest(
          headingUpdateIntervalMs: headingUpdateIntervalMs,
          motionUpdateIntervalMs: motionUpdateIntervalMs,
        ),
      );
      if (!_isCurrent(generation)) {
        return;
      }
      _flushTask = _periodicScheduler.schedulePeriodic(
        intervalMs: flushIntervalMs,
        callback: _flushBatch,
      );
      final startedAtMs = _clock.nowMs();
      _pdrState = PdrPipelineState(
        backwardConfirmationTimestampMs:
            _pdrState.backwardConfirmationTimestampMs,
        headingDegrees: _pdrState.headingDegrees,
        lastStepTimestampMs: _pdrState.lastStepTimestampMs,
        rotationHeadingSnapshots: _pdrState.rotationHeadingSnapshots,
        rotationHeadingTravelDegrees: _pdrState.rotationHeadingTravelDegrees,
        shakeCooldownUntilMs: _pdrState.shakeCooldownUntilMs,
        shakeSpikeCount: _pdrState.shakeSpikeCount,
        shakeWindowStartedAtMs: _pdrState.shakeWindowStartedAtMs,
        startedAtMs: startedAtMs,
        timestampMs: _pdrState.timestampMs,
        turnInPlaceUntilMs: _pdrState.turnInPlaceUntilMs,
        x: _pdrState.x,
        y: _pdrState.y,
      );
      _debugBatchId = 0;
      _debugSessionId = _createSensorDebugSessionId(startedAtMs);
      _sendDebug(
        () => _sensorDebugSink.sendSessionStart(
          SensorDebugSessionStart(
            configSnapshot: const SensorDebugConfigSnapshot(
              pdr: defaultPdrPipelineConfig,
              rawMotion: rawMotionConsumerConfig,
            ),
            sessionId: _debugSessionId!,
            startedAtMs: startedAtMs,
          ),
        ),
      );
      _publish(status: RawMotionConsumerStatus.running);
    } catch (error) {
      if (!_isCurrent(generation)) {
        return;
      }
      _cancelFlushTask();
      _endDebugSession();
      _clearTransientSamples();
      _sensorRunActive = false;
      _publish(status: _statusForFailure(error));
    }
  }

  Future<void> pause() {
    _ensureNotDisposed();
    _paused = true;
    return _stopCurrentRun();
  }

  Future<void> resume() {
    _ensureNotDisposed();
    if (!_paused) {
      return Future<void>.value();
    }
    return start();
  }

  Future<void> stop() {
    _ensureNotDisposed();
    _paused = false;
    return _stopCurrentRun();
  }

  void reset() {
    _ensureNotDisposed();
    _rawSamples.clear();
    _latestHeadingDegrees = null;
    _latestDeviceHeadingDegrees = null;
    _headingCorrectionDegrees = 0;
    _hasNewRawSampleSinceFlush = false;
    _pdrState = PdrPipelineState(
      headingDegrees: _routePosition.headingDegrees,
      timestampMs: 0,
      x: _initialRedMarker.screenX,
      y: _initialRedMarker.screenY,
    );
    _publish(replaceLastPdrResult: true, stats: createRawMotionBatchStats());
  }

  /// Clears accumulated motion and starts the next PDR batch at a trusted fix.
  ///
  /// Unlike [reset], this does not return to the map's original red marker.
  /// It is used after an authoritative positioning source has corrected the
  /// user's logical route origin.
  void rebase(RoutePosition trustedPosition) {
    _ensureNotDisposed();
    _routePosition = trustedPosition;
    _rawSamples.clear();
    _latestHeadingDegrees = null;
    _latestDeviceHeadingDegrees = null;
    _hasNewRawSampleSinceFlush = false;
    _pdrState = PdrPipelineState(
      headingDegrees: trustedPosition.headingDegrees,
      timestampMs: _clock.nowMs(),
      x: trustedPosition.screenX,
      y: trustedPosition.screenY,
    );
    _publish(replaceLastPdrResult: true, stats: createRawMotionBatchStats());
  }

  /// Applies a floor-coordinate correction to subsequent device headings.
  void setHeadingCorrectionDegrees(double correctionDegrees) {
    _ensureNotDisposed();
    _headingCorrectionDegrees = normalizeDegrees(correctionDegrees);
    final deviceHeading = _latestDeviceHeadingDegrees;
    if (deviceHeading != null) {
      _publishCorrectedHeading(deviceHeading);
    }
  }

  Future<void> dispose() {
    if (_disposed) {
      return Future<void>.value();
    }
    _generation += 1;
    _disposed = true;
    _paused = false;
    _cancelFlushTask();
    _endDebugSession();
    _clearTransientSamples(publish: false);
    return _enqueueLifecycle(() async {
      await _sensorSubscription.cancel();
      try {
        await _sensorDeviceManager.dispose();
      } finally {
        final hasListener = _stateController.hasListener;
        final closeFuture = _stateController.close();
        if (hasListener) {
          await closeFuture;
        }
      }
    });
  }

  Future<void> _stopCurrentRun() {
    final previousStatus = _state.status;
    _beginNewGeneration();
    _cancelFlushTask();
    _endDebugSession();
    _clearTransientSamples();
    _sensorRunActive = false;
    if (previousStatus == RawMotionConsumerStatus.running ||
        previousStatus == RawMotionConsumerStatus.starting) {
      _publish(status: RawMotionConsumerStatus.stopped);
    }
    return _enqueueLifecycle(() async {
      try {
        await _sensorDeviceManager.stop();
      } catch (_) {
        if (!_disposed) {
          _publish(status: RawMotionConsumerStatus.error);
        }
      }
    });
  }

  void _handleSensorEvent(NormalizedSensorEvent event) {
    if (_disposed ||
        !_sensorRunActive ||
        (_state.status != RawMotionConsumerStatus.starting &&
            _state.status != RawMotionConsumerStatus.running)) {
      return;
    }
    switch (event) {
      case HeadingSensorEvent(:final headingDegrees):
        _updateHeading(headingDegrees);
      case MotionSensorEvent(
        :final accelerationMetersPerSecondSquared,
        :final fallbackHeadingDegrees,
        :final receivedAtMs,
      ):
        if (!_headingSourceAvailable && fallbackHeadingDegrees != null) {
          _updateHeading(fallbackHeadingDegrees);
        }
        final sample = applyLiveHeadingToMotionSample(
          liveHeadingDegrees: _latestHeadingDegrees,
          sample: MotionInputSample(
            acceleration: accelerationMetersPerSecondSquared,
            headingDegrees:
                fallbackHeadingDegrees ?? _routePosition.headingDegrees,
            timestampMs: receivedAtMs,
          ),
        );
        _rawSamples.add(sample);
        if (_rawSamples.length > navigationInputPolicy.maxRawSamplesInMemory) {
          _rawSamples.removeRange(
            0,
            _rawSamples.length - navigationInputPolicy.maxRawSamplesInMemory,
          );
        }
        _hasNewRawSampleSinceFlush = true;
        _publish(
          stats: updateRawMotionStatsAfterSensorEvent(
            currentStats: _state.stats,
            rawSamplesInMemory: _rawSamples.length,
          ),
        );
    }
  }

  void _handleSensorError(Object error, StackTrace stackTrace) {
    if (_disposed || !_sensorRunActive) {
      return;
    }
    if (error is SensorDeviceException &&
        error.code == SensorDeviceErrorCode.streamFailed) {
      return;
    }
    _sensorRunActive = false;
    _beginNewGeneration();
    _cancelFlushTask();
    _endDebugSession();
    _clearTransientSamples();
    _publish(status: RawMotionConsumerStatus.error);
  }

  void _handleSensorDone() {
    if (_disposed || !_sensorRunActive) {
      return;
    }
    _sensorRunActive = false;
    _beginNewGeneration();
    _cancelFlushTask();
    _endDebugSession();
    _clearTransientSamples();
    _publish(status: RawMotionConsumerStatus.error);
  }

  void _updateHeading(double headingDegrees) {
    _latestDeviceHeadingDegrees = headingDegrees;
    _publishCorrectedHeading(headingDegrees);
  }

  void _publishCorrectedHeading(double deviceHeadingDegrees) {
    final correctedHeading = normalizeDegrees(
      deviceHeadingDegrees + _headingCorrectionDegrees,
    );
    _latestHeadingDegrees = correctedHeading;
    _onHeading?.call(correctedHeading);
    _publish(
      stats: updateRawMotionStatsAfterHeading(
        currentStats: _state.stats,
        headingDegrees: correctedHeading,
      ),
    );
  }

  void _flushBatch() {
    if (_disposed ||
        !_sensorRunActive ||
        _state.status != RawMotionConsumerStatus.running ||
        _rawSamples.isEmpty ||
        !_hasNewRawSampleSinceFlush) {
      return;
    }
    final nowMs = _clock.nowMs();
    final samples = List<MotionInputSample>.unmodifiable(_rawSamples);
    final retentionWindowMs = math.max(
      defaultPdrPipelineConfig.batchWindowMs,
      defaultPdrPipelineConfig.maxBatchAgeMs,
    );
    _rawSamples.removeWhere(
      (sample) => nowMs - sample.timestampMs > retentionWindowMs,
    );
    if (_rawSamples.length > navigationInputPolicy.maxRawSamplesInMemory) {
      _rawSamples.removeRange(
        0,
        _rawSamples.length - navigationInputPolicy.maxRawSamplesInMemory,
      );
    }
    _hasNewRawSampleSinceFlush = false;
    final result = runPdrPipeline(
      desiredHeadingDegrees: _routePosition.headingDegrees,
      nowMs: nowMs,
      pixelsPerMeter: _pixelsPerMeter,
      previousState: _pdrState,
      samples: samples,
    );
    _pdrState = result.nextState;
    _publish(
      lastPdrResult: result,
      replaceLastPdrResult: true,
      stats: updateRawMotionStatsAfterFlush(
        acceptedSampleCount: result.acceptedSampleCount,
        currentStats: _state.stats,
        droppedSampleCount: result.droppedSampleCount,
        latencyMs: result.latencyMs,
        rawSamplesInMemory: _rawSamples.length,
      ),
    );
    final sessionId = _debugSessionId;
    if (sessionId != null) {
      _debugBatchId += 1;
      _sendDebug(
        () => _sensorDebugSink.sendBatchLog(
          SensorDebugBatchLog(
            batchId: _debugBatchId,
            diagnostics: result.diagnostics,
            sessionId: sessionId,
            timestampMs: nowMs,
          ),
        ),
      );
    }
    _onEstimate?.call(result.estimate);
  }

  int _beginNewGeneration() {
    _generation += 1;
    return _generation;
  }

  bool _isCurrent(int generation) => !_disposed && generation == _generation;

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

  void _cancelFlushTask() {
    _flushTask?.cancel();
    _flushTask = null;
  }

  void _clearTransientSamples({bool publish = true}) {
    _rawSamples.clear();
    _latestDeviceHeadingDegrees = null;
    _latestHeadingDegrees = null;
    _hasNewRawSampleSinceFlush = false;
    _headingSourceAvailable = false;
    if (publish && _state.stats.rawSamplesInMemory != 0) {
      _publish(
        stats: RawMotionBatchStats(
          lastAcceptedSampleCount: _state.stats.lastAcceptedSampleCount,
          lastDroppedSampleCount: _state.stats.lastDroppedSampleCount,
          lastHeadingDegrees: _state.stats.lastHeadingDegrees,
          lastLatencyMs: _state.stats.lastLatencyMs,
          rawSamplesInMemory: 0,
          totalBatches: _state.stats.totalBatches,
          totalRawSamplesSeen: _state.stats.totalRawSamplesSeen,
        ),
      );
    }
  }

  void _endDebugSession() {
    final sessionId = _debugSessionId;
    if (sessionId == null) {
      return;
    }
    _debugSessionId = null;
    _sendDebug(
      () => _sensorDebugSink.sendSessionStop(
        SensorDebugSessionStop(endedAtMs: _clock.nowMs(), sessionId: sessionId),
      ),
    );
  }

  void _sendDebug(void Function() send) {
    try {
      send();
    } catch (_) {
      // Debug output is deliberately best-effort and never controls PDR.
    }
  }

  void _publish({
    PdrPipelineResult? lastPdrResult,
    bool replaceLastPdrResult = false,
    RawMotionBatchStats? stats,
    RawMotionConsumerStatus? status,
  }) {
    _state = RawMotionPdrEngineState(
      lastPdrResult: replaceLastPdrResult
          ? lastPdrResult
          : _state.lastPdrResult,
      stats: stats ?? _state.stats,
      status: status ?? _state.status,
    );
    final generation = _generation;
    final published = _state;
    scheduleMicrotask(() {
      if (!_disposed && generation == _generation) {
        _stateController.add(published);
      }
    });
  }

  RawMotionConsumerStatus _statusForFailure(Object error) {
    if (error is SensorDeviceException) {
      return switch (error.code) {
        SensorDeviceErrorCode.unavailable =>
          RawMotionConsumerStatus.unavailable,
        SensorDeviceErrorCode.permissionDenied ||
        SensorDeviceErrorCode.permissionRestricted =>
          RawMotionConsumerStatus.permissionDenied,
        _ => RawMotionConsumerStatus.error,
      };
    }
    return RawMotionConsumerStatus.error;
  }

  void _ensureNotDisposed() {
    if (_disposed) {
      throw StateError('RawMotionPdrEngine is disposed.');
    }
  }
}

String _createSensorDebugSessionId(int nowMs) {
  final iso = DateTime.fromMillisecondsSinceEpoch(
    nowMs,
    isUtc: true,
  ).toIso8601String();
  final withoutMilliseconds = iso.replaceFirst(RegExp(r'\.\d{3}Z$'), 'Z');
  return 'step-test-${withoutMilliseconds.replaceAll(':', '-')}';
}
