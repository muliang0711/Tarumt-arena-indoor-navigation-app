import 'dart:collection';

import 'package:indoor_navigation/application/ports/debug/sensor_debug_sink.dart';
import 'package:indoor_navigation/domain/sensor_debug/sensor_debug_models.dart';

/// Deterministic capture sink. Scripted errors represent a synchronous adapter
/// invocation failure; remote delivery remains unobservable through the port.
final class FakeSensorDebugSink implements SensorDebugSink {
  final List<Object> _events = [];
  final Queue<Object?> _outcomes = Queue<Object?>();

  List<Object> get events => List<Object>.unmodifiable(_events);

  void enqueueSuccess() {
    _outcomes.add(null);
  }

  void enqueueFailure(Object error) {
    _outcomes.add(error);
  }

  void clearEvents() {
    _events.clear();
  }

  @override
  void sendSessionStart(SensorDebugSessionStart event) {
    _capture(event);
  }

  @override
  void sendBatchLog(SensorDebugBatchLog log) {
    _capture(log);
  }

  @override
  void sendSessionStop(SensorDebugSessionStop event) {
    _capture(event);
  }

  void _capture(Object event) {
    _events.add(event);
    if (_outcomes.isEmpty) {
      return;
    }
    final error = _outcomes.removeFirst();
    if (error != null) {
      throw error;
    }
  }
}
