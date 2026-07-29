import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:indoor_navigation/application/ports/debug/sensor_debug_sink.dart';
import 'package:indoor_navigation/application/ports/time/clock.dart';
import 'package:indoor_navigation/domain/sensor_debug/codec/codec.dart';
import 'package:indoor_navigation/domain/sensor_debug/sensor_debug_models.dart';
import 'package:indoor_navigation/infrastructure/time/system_clock.dart';

import 'sensor_debug_http_transport.dart';

typedef SensorDebugFailureLogger = void Function(String message);

const String _configuredSensorDebugLogUrl = String.fromEnvironment(
  'SENSOR_DEBUG_LOG_URL',
);

final class HttpSensorDebugSink implements SensorDebugSink {
  HttpSensorDebugSink({
    required this.clock,
    required this.transport,
    String baseUrl = _configuredSensorDebugLogUrl,
    bool enabled = true,
    Duration failureLogThrottle = const Duration(milliseconds: 5000),
    SensorDebugFailureLogger? failureLogger,
    bool releaseMode = kReleaseMode,
    this.requestTimeout = const Duration(milliseconds: 1200),
  }) : _baseUrl = _normalizeBaseUrl(baseUrl),
       _enabled = enabled && !releaseMode && baseUrl.trim().isNotEmpty,
       _failureLogger = failureLogger ?? _defaultFailureLogger,
       _failureLogThrottleMs = failureLogThrottle.inMilliseconds;

  factory HttpSensorDebugSink.production({
    String baseUrl = _configuredSensorDebugLogUrl,
  }) {
    return HttpSensorDebugSink(
      baseUrl: baseUrl,
      clock: const SystemClock(),
      transport: DartIoSensorDebugHttpTransport(),
    );
  }

  static const Map<String, String> _jsonHeaders = <String, String>{
    'content-type': 'application/json',
  };

  final String _baseUrl;
  final Clock clock;
  final bool _enabled;
  final SensorDebugFailureLogger _failureLogger;
  final int _failureLogThrottleMs;
  final Duration requestTimeout;
  final SensorDebugHttpTransport transport;
  Future<void> _pendingDelivery = Future<void>.value();
  int? _lastFailureLogAtMs;

  bool get isEnabled => _enabled;

  /// Completes after all events queued so far have either delivered or failed.
  Future<void> get pendingDelivery => _pendingDelivery;

  @override
  void sendBatchLog(SensorDebugBatchLog log) {
    _enqueue('/batch', encodeSensorDebugBatchLog(log));
  }

  @override
  void sendSessionStart(SensorDebugSessionStart event) {
    _enqueue('/session-start', encodeSensorDebugSessionStart(event));
  }

  @override
  void sendSessionStop(SensorDebugSessionStop event) {
    _enqueue('/session-stop', encodeSensorDebugSessionStop(event));
  }

  void _enqueue(String path, Map<String, Object?> payload) {
    if (!_enabled) {
      return;
    }

    final request = SensorDebugHttpRequest(
      body: jsonEncode(payload),
      headers: _jsonHeaders,
      timeout: requestTimeout,
      uri: Uri.parse('$_baseUrl$path'),
    );
    _pendingDelivery = _pendingDelivery
        .then<void>((_) => transport.post(request))
        .catchError((Object error, StackTrace _) {
          _logFailure('POST ${request.uri} failed: $error');
        });
  }

  void _logFailure(String message) {
    final nowMs = clock.nowMs();
    final lastFailureLogAtMs = _lastFailureLogAtMs;
    if (lastFailureLogAtMs != null &&
        nowMs - lastFailureLogAtMs < _failureLogThrottleMs) {
      return;
    }
    _lastFailureLogAtMs = nowMs;
    _failureLogger('[sensor-debug] $message');
  }
}

String _normalizeBaseUrl(String value) {
  return value.trim().replaceFirst(RegExp(r'/+$'), '');
}

void _defaultFailureLogger(String message) {
  debugPrint(message);
}
