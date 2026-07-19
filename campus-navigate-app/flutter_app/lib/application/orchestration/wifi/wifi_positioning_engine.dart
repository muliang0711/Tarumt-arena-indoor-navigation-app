import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_api.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_manager.dart';
import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/wifi_positioning/wifi_node_mapping.dart';

enum WifiPositioningErrorCode { invalidNodeMapping, noReadings, staleReadings }

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
    required this.readingCount,
    required this.serverNodeId,
  });

  final String floorId;
  final String localNodeId;
  final int observedAtMs;
  final int readingCount;
  final String serverNodeId;
}

final class WifiPositioningEngine {
  WifiPositioningEngine({
    required this.api,
    required this.mappingRegistry,
    required this.scanManager,
    this.maxReadingAgeMs = wifiPositioningMaxReadingAgeMs,
  }) : assert(maxReadingAgeMs > 0);

  final WifiPositioningApi api;
  final WifiNodeMappingRegistry mappingRegistry;
  final int maxReadingAgeMs;
  final WifiScanManager scanManager;

  Future<WifiPositionFix> locate({
    required Set<String> availableLocalNodeIds,
  }) async {
    final scan = await scanManager.scan();
    if (scan.readings.isEmpty) {
      throw const WifiPositioningException(
        code: WifiPositioningErrorCode.noReadings,
        message: 'The Wi-Fi scan returned no fresh access-point readings.',
      );
    }
    final freshReadings = scan.readings
        .where(
          (reading) =>
              reading.observedAtMs <= scan.completedAtMs &&
              scan.completedAtMs - reading.observedAtMs <= maxReadingAgeMs,
        )
        .toList(growable: false);
    if (freshReadings.isEmpty) {
      throw WifiPositioningException(
        code: WifiPositioningErrorCode.staleReadings,
        message:
            'The Wi-Fi scan returned readings older than '
            '$maxReadingAgeMs ms.',
      );
    }

    final response = await api.findClosestNode(
      WifiPositioningRequest(
        checkedServerNodeIds: mappingRegistry.checkedServerNodeIds,
        readings: freshReadings,
        timestampMs: scan.completedAtMs,
      ),
    );

    try {
      final localNodeId = mappingRegistry.resolve(
        response.serverNodeId,
        availableLocalNodeIds: availableLocalNodeIds,
      );
      return WifiPositionFix(
        floorId: mappingRegistry.floorId,
        localNodeId: localNodeId,
        observedAtMs: scan.completedAtMs,
        readingCount: freshReadings.length,
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

  Future<void> dispose() => scanManager.dispose();
}
