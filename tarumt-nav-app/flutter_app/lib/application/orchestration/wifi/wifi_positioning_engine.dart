import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_api.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_manager.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_node_mapping.dart';

enum WifiPositioningErrorCode {
  duplicateReadings,
  insufficientRecognizedReadings,
  invalidNodeMapping,
  noReadings,
  staleReadings,
}

enum WifiPositioningReadingTier { fresh, fallback }

final class WifiPositioningReadingPolicy {
  WifiPositioningReadingPolicy.campus({
    required Iterable<String> trainedBssids,
    this.minimumReadingCount = 3,
    this.requiredSsidPrefix = 'TARUMT',
  }) : trainedBssids = Set.unmodifiable(
         trainedBssids.map((bssid) => bssid.trim().toUpperCase()),
       ) {
    if (this.trainedBssids.isEmpty) {
      throw ArgumentError.value(
        trainedBssids,
        'trainedBssids',
        'must not be empty',
      );
    }
    if (minimumReadingCount <= 0) {
      throw ArgumentError.value(
        minimumReadingCount,
        'minimumReadingCount',
        'must be greater than zero',
      );
    }
    if (requiredSsidPrefix.trim().isEmpty) {
      throw ArgumentError.value(
        requiredSsidPrefix,
        'requiredSsidPrefix',
        'must not be empty',
      );
    }
  }

  const WifiPositioningReadingPolicy.unfiltered()
    : minimumReadingCount = 1,
      requiredSsidPrefix = '',
      trainedBssids = const <String>{};

  final int minimumReadingCount;
  final String requiredSsidPrefix;
  final Set<String> trainedBssids;

  bool get isFiltered =>
      requiredSsidPrefix.isNotEmpty || trainedBssids.isNotEmpty;
}

final class WifiPositioningReadingFilterDiagnostics {
  const WifiPositioningReadingFilterDiagnostics({
    required this.candidateReadingCount,
    required this.minimumReadingCount,
    required this.recognizedReadingCount,
    required this.ssidMatchedReadingCount,
  });

  final int candidateReadingCount;
  final int minimumReadingCount;
  final int recognizedReadingCount;
  final int ssidMatchedReadingCount;
}

final class WifiPositioningException implements Exception {
  const WifiPositioningException({
    required this.code,
    required this.message,
    this.cause,
  });

  final Object? cause;
  final WifiPositioningErrorCode code;
  final String message;

  @override
  String toString() => 'WifiPositioningException($code): $message';
}

final class WifiPositionFix {
  const WifiPositionFix({
    required this.floorId,
    required this.localNodeId,
    required this.observedAtMs,
    required this.readingTier,
    required this.readingCount,
    required this.scanSource,
    required this.serverNodeId,
  });

  final String floorId;
  final String localNodeId;
  final int observedAtMs;
  final WifiPositioningReadingTier readingTier;
  final int readingCount;
  final WifiScanBatchSource scanSource;
  final String serverNodeId;
}

final class WifiPositioningEngine {
  WifiPositioningEngine({
    required this.api,
    required this.mappingRegistry,
    required this.scanManager,
    this.fallbackReadingAgeMs = wifiPositioningFallbackReadingAgeMs,
    this.freshReadingAgeMs = wifiPositioningFreshReadingAgeMs,
    this.readingPolicy = const WifiPositioningReadingPolicy.unfiltered(),
  }) : assert(freshReadingAgeMs > 0),
       assert(fallbackReadingAgeMs >= freshReadingAgeMs);

  final WifiPositioningApi api;
  final int fallbackReadingAgeMs;
  final int freshReadingAgeMs;
  final WifiNodeMappingRegistry mappingRegistry;
  final WifiPositioningReadingPolicy readingPolicy;
  final WifiScanManager scanManager;
  final Map<String, int> _acceptedObservationTimes = <String, int>{};
  String? _acceptedFingerprintSignature;
  WifiScanBatch? _lastScanBatch;
  WifiPositioningReadingFilterDiagnostics? _lastReadingFilterDiagnostics;
  WifiPositioningRequest? _lastRequest;

  WifiScanBatch? get lastScanBatch => _lastScanBatch;
  WifiPositioningReadingFilterDiagnostics? get lastReadingFilterDiagnostics =>
      _lastReadingFilterDiagnostics;
  WifiPositioningRequest? get lastRequest => _lastRequest;
  WifiScanBatchSource? get lastScanSource => _lastScanBatch?.source;

  Future<WifiPositionFix> locate({
    required Set<String> availableLocalNodeIds,
    bool requestActiveScan = true,
  }) async {
    _lastScanBatch = null;
    _lastReadingFilterDiagnostics = null;
    _lastRequest = null;
    final scan = await scanManager.scan(requestActiveScan: requestActiveScan);
    _lastScanBatch = scan;
    if (scan.readings.isEmpty) {
      throw const WifiPositioningException(
        code: WifiPositioningErrorCode.noReadings,
        message: 'The Wi-Fi scan returned no fresh access-point readings.',
      );
    }
    final fallbackReadings = scan.readings
        .where(
          (reading) =>
              reading.observedAtMs <= scan.completedAtMs &&
              scan.completedAtMs - reading.observedAtMs <= fallbackReadingAgeMs,
        )
        .toList(growable: false);
    if (fallbackReadings.isEmpty) {
      throw WifiPositioningException(
        code: WifiPositioningErrorCode.staleReadings,
        message:
            'The Wi-Fi scan returned readings older than '
            '$fallbackReadingAgeMs ms.',
      );
    }
    final freshReadings = fallbackReadings
        .where(
          (reading) =>
              scan.completedAtMs - reading.observedAtMs <= freshReadingAgeMs,
        )
        .toList(growable: false);
    final readingTier = freshReadings.isNotEmpty
        ? WifiPositioningReadingTier.fresh
        : WifiPositioningReadingTier.fallback;
    final candidateReadings = freshReadings.isNotEmpty
        ? freshReadings
        : fallbackReadings;
    final normalizedPrefix = readingPolicy.requiredSsidPrefix
        .trim()
        .toUpperCase();
    final ssidMatchedReadings = normalizedPrefix.isEmpty
        ? candidateReadings
        : candidateReadings
              .where(
                (reading) =>
                    reading.ssid?.trim().toUpperCase().startsWith(
                      normalizedPrefix,
                    ) ??
                    false,
              )
              .toList(growable: false);
    final selectedReadings = readingPolicy.trainedBssids.isEmpty
        ? ssidMatchedReadings
        : ssidMatchedReadings
              .where(
                (reading) =>
                    readingPolicy.trainedBssids.contains(reading.bssid),
              )
              .toList(growable: false);
    _lastReadingFilterDiagnostics = WifiPositioningReadingFilterDiagnostics(
      candidateReadingCount: candidateReadings.length,
      minimumReadingCount: readingPolicy.minimumReadingCount,
      recognizedReadingCount: selectedReadings.length,
      ssidMatchedReadingCount: ssidMatchedReadings.length,
    );
    if (selectedReadings.length < readingPolicy.minimumReadingCount) {
      throw WifiPositioningException(
        code: WifiPositioningErrorCode.insufficientRecognizedReadings,
        message:
            'Only ${selectedReadings.length} recognized '
            '${normalizedPrefix.isEmpty ? '' : '$normalizedPrefix '}${selectedReadings.length == 1 ? 'access point was' : 'access points were'} '
            'available; at least ${readingPolicy.minimumReadingCount} '
            '${readingPolicy.minimumReadingCount == 1 ? 'is' : 'are'} required.',
      );
    }
    final newestObservationAtMs = selectedReadings.fold<int>(
      0,
      (newest, reading) =>
          reading.observedAtMs > newest ? reading.observedAtMs : newest,
    );
    final fingerprintSignature = _fingerprintSignature(selectedReadings);
    final hasNewObservation = selectedReadings.any(
      (reading) =>
          reading.observedAtMs >
          (_acceptedObservationTimes[reading.bssid] ?? -1),
    );
    if (_acceptedFingerprintSignature == fingerprintSignature &&
        !hasNewObservation) {
      throw const WifiPositioningException(
        code: WifiPositioningErrorCode.duplicateReadings,
        message: 'The Wi-Fi scan duplicated the last accepted fingerprint.',
      );
    }

    final request = WifiPositioningRequest(
      checkedServerNodeIds: mappingRegistry.checkedServerNodeIds,
      readings: selectedReadings,
      timestampMs: scan.completedAtMs,
    );
    _lastRequest = request;
    final response = await api.findClosestNode(request);

    try {
      final localNodeId = mappingRegistry.resolve(
        response.serverNodeId,
        availableLocalNodeIds: availableLocalNodeIds,
      );
      _acceptedFingerprintSignature = fingerprintSignature;
      for (final reading in selectedReadings) {
        final previous = _acceptedObservationTimes[reading.bssid] ?? -1;
        if (reading.observedAtMs > previous) {
          _acceptedObservationTimes[reading.bssid] = reading.observedAtMs;
        }
      }
      return WifiPositionFix(
        floorId: mappingRegistry.floorId,
        localNodeId: localNodeId,
        observedAtMs: newestObservationAtMs,
        readingTier: readingTier,
        readingCount: selectedReadings.length,
        scanSource: scan.source,
        serverNodeId: response.serverNodeId,
      );
    } on WifiNodeMappingException catch (error) {
      throw WifiPositioningException(
        cause: error,
        code: WifiPositioningErrorCode.invalidNodeMapping,
        message: error.message,
      );
    }
  }

  Future<void> dispose() async {
    _acceptedObservationTimes.clear();
    _acceptedFingerprintSignature = null;
    _lastScanBatch = null;
    _lastRequest = null;
    await scanManager.dispose();
  }
}

String _fingerprintSignature(List<WifiAccessPointReading> readings) {
  final components =
      readings
          .map(
            (reading) =>
                '${reading.bssid}|${reading.rssi}|${reading.frequencyMhz}|'
                '${reading.ssid ?? ''}',
          )
          .toList(growable: false)
        ..sort();
  return components.join(';');
}
