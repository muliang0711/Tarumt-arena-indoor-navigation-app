import 'dart:async';
import 'dart:math';

import 'package:indoor_navigation/application/ports/time/clock.dart';
import 'package:indoor_navigation/application/ports/wifi/manual_wifi_scan_controller.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_api.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_node_mapping.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_validation_catalog.dart';

typedef WifiValidationIndexPicker = int Function(int upperBound);

enum WifiPositioningTestLabPhase { idle, sending, success, failure }

final class WifiPositioningTestLabState {
  const WifiPositioningTestLabState({
    this.errorMessage,
    this.expectedNodeId,
    this.floorId,
    this.localNodeId,
    this.phase = WifiPositioningTestLabPhase.idle,
    this.predictedServerNodeId,
    this.readingCount,
    this.sampleScanId,
    this.submittedAtMs,
  });

  final String? errorMessage;
  final String? expectedNodeId;
  final String? floorId;
  final String? localNodeId;
  final WifiPositioningTestLabPhase phase;
  final String? predictedServerNodeId;
  final int? readingCount;
  final int? sampleScanId;
  final int? submittedAtMs;

  bool get isSending => phase == WifiPositioningTestLabPhase.sending;
  bool get predictionMatches =>
      phase == WifiPositioningTestLabPhase.success &&
      predictedServerNodeId == expectedNodeId;
}

/// Selects a recorded validation scan, sends it through the real positioning
/// API, and retains that exact scan for the map's five-second mock source.
final class WifiPositioningTestLabViewModel {
  WifiPositioningTestLabViewModel({
    required this.api,
    required this.clock,
    required this.mappingRegistry,
    WifiValidationIndexPicker? pickIndex,
    required this.scanController,
    required this.validationCatalog,
  }) : _pickIndex = pickIndex ?? Random().nextInt {
    final mappedNodeIds =
        mappingRegistry.mappings.keys
            .where((nodeId) => validationCatalog.samplesFor(nodeId).isNotEmpty)
            .toList(growable: false)
          ..sort(_compareNodeIds);
    _selectableNodeIds = List.unmodifiable(mappedNodeIds);
  }

  final WifiPositioningApi api;
  final Clock clock;
  final WifiNodeMappingRegistry mappingRegistry;
  final WifiValidationIndexPicker _pickIndex;
  final ManualWifiScanController scanController;
  final WifiValidationCatalog validationCatalog;
  final StreamController<WifiPositioningTestLabState> _states =
      StreamController<WifiPositioningTestLabState>.broadcast(sync: true);

  late final List<String> _selectableNodeIds;
  WifiPositioningTestLabState _state = const WifiPositioningTestLabState();
  bool _disposed = false;
  int _sessionGeneration = 0;

  List<String> get selectableNodeIds => _selectableNodeIds;
  WifiPositioningTestLabState get state => _state;
  Stream<WifiPositioningTestLabState> get states => _states.stream;

  Future<void> submitRandomSample(String expectedNodeId) async {
    _ensureNotDisposed();
    if (_state.isSending) return;
    if (!_selectableNodeIds.contains(expectedNodeId)) {
      throw ArgumentError.value(
        expectedNodeId,
        'expectedNodeId',
        'must be a mapped node with validation samples',
      );
    }
    final samples = validationCatalog.samplesFor(expectedNodeId);
    final selectedIndex = _pickIndex(samples.length);
    if (selectedIndex < 0 || selectedIndex >= samples.length) {
      throw StateError('Validation sample picker returned $selectedIndex.');
    }
    final sample = samples[selectedIndex];
    final sessionGeneration = _sessionGeneration;
    final readings = sample.readings
        .map(
          (reading) => ManualWifiAccessPointReading(
            bssid: reading.bssid,
            frequencyMhz: reading.frequencyMhz,
            rssi: reading.rssi,
          ),
        )
        .toList(growable: false);
    scanController.replaceReadings(readings);
    final timestampMs = clock.nowMs();
    _emit(
      WifiPositioningTestLabState(
        expectedNodeId: expectedNodeId,
        phase: WifiPositioningTestLabPhase.sending,
        readingCount: readings.length,
        sampleScanId: sample.scanId,
        submittedAtMs: timestampMs,
      ),
    );

    String? predictedServerNodeId;
    try {
      final response = await api.findClosestNode(
        WifiPositioningRequest(
          checkedServerNodeIds: mappingRegistry.checkedServerNodeIds,
          readings: readings
              .map(
                (reading) => WifiAccessPointReading(
                  bssid: reading.bssid,
                  frequencyMhz: reading.frequencyMhz,
                  observedAtMs: timestampMs,
                  rssi: reading.rssi,
                  ssid: reading.ssid,
                ),
              )
              .toList(growable: false),
          timestampMs: timestampMs,
        ),
      );
      predictedServerNodeId = response.serverNodeId;
      final localNodeId = mappingRegistry.resolve(
        response.serverNodeId,
        availableLocalNodeIds: mappingRegistry.mappings.values.toSet(),
      );
      if (_disposed || sessionGeneration != _sessionGeneration) return;
      _emit(
        WifiPositioningTestLabState(
          expectedNodeId: expectedNodeId,
          floorId: mappingRegistry.floorId,
          localNodeId: localNodeId,
          phase: WifiPositioningTestLabPhase.success,
          predictedServerNodeId: predictedServerNodeId,
          readingCount: readings.length,
          sampleScanId: sample.scanId,
          submittedAtMs: timestampMs,
        ),
      );
    } catch (error) {
      if (_disposed || sessionGeneration != _sessionGeneration) return;
      _emit(
        WifiPositioningTestLabState(
          errorMessage: _failureMessage(error),
          expectedNodeId: expectedNodeId,
          phase: WifiPositioningTestLabPhase.failure,
          predictedServerNodeId: predictedServerNodeId,
          readingCount: readings.length,
          sampleScanId: sample.scanId,
          submittedAtMs: timestampMs,
        ),
      );
    }
  }

  void resetSession() {
    _ensureNotDisposed();
    _sessionGeneration += 1;
    scanController.clearReadings();
    _emit(const WifiPositioningTestLabState());
  }

  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    _sessionGeneration += 1;
    await _states.close();
  }

  void _emit(WifiPositioningTestLabState state) {
    if (_disposed) return;
    _state = state;
    _states.add(state);
  }

  void _ensureNotDisposed() {
    if (_disposed) {
      throw StateError('WifiPositioningTestLabViewModel is disposed.');
    }
  }
}

int _compareNodeIds(String left, String right) {
  final leftNumber = int.tryParse(left.replaceFirst('node-', ''));
  final rightNumber = int.tryParse(right.replaceFirst('node-', ''));
  if (leftNumber != null && rightNumber != null) {
    return leftNumber.compareTo(rightNumber);
  }
  return left.compareTo(right);
}

String _failureMessage(Object error) => switch (error) {
  WifiPositioningApiException(:final message, :final statusCode) =>
    statusCode == null ? message : '$message (HTTP $statusCode)',
  WifiNodeMappingException(:final message) => message,
  _ => 'The positioning request failed unexpectedly.',
};
