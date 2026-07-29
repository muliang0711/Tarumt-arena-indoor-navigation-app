import 'dart:async';

import 'package:indoor_navigation/application/ports/sensors/sensor_device_manager.dart';
import 'package:indoor_navigation/application/ports/sensors/sensor_models.dart';
import 'package:indoor_navigation/application/ports/time/clock.dart';
import 'package:indoor_navigation/infrastructure/sensors/core_motion_channel_client.dart';
import 'package:indoor_navigation/infrastructure/sensors/core_motion_channel_contract.dart';
import 'package:indoor_navigation/infrastructure/sensors/core_motion_channel_decoder.dart';

final class CoreMotionSensorDeviceManager implements SensorDeviceManager {
  factory CoreMotionSensorDeviceManager({required Clock clock}) {
    return CoreMotionSensorDeviceManager._(
      clock,
      FlutterCoreMotionChannelClient(),
    );
  }

  factory CoreMotionSensorDeviceManager.withClient({
    required Clock clock,
    required CoreMotionChannelClient client,
  }) {
    return CoreMotionSensorDeviceManager._(clock, client);
  }

  CoreMotionSensorDeviceManager._(this._clock, this._client) {
    _channelSubscription = _client.events.listen(
      _handleRawEvent,
      onError: _handleTransportError,
      onDone: _handleTransportDone,
    );
  }

  final CoreMotionChannelClient _client;
  final Clock _clock;
  final StreamController<NormalizedSensorEvent> _eventController =
      StreamController<NormalizedSensorEvent>();
  late final StreamSubscription<Object?> _channelSubscription;

  int? _activeGeneration;
  int _deliveryToken = 0;
  bool _disposed = false;
  int _lastGeneration = 0;
  bool _running = false;

  @override
  Stream<NormalizedSensorEvent> get events => _eventController.stream;

  @override
  Future<SensorAvailability> checkAvailability() async {
    _ensureNotDisposed();
    try {
      final raw = await _client.invokeMethod(
        CoreMotionChannelContract.checkAvailabilityMethod,
      );
      return CoreMotionChannelDecoder.decodeAvailability(raw);
    } catch (error) {
      throw _typedFailure(
        error,
        fallbackCode: SensorDeviceErrorCode.unavailable,
        operation: 'availability check',
      );
    }
  }

  @override
  Future<SensorPermissionStatus> requestPermissions() async {
    _ensureNotDisposed();
    try {
      final raw = await _client.invokeMethod(
        CoreMotionChannelContract.requestPermissionsMethod,
      );
      return CoreMotionChannelDecoder.decodePermission(raw);
    } catch (error) {
      throw _typedFailure(
        error,
        fallbackCode: SensorDeviceErrorCode.permissionDenied,
        operation: 'permission request',
      );
    }
  }

  @override
  Future<void> start(SensorSamplingRequest request) async {
    _ensureNotDisposed();
    final previousGeneration = _activeGeneration;
    _invalidateRun();

    if (previousGeneration != null) {
      // `_invalidateRun` always clears `_running`; the generation indicates
      // whether there was a run that native code still needs to stop.
      try {
        final raw = await _client.invokeMethod(
          CoreMotionChannelContract.stopMethod,
          arguments: _generationArguments(previousGeneration),
        );
        CoreMotionChannelDecoder.expectControlResponse(raw, 'stop');
      } catch (error) {
        throw _typedFailure(
          error,
          fallbackCode: SensorDeviceErrorCode.startFailed,
          operation: 'replacement stop',
        );
      }
    }

    final generation = ++_lastGeneration;
    final token = _deliveryToken;
    _activeGeneration = generation;
    _running = true;
    try {
      final raw = await _client.invokeMethod(
        CoreMotionChannelContract.startMethod,
        arguments: <String, Object?>{
          'schemaVersion': CoreMotionChannelContract.schemaVersion,
          'generation': generation,
          'motionUpdateIntervalMs': request.motionUpdateIntervalMs,
          'headingUpdateIntervalMs': request.headingUpdateIntervalMs,
        },
      );
      CoreMotionChannelDecoder.expectControlResponse(raw, 'start');
    } catch (error) {
      if (_deliveryToken == token && _activeGeneration == generation) {
        _invalidateRun();
      }
      throw _typedFailure(
        error,
        fallbackCode: SensorDeviceErrorCode.startFailed,
        operation: 'start',
      );
    }
  }

  @override
  Future<void> stop() async {
    _ensureNotDisposed();
    final generation = _activeGeneration;
    if (generation == null) {
      return;
    }
    _invalidateRun();
    try {
      final raw = await _client.invokeMethod(
        CoreMotionChannelContract.stopMethod,
        arguments: _generationArguments(generation),
      );
      CoreMotionChannelDecoder.expectControlResponse(raw, 'stop');
    } catch (error) {
      throw _typedFailure(
        error,
        fallbackCode: SensorDeviceErrorCode.streamFailed,
        operation: 'stop',
      );
    }
  }

  @override
  Future<void> dispose() async {
    if (_disposed) {
      return;
    }
    final generation = _activeGeneration ?? _lastGeneration;
    _disposed = true;
    _running = false;
    _activeGeneration = null;
    _deliveryToken += 1;

    Object? failure;
    try {
      final raw = await _client.invokeMethod(
        CoreMotionChannelContract.disposeMethod,
        arguments: _generationArguments(generation),
      );
      CoreMotionChannelDecoder.expectControlResponse(raw, 'dispose');
    } catch (error) {
      failure = _typedFailure(
        error,
        fallbackCode: SensorDeviceErrorCode.streamFailed,
        operation: 'dispose',
      );
    } finally {
      await _channelSubscription.cancel();
      final hasEventListener = _eventController.hasListener;
      final closeFuture = _eventController.close();
      // A single-subscription controller's close future does not complete
      // until its stream is listened to. Disposal must still complete when a
      // consumer never subscribed.
      if (hasEventListener) {
        await closeFuture;
      }
    }
    if (failure != null) {
      throw failure;
    }
  }

  Map<String, Object?> _generationArguments(int generation) {
    return <String, Object?>{
      'schemaVersion': CoreMotionChannelContract.schemaVersion,
      'generation': generation,
    };
  }

  void _handleRawEvent(Object? raw) {
    if (!_running || _disposed) {
      return;
    }
    final generation = _activeGeneration;
    if (generation == null) {
      return;
    }
    final token = _deliveryToken;
    try {
      final decoded = CoreMotionChannelDecoder.decodeEvent(
        raw,
        receivedAtMs: _clock.nowMs(),
      );
      if (decoded.generation != generation) {
        return;
      }
      switch (decoded) {
        case CoreMotionDecodedSensorEvent(:final event):
          _queueEvent(event, generation: generation, token: token);
        case CoreMotionDecodedErrorEvent(:final error, :final interrupted):
          if (interrupted) {
            _running = false;
            _activeGeneration = null;
            _queueError(error, token: token);
          } else {
            _queueError(
              error,
              generation: generation,
              requireActiveRun: true,
              token: token,
            );
          }
      }
    } catch (error) {
      _queueError(
        _typedFailure(
          error,
          fallbackCode: SensorDeviceErrorCode.streamFailed,
          operation: 'event decode',
        ),
        generation: generation,
        requireActiveRun: true,
        token: token,
      );
    }
  }

  void _handleTransportError(Object error, StackTrace stackTrace) {
    if (!_running || _disposed) {
      return;
    }
    final generation = _activeGeneration;
    if (generation == null) {
      return;
    }
    final typedError = _typedFailure(
      error,
      fallbackCode: SensorDeviceErrorCode.streamFailed,
      operation: 'event stream',
    );
    final token = _deliveryToken;
    if (typedError.code == SensorDeviceErrorCode.interrupted) {
      _running = false;
      _activeGeneration = null;
      _queueError(typedError, stackTrace: stackTrace, token: token);
      return;
    }
    _queueError(
      typedError,
      generation: generation,
      requireActiveRun: true,
      stackTrace: stackTrace,
      token: token,
    );
  }

  void _handleTransportDone() {
    if (!_running || _disposed) {
      return;
    }
    final generation = _activeGeneration;
    if (generation == null) {
      return;
    }
    _queueError(
      const SensorDeviceException(
        code: SensorDeviceErrorCode.streamFailed,
        message: 'Core Motion event channel closed unexpectedly.',
      ),
      generation: generation,
      requireActiveRun: true,
      token: _deliveryToken,
    );
  }

  void _queueEvent(
    NormalizedSensorEvent event, {
    required int generation,
    required int token,
  }) {
    Future<void>.microtask(() {
      if (_canDeliver(token, generation: generation, requireActiveRun: true)) {
        _eventController.add(event);
      }
    });
  }

  void _queueError(
    SensorDeviceException error, {
    int? generation,
    bool requireActiveRun = false,
    StackTrace? stackTrace,
    required int token,
  }) {
    Future<void>.microtask(() {
      if (_canDeliver(
        token,
        generation: generation,
        requireActiveRun: requireActiveRun,
      )) {
        _eventController.addError(error, stackTrace);
      }
    });
  }

  bool _canDeliver(
    int token, {
    required int? generation,
    required bool requireActiveRun,
  }) {
    if (_disposed || token != _deliveryToken) {
      return false;
    }
    if (!requireActiveRun) {
      return true;
    }
    return _running && _activeGeneration == generation;
  }

  void _invalidateRun() {
    _deliveryToken += 1;
    _running = false;
    _activeGeneration = null;
  }

  void _ensureNotDisposed() {
    if (_disposed) {
      throw const SensorDeviceException(
        code: SensorDeviceErrorCode.disposed,
        message: 'Sensor device manager is disposed.',
      );
    }
  }
}

SensorDeviceException _typedFailure(
  Object error, {
  required SensorDeviceErrorCode fallbackCode,
  required String operation,
}) {
  if (error is SensorDeviceException) {
    return error;
  }
  var code = fallbackCode;
  var message = 'Core Motion $operation failed.';
  if (error is CoreMotionChannelFailure) {
    message = error.message;
    code = switch (error.code) {
      'disposed' => SensorDeviceErrorCode.disposed,
      'interrupted' => SensorDeviceErrorCode.interrupted,
      'permissionNotDetermined' => SensorDeviceErrorCode.permissionDenied,
      'permissionDenied' => SensorDeviceErrorCode.permissionDenied,
      'permissionRestricted' => SensorDeviceErrorCode.permissionRestricted,
      'startFailed' => SensorDeviceErrorCode.startFailed,
      'streamFailed' => SensorDeviceErrorCode.streamFailed,
      'unavailable' => SensorDeviceErrorCode.unavailable,
      _ => fallbackCode,
    };
  }
  return SensorDeviceException(cause: error, code: code, message: message);
}
