import 'dart:async';
import 'dart:convert';
import 'dart:io';

final class WifiPositioningHttpRequest {
  const WifiPositioningHttpRequest({
    required this.body,
    required this.headers,
    required this.timeout,
    required this.uri,
  });

  final String body;
  final Map<String, String> headers;
  final Duration timeout;
  final Uri uri;
}

final class WifiPositioningHttpResponse {
  const WifiPositioningHttpResponse({
    required this.body,
    required this.statusCode,
  });

  final String body;
  final int statusCode;
}

abstract interface class WifiPositioningHttpTransport {
  Future<WifiPositioningHttpResponse> post(WifiPositioningHttpRequest request);
}

final class DartIoWifiPositioningHttpTransport
    implements WifiPositioningHttpTransport {
  DartIoWifiPositioningHttpTransport({HttpClient? httpClient})
    : _httpClient = httpClient ?? HttpClient();

  final HttpClient _httpClient;

  @override
  Future<WifiPositioningHttpResponse> post(
    WifiPositioningHttpRequest request,
  ) async {
    HttpClientRequest? activeRequest;
    final operation = () async {
      activeRequest = await _httpClient.postUrl(request.uri);
      for (final header in request.headers.entries) {
        activeRequest!.headers.set(header.key, header.value);
      }
      activeRequest!.write(request.body);
      final response = await activeRequest!.close();
      final body = await response.transform(const Utf8Decoder()).join();
      return WifiPositioningHttpResponse(
        body: body,
        statusCode: response.statusCode,
      );
    }();

    try {
      return await operation.timeout(request.timeout);
    } on TimeoutException catch (error) {
      activeRequest?.abort(error);
      rethrow;
    }
  }
}
