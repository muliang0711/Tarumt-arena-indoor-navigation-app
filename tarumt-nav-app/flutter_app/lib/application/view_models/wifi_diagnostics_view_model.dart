import 'dart:async';

import 'package:indoor_navigation/application/ports/export/wifi_diagnostic_exporter.dart';
import 'package:indoor_navigation/application/ports/logging/wifi_diagnostic_log.dart';
import 'package:indoor_navigation/application/ports/time/clock.dart';

final class WifiDiagnosticsViewState {
  const WifiDiagnosticsViewState({
    required this.eventCount,
    required this.isBusy,
    this.lastEventAtMs,
    this.message,
    this.storageError,
  });

  final int eventCount;
  final bool isBusy;
  final int? lastEventAtMs;
  final String? message;
  final String? storageError;
}

final class WifiDiagnosticsViewModel {
  WifiDiagnosticsViewModel({
    required this.clock,
    required this.exporter,
    required WifiDiagnosticLog log,
  }) : _log = log,
       _state = _fromLog(log.state) {
    _subscription = _log.states.listen(_onLogState);
  }

  final Clock clock;
  final WifiDiagnosticExporter exporter;
  final WifiDiagnosticLog _log;
  final StreamController<WifiDiagnosticsViewState> _statesController =
      StreamController<WifiDiagnosticsViewState>.broadcast(sync: true);
  late final StreamSubscription<WifiDiagnosticLogState> _subscription;
  bool _disposed = false;
  WifiDiagnosticsViewState _state;

  WifiDiagnosticsViewState get state => _state;
  Stream<WifiDiagnosticsViewState> get states => _statesController.stream;

  Future<void> export() async {
    if (_disposed || _state.isBusy) return;
    _emit(isBusy: true, message: null);
    try {
      final jsonBody = await _log.exportJson();
      final result = await exporter.export(
        WifiDiagnosticExportRequest(
          fileName: _fileName(clock.nowMs()),
          jsonBody: jsonBody,
        ),
      );
      _emit(
        isBusy: false,
        message: switch (result) {
          WifiDiagnosticExportStatus.success => 'Diagnostic file exported.',
          WifiDiagnosticExportStatus.dismissed => 'Export was cancelled.',
          WifiDiagnosticExportStatus.unavailable =>
            'No app is available to save or share the file.',
        },
      );
    } catch (error) {
      _emit(isBusy: false, message: 'Diagnostic export failed: $error');
    }
  }

  Future<void> clear() async {
    if (_disposed || _state.isBusy) return;
    _emit(isBusy: true, message: null);
    try {
      await _log.clear();
      _emit(isBusy: false, message: 'Diagnostic history cleared.');
    } catch (error) {
      _emit(isBusy: false, message: 'Could not clear diagnostics: $error');
    }
  }

  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    await _subscription.cancel();
    await _log.flush();
    await _statesController.close();
  }

  void _onLogState(WifiDiagnosticLogState value) {
    if (_disposed) return;
    _state = WifiDiagnosticsViewState(
      eventCount: value.eventCount,
      isBusy: _state.isBusy,
      lastEventAtMs: value.lastEventAtMs,
      message: _state.message,
      storageError: value.storageError,
    );
    _statesController.add(_state);
  }

  void _emit({required bool isBusy, required String? message}) {
    if (_disposed) return;
    _state = WifiDiagnosticsViewState(
      eventCount: _log.state.eventCount,
      isBusy: isBusy,
      lastEventAtMs: _log.state.lastEventAtMs,
      message: message,
      storageError: _log.state.storageError,
    );
    _statesController.add(_state);
  }
}

WifiDiagnosticsViewState _fromLog(WifiDiagnosticLogState value) =>
    WifiDiagnosticsViewState(
      eventCount: value.eventCount,
      isBusy: false,
      lastEventAtMs: value.lastEventAtMs,
      storageError: value.storageError,
    );

String _fileName(int timestampMs) {
  final value = DateTime.fromMillisecondsSinceEpoch(timestampMs);
  String two(int number) => number.toString().padLeft(2, '0');
  return 'wifi-diagnostics-${value.year}${two(value.month)}${two(value.day)}-'
      '${two(value.hour)}${two(value.minute)}${two(value.second)}.json';
}
