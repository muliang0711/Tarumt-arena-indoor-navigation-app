import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

final class MapBundleHttpRequest {
  const MapBundleHttpRequest({
    required this.headers,
    required this.maxResponseBytes,
    required this.timeout,
    required this.uri,
  });

  final Map<String, String> headers;
  final int maxResponseBytes;
  final Duration timeout;
  final Uri uri;
}

final class MapBundleHttpResponse {
  const MapBundleHttpResponse({
    required this.body,
    required this.headers,
    required this.statusCode,
  });

  final Uint8List body;
  final Map<String, String> headers;
  final int statusCode;
}

abstract interface class MapBundleHttpTransport {
  Future<MapBundleHttpResponse> get(MapBundleHttpRequest request);
}

final class MapBundleHttpException implements Exception {
  const MapBundleHttpException(this.message);

  final String message;

  @override
  String toString() => 'MapBundleHttpException: $message';
}

final class DartIoMapBundleHttpTransport implements MapBundleHttpTransport {
  DartIoMapBundleHttpTransport({HttpClient? httpClient})
    : _httpClient = httpClient ?? HttpClient();

  final HttpClient _httpClient;

  @override
  Future<MapBundleHttpResponse> get(MapBundleHttpRequest request) async {
    if (request.maxResponseBytes < 0) {
      throw const MapBundleHttpException(
        'maxResponseBytes must not be negative.',
      );
    }
    HttpClientRequest? activeRequest;
    final operation = () async {
      activeRequest = await _httpClient.getUrl(request.uri);
      activeRequest!.followRedirects = false;
      for (final header in request.headers.entries) {
        activeRequest!.headers.set(header.key, header.value);
      }
      final response = await activeRequest!.close();
      final declaredLength = response.contentLength;
      if (declaredLength > request.maxResponseBytes) {
        throw MapBundleHttpException(
          'Response declares $declaredLength bytes, exceeding '
          '${request.maxResponseBytes}.',
        );
      }
      final body = BytesBuilder(copy: false);
      await for (final chunk in response) {
        if (body.length + chunk.length > request.maxResponseBytes) {
          throw MapBundleHttpException(
            'Response exceeded ${request.maxResponseBytes} bytes.',
          );
        }
        body.add(chunk);
      }
      final headers = <String, String>{};
      response.headers.forEach((name, values) {
        headers[name.toLowerCase()] = values.join(',');
      });
      return MapBundleHttpResponse(
        body: body.takeBytes(),
        headers: Map.unmodifiable(headers),
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
