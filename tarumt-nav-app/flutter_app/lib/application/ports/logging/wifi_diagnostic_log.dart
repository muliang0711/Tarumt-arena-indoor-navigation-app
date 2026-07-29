import 'dart:convert';

import 'package:indoor_navigation/application/ports/time/clock.dart';

const wifiDiagnosticDocumentSchemaVersion = 1;

final class WifiDiagnosticLogState {
  const WifiDiagnosticLogState({
    required this.eventCount,
    this.lastEventAtMs,
    this.storageError,
  });

  const WifiDiagnosticLogState.empty()
    : eventCount = 0,
      lastEventAtMs = null,
      storageError = null;

  final int eventCount;
  final int? lastEventAtMs;
  final String? storageError;
}

final class WifiDiagnosticEvent {
  WifiDiagnosticEvent({
    required this.category,
    required Map<String, Object?> details,
    required this.event,
    required this.sequence,
    required this.sessionId,
    required this.timestampMs,
  }) : details = Map.unmodifiable(details);

  factory WifiDiagnosticEvent.fromJson(Map<String, Object?> json) {
    final details = json['details'];
    if (details is! Map<Object?, Object?>) {
      throw const FormatException('Wi-Fi diagnostic details must be a map.');
    }
    return WifiDiagnosticEvent(
      category: _requiredString(json, 'category'),
      details: details.map((key, value) => MapEntry(key.toString(), value)),
      event: _requiredString(json, 'event'),
      sequence: _requiredInt(json, 'sequence'),
      sessionId: _requiredString(json, 'sessionId'),
      timestampMs: _requiredInt(json, 'timestampMs'),
    );
  }

  final String category;
  final Map<String, Object?> details;
  final String event;
  final int sequence;
  final String sessionId;
  final int timestampMs;

  Map<String, Object?> toJson() => <String, Object?>{
    'sequence': sequence,
    'timestampMs': timestampMs,
    'sessionId': sessionId,
    'category': category,
    'event': event,
    'details': details,
  };
}

abstract interface class WifiDiagnosticLog {
  WifiDiagnosticLogState get state;
  Stream<WifiDiagnosticLogState> get states;

  void record({
    required String category,
    required String event,
    Map<String, Object?> details = const <String, Object?>{},
  });

  Future<void> clear();
  Future<String> exportJson();
  Future<void> flush();
}

final class NoopWifiDiagnosticLog implements WifiDiagnosticLog {
  const NoopWifiDiagnosticLog({this.clock});

  final Clock? clock;

  @override
  WifiDiagnosticLogState get state => const WifiDiagnosticLogState.empty();

  @override
  Stream<WifiDiagnosticLogState> get states => const Stream.empty();

  @override
  void record({
    required String category,
    required String event,
    Map<String, Object?> details = const <String, Object?>{},
  }) {}

  @override
  Future<void> clear() async {}

  @override
  Future<String> exportJson() async =>
      const JsonEncoder.withIndent('  ').convert(<String, Object?>{
        'schemaVersion': wifiDiagnosticDocumentSchemaVersion,
        'kind': 'wifi-positioning-diagnostics',
        'containsSensitiveWifiIdentifiers': false,
        'exportedAtMs': 0,
        'eventCount': 0,
        'events': <Object?>[],
      });

  @override
  Future<void> flush() async {}
}

String _requiredString(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! String || value.isEmpty) {
    throw FormatException('$key must be a non-empty string.');
  }
  return value;
}

int _requiredInt(Map<String, Object?> json, String key) {
  final value = json[key];
  if (value is! int || value < 0) {
    throw FormatException('$key must be a non-negative integer.');
  }
  return value;
}
