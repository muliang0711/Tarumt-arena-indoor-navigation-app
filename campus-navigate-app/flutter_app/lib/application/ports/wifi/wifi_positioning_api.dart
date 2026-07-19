import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';

final class WifiPositioningRequest {
  WifiPositioningRequest({
    required List<String> checkedServerNodeIds,
    required List<WifiAccessPointReading> readings,
    required this.timestampMs,
  }) : checkedServerNodeIds = List.unmodifiable(checkedServerNodeIds),
       readings = List.unmodifiable(readings) {
    if (timestampMs < 0) {
      throw ArgumentError.value(
        timestampMs,
        'timestampMs',
        'must not be negative',
      );
    }
    if (this.checkedServerNodeIds.isEmpty) {
      throw ArgumentError.value(
        checkedServerNodeIds,
        'checkedServerNodeIds',
        'must not be empty',
      );
    }
    if (this.checkedServerNodeIds.any((nodeId) => nodeId.trim().isEmpty)) {
      throw ArgumentError.value(
        checkedServerNodeIds,
        'checkedServerNodeIds',
        'must contain only non-empty identifiers',
      );
    }
    if (this.readings.isEmpty) {
      throw ArgumentError.value(readings, 'readings', 'must not be empty');
    }
  }

  final List<String> checkedServerNodeIds;
  final List<WifiAccessPointReading> readings;
  final int timestampMs;
}

final class WifiPositioningResponse {
  WifiPositioningResponse({required String serverNodeId})
    : serverNodeId = serverNodeId.trim() {
    if (this.serverNodeId.isEmpty) {
      throw ArgumentError.value(
        serverNodeId,
        'serverNodeId',
        'must not be empty',
      );
    }
  }

  final String serverNodeId;
}

abstract interface class WifiPositioningApi {
  Future<WifiPositioningResponse> findClosestNode(
    WifiPositioningRequest request,
  );
}

enum WifiPositioningApiErrorCode {
  httpFailure,
  invalidResponse,
  networkFailure,
  serverFailure,
  timeout,
  validationRejected,
}

final class WifiPositioningApiException implements Exception {
  const WifiPositioningApiException({
    required this.code,
    required this.message,
    this.cause,
    this.statusCode,
  });

  final Object? cause;
  final WifiPositioningApiErrorCode code;
  final String message;
  final int? statusCode;

  @override
  String toString() => 'WifiPositioningApiException($code): $message';
}
