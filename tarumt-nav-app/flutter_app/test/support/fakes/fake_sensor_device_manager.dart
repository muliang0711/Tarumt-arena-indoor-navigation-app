import 'dart:async';
import 'dart:collection';

import 'package:indoor_navigation/application/ports/sensors/sensors.dart';

final class FakeSensorDeviceManager implements SensorDeviceManager {
  FakeSensorDeviceManager({
    this.availability = const SensorAvailability(
      heading: SensorCapabilityStatus.available,
      motion: SensorCapabilityStatus.available,
    ),
    this.permissionStatus = SensorPermissionStatus.granted,
    Iterable<NormalizedSensorEvent> scriptedEvents = const [],
    this.startFailure,
  }) : _scriptedEvents = Queue.of(scriptedEvents);

  SensorAvailability availability;
  SensorPermissionStatus permissionStatus;
  SensorDeviceException? startFailure;

  int availabilityCheckCount = 0;
  int disposeCallCount = 0;
  int interruptionCount = 0;
  int permissionRequestCount = 0;
  int startCallCount = 0;
  int stopCallCount = 0;

  bool isDisposed = false;
  bool isRunning = false;
  SensorSamplingRequest? lastStartRequest;

  final Queue<NormalizedSensorEvent> _scriptedEvents;
  final Queue<_PendingSignal> _deliveryQueue = Queue();
  final StreamController<NormalizedSensorEvent> _eventController =
      StreamController(sync: true);
  bool _drainScheduled = false;
  int _generation = 0;

  int get pendingDeliveryCount => _deliveryQueue.length;
  int get pendingScriptedEventCount => _scriptedEvents.length;

  @override
  Stream<NormalizedSensorEvent> get events => _eventController.stream;

  @override
  Future<SensorAvailability> checkAvailability() async {
    _throwIfDisposed();
    availabilityCheckCount += 1;
    return availability;
  }

  @override
  Future<SensorPermissionStatus> requestPermissions() async {
    _throwIfDisposed();
    permissionRequestCount += 1;
    return permissionStatus;
  }

  @override
  Future<void> start(SensorSamplingRequest request) async {
    _throwIfDisposed();
    if (isRunning) {
      await stop();
    }

    startCallCount += 1;
    lastStartRequest = request;
    final failure = startFailure;
    if (failure != null) {
      throw failure;
    }

    _generation += 1;
    isRunning = true;
    while (_scriptedEvents.isNotEmpty) {
      _deliveryQueue.add(_EventSignal(_scriptedEvents.removeFirst()));
    }
    _scheduleDrain();
  }

  @override
  Future<void> stop() async {
    if (isDisposed) {
      return;
    }
    stopCallCount += 1;
    _generation += 1;
    isRunning = false;
    _deliveryQueue.clear();
  }

  @override
  Future<void> dispose() async {
    if (isDisposed) {
      return;
    }
    disposeCallCount += 1;
    _generation += 1;
    isRunning = false;
    isDisposed = true;
    _deliveryQueue.clear();
    _scriptedEvents.clear();
    final closeFuture = _eventController.close();
    if (_eventController.hasListener) {
      await closeFuture;
    }
  }

  /// Adds an event to the current run without retaining an emitted history.
  bool emit(NormalizedSensorEvent event) {
    if (!isRunning || isDisposed) {
      return false;
    }
    _deliveryQueue.add(_EventSignal(event));
    _scheduleDrain();
    return true;
  }

  /// Replays in caller-provided order; timestamps are never used for sorting.
  int replay(Iterable<NormalizedSensorEvent> events) {
    var acceptedCount = 0;
    for (final event in events) {
      if (!emit(event)) {
        break;
      }
      acceptedCount += 1;
    }
    return acceptedCount;
  }

  /// Queues a one-shot script for the next successful start.
  void enqueueScript(Iterable<NormalizedSensorEvent> events) {
    _throwIfDisposed();
    _scriptedEvents.addAll(events);
  }

  /// Emits a recoverable stream error while leaving the manager running.
  bool emitStreamError([
    SensorDeviceException error = const SensorDeviceException(
      code: SensorDeviceErrorCode.streamFailed,
      message: 'Scripted sensor stream failure.',
    ),
  ]) {
    if (!isRunning || isDisposed) {
      return false;
    }
    _deliveryQueue.add(_ErrorSignal(error));
    _scheduleDrain();
    return true;
  }

  /// Ends the active run and asynchronously reports an interruption.
  bool interrupt([
    SensorDeviceException error = const SensorDeviceException(
      code: SensorDeviceErrorCode.interrupted,
      message: 'Scripted sensor interruption.',
    ),
  ]) {
    if (!isRunning || isDisposed) {
      return false;
    }
    interruptionCount += 1;
    _generation += 1;
    final interruptionGeneration = _generation;
    isRunning = false;
    _deliveryQueue.clear();
    scheduleMicrotask(() {
      if (!isDisposed && _generation == interruptionGeneration) {
        _eventController.addError(error);
      }
    });
    return true;
  }

  void _scheduleDrain() {
    if (_drainScheduled || !isRunning || isDisposed) {
      return;
    }
    _drainScheduled = true;
    final scheduledGeneration = _generation;
    scheduleMicrotask(() {
      _drainScheduled = false;
      if (!isRunning || isDisposed || scheduledGeneration != _generation) {
        if (isRunning && !isDisposed && _deliveryQueue.isNotEmpty) {
          _scheduleDrain();
        }
        return;
      }

      var remaining = _deliveryQueue.length;
      while (remaining > 0 &&
          isRunning &&
          !isDisposed &&
          scheduledGeneration == _generation) {
        _deliveryQueue.removeFirst().dispatch(_eventController);
        remaining -= 1;
      }
      if (_deliveryQueue.isNotEmpty) {
        _scheduleDrain();
      }
    });
  }

  void _throwIfDisposed() {
    if (isDisposed) {
      throw const SensorDeviceException(
        code: SensorDeviceErrorCode.disposed,
        message: 'Sensor device manager has been disposed.',
      );
    }
  }
}

sealed class _PendingSignal {
  const _PendingSignal();

  void dispatch(StreamController<NormalizedSensorEvent> controller);
}

final class _EventSignal extends _PendingSignal {
  const _EventSignal(this.event);

  final NormalizedSensorEvent event;

  @override
  void dispatch(StreamController<NormalizedSensorEvent> controller) {
    controller.add(event);
  }
}

final class _ErrorSignal extends _PendingSignal {
  const _ErrorSignal(this.error);

  final SensorDeviceException error;

  @override
  void dispatch(StreamController<NormalizedSensorEvent> controller) {
    controller.addError(error);
  }
}
