import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_api.dart';
import 'package:indoor_navigation/infrastructure/wifi_positioning/wifi_positioning_codec.dart';
import 'package:indoor_navigation/infrastructure/wifi_positioning/wifi_positioning_http_transport.dart';

typedef WifiPositioningDelay = Future<void> Function(Duration duration);

const String _configuredWifiPositioningBaseUrl = String.fromEnvironment(
  'WIFI_POSITIONING_BASE_URL',
  defaultValue: 'https://uni-rssi-knn-api-server.onrender.com',
);

final class HttpWifiPositioningApi implements WifiPositioningApi {
  HttpWifiPositioningApi({
    required String baseUrl,
    required this.transport,
    WifiPositioningDelay? delay,
    this.maxAttempts = 2,
    this.requestTimeout = const Duration(seconds: 15),
    this.retryDelay = const Duration(milliseconds: 250),
  }) : _delay = delay ?? Future<void>.delayed,
       endpoint = _endpoint(baseUrl) {
    if (maxAttempts <= 0) {
      throw ArgumentError.value(maxAttempts, 'maxAttempts', 'must be positive');
    }
    if (requestTimeout <= Duration.zero) {
      throw ArgumentError.value(
        requestTimeout,
        'requestTimeout',
        'must be positive',
      );
    }
  }

  factory HttpWifiPositioningApi.production({
    String baseUrl = _configuredWifiPositioningBaseUrl,
  }) {
    return HttpWifiPositioningApi(
      baseUrl: baseUrl,
      transport: DartIoWifiPositioningHttpTransport(),
    );
  }

  static const Map<String, String> _headers = <String, String>{
    'accept': 'application/json',
    'content-type': 'application/json',
  };

  final WifiPositioningDelay _delay;
  final Uri endpoint;
  final int maxAttempts;
  final Duration requestTimeout;
  final Duration retryDelay;
  final WifiPositioningHttpTransport transport;

  @override
  Future<WifiPositioningResponse> findClosestNode(
    WifiPositioningRequest request,
  ) async {
    final httpRequest = WifiPositioningHttpRequest(
      body: encodeWifiPositioningRequest(request),
      headers: _headers,
      timeout: requestTimeout,
      uri: endpoint,
    );

    for (var attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        final response = await transport.post(httpRequest);
        if (response.statusCode >= HttpStatus.ok &&
            response.statusCode < HttpStatus.multipleChoices) {
          try {
            return decodeWifiPositioningResponse(response.body);
          } catch (error) {
            throw WifiPositioningApiException(
              cause: error,
              code: WifiPositioningApiErrorCode.invalidResponse,
              message: 'The positioning server returned an invalid response.',
              statusCode: response.statusCode,
            );
          }
        }

        if (_retryableStatus(response.statusCode) && attempt < maxAttempts) {
          await _delay(retryDelay);
          continue;
        }
        throw _httpFailure(response.statusCode, response.body);
      } on WifiPositioningApiException {
        rethrow;
      } on TimeoutException catch (error) {
        if (attempt < maxAttempts) {
          await _delay(retryDelay);
          continue;
        }
        throw WifiPositioningApiException(
          cause: error,
          code: WifiPositioningApiErrorCode.timeout,
          message: 'The positioning request timed out.',
        );
      } on IOException catch (error) {
        if (attempt < maxAttempts) {
          await _delay(retryDelay);
          continue;
        }
        throw WifiPositioningApiException(
          cause: error,
          code: WifiPositioningApiErrorCode.networkFailure,
          message: 'The positioning server could not be reached.',
        );
      } on FormatException catch (error) {
        throw WifiPositioningApiException(
          cause: error,
          code: WifiPositioningApiErrorCode.invalidResponse,
          message: 'The positioning server returned invalid UTF-8 or JSON.',
        );
      }
    }
    throw StateError('Positioning retry loop completed unexpectedly.');
  }
}

WifiPositioningApiException _httpFailure(int statusCode, String body) {
  if (statusCode == HttpStatus.unprocessableEntity) {
    return WifiPositioningApiException(
      code: WifiPositioningApiErrorCode.validationRejected,
      message: _validationFailureMessage(body),
      statusCode: statusCode,
    );
  }
  if (statusCode >= HttpStatus.internalServerError) {
    return WifiPositioningApiException(
      code: WifiPositioningApiErrorCode.serverFailure,
      message: 'The positioning server failed with HTTP $statusCode.',
      statusCode: statusCode,
    );
  }
  return WifiPositioningApiException(
    code: WifiPositioningApiErrorCode.httpFailure,
    message: 'The positioning request failed with HTTP $statusCode.',
    statusCode: statusCode,
  );
}

String _validationFailureMessage(String body) {
  try {
    final decoded = jsonDecode(body);
    if (decoded is Map<String, Object?>) {
      final detail = decoded['detail'];
      if (detail is String && detail.trim().isNotEmpty) {
        return detail.trim();
      }
    }
  } on FormatException {
    // Fall through to a stable, non-sensitive message for malformed bodies.
  }
  return 'The positioning server rejected the request data.';
}

bool _retryableStatus(int statusCode) =>
    statusCode == HttpStatus.requestTimeout ||
    statusCode == HttpStatus.tooManyRequests ||
    statusCode == HttpStatus.internalServerError ||
    statusCode == HttpStatus.badGateway ||
    statusCode == HttpStatus.serviceUnavailable ||
    statusCode == HttpStatus.gatewayTimeout;

Uri _endpoint(String baseUrl) {
  final normalized = baseUrl.trim().replaceFirst(RegExp(r'/+$'), '');
  final uri = Uri.parse('$normalized/findClosestNode');
  if (uri.scheme != 'https' || uri.host.isEmpty) {
    throw ArgumentError.value(baseUrl, 'baseUrl', 'must be an HTTPS URL');
  }
  return uri;
}
