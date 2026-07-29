import 'dart:async';
import 'dart:convert';

import 'package:indoor_navigation/application/ports/logging/wifi_diagnostic_log.dart';
import 'package:indoor_navigation/application/ports/time/clock.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _storageKey = 'wifiPositioningDiagnostics.v1';

final class SharedPreferencesWifiDiagnosticLog implements WifiDiagnosticLog {
  SharedPreferencesWifiDiagnosticLog._(
    this._clock,
    this._events,
    this._maxEvents,
    this._preferences,
  ) : _nextSequence = _events.isEmpty ? 1 : _events.last.sequence + 1,
      _sessionId = '${_clock.nowMs().toRadixString(36)}-${_events.length}';

  static Future<SharedPreferencesWifiDiagnosticLog> create({
    required Clock clock,
    int maxEvents = 500,
    SharedPreferences? preferences,
  }) async {
    if (maxEvents <= 0) {
      throw ArgumentError.value(maxEvents, 'maxEvents', 'must be positive');
    }
    final store = preferences ?? await SharedPreferences.getInstance();
    final events = _decodeStoredEvents(store.getString(_storageKey));
    if (events.length > maxEvents) {
      events.removeRange(0, events.length - maxEvents);
    }
    return SharedPreferencesWifiDiagnosticLog._(
      clock,
      events,
      maxEvents,
      store,
    );
  }

  final Clock _clock;
  final List<WifiDiagnosticEvent> _events;
  final int _maxEvents;
  final SharedPreferences _preferences;
  final StreamController<WifiDiagnosticLogState> _statesController =
      StreamController<WifiDiagnosticLogState>.broadcast(sync: true);
  final String _sessionId;
  Future<void> _writeTail = Future<void>.value();
  int _nextSequence;
  String? _storageError;

  @override
  WifiDiagnosticLogState get state => WifiDiagnosticLogState(
    eventCount: _events.length,
    lastEventAtMs: _events.lastOrNull?.timestampMs,
    storageError: _storageError,
  );

  @override
  Stream<WifiDiagnosticLogState> get states => _statesController.stream;

  @override
  void record({
    required String category,
    required String event,
    Map<String, Object?> details = const <String, Object?>{},
  }) {
    if (category.trim().isEmpty || event.trim().isEmpty) {
      throw ArgumentError('Diagnostic category and event must not be empty.');
    }
    _events.add(
      WifiDiagnosticEvent(
        category: category.trim(),
        details: details,
        event: event.trim(),
        sequence: _nextSequence++,
        sessionId: _sessionId,
        timestampMs: _clock.nowMs(),
      ),
    );
    if (_events.length > _maxEvents) {
      _events.removeRange(0, _events.length - _maxEvents);
    }
    _emit();
    _schedulePersist();
  }

  @override
  Future<void> clear() async {
    await flush();
    _events.clear();
    _storageError = null;
    final removed = await _preferences.remove(_storageKey);
    if (!removed) {
      _storageError = 'Android could not clear the saved diagnostic log.';
    }
    _emit();
  }

  @override
  Future<String> exportJson() async {
    await flush();
    return const JsonEncoder.withIndent('  ').convert(<String, Object?>{
      'schemaVersion': wifiDiagnosticDocumentSchemaVersion,
      'kind': 'wifi-positioning-diagnostics',
      'containsSensitiveWifiIdentifiers': true,
      'exportedAtMs': _clock.nowMs(),
      'eventCount': _events.length,
      'events': _events.map((event) => event.toJson()).toList(growable: false),
    });
  }

  @override
  Future<void> flush() => _writeTail;

  void _schedulePersist() {
    final body = jsonEncode(
      _events.map((event) => event.toJson()).toList(growable: false),
    );
    _writeTail = _writeTail.then((_) async {
      try {
        final saved = await _preferences.setString(_storageKey, body);
        _storageError = saved
            ? null
            : 'Android could not persist the diagnostic log.';
      } catch (error) {
        _storageError = 'Diagnostic storage failed: $error';
      }
      _emit();
    });
  }

  void _emit() {
    if (!_statesController.isClosed) {
      _statesController.add(state);
    }
  }
}

List<WifiDiagnosticEvent> _decodeStoredEvents(String? source) {
  if (source == null || source.isEmpty) return <WifiDiagnosticEvent>[];
  try {
    final decoded = jsonDecode(source);
    if (decoded is! List<Object?>) return <WifiDiagnosticEvent>[];
    return decoded
        .whereType<Map<Object?, Object?>>()
        .map(
          (value) => WifiDiagnosticEvent.fromJson(
            value.map((key, item) => MapEntry(key.toString(), item)),
          ),
        )
        .toList(growable: true);
  } on FormatException {
    return <WifiDiagnosticEvent>[];
  }
}
