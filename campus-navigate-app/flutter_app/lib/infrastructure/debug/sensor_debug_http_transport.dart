import 'dart:async';
import 'dart:io';

final class SensorDebugHttpRequest {
  const SensorDebugHttpRequest({
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

abstract interface class SensorDebugHttpTransport {
  Future<void> post(SensorDebugHttpRequest request);
}

final class DartIoSensorDebugHttpTransport implements SensorDebugHttpTransport {
  DartIoSensorDebugHttpTransport({HttpClient? httpClient})
    : _httpClient = httpClient ?? HttpClient();

  final HttpClient _httpClient;

  @override
  Future<void> post(SensorDebugHttpRequest request) async {
    HttpClientRequest? activeRequest;

    final operation = () async {
      activeRequest = await _httpClient.postUrl(request.uri);
      for (final MapEntry<String, String> header in request.headers.entries) {
        activeRequest!.headers.set(header.key, header.value);
      }
      activeRequest!.write(request.body);

      final response = await activeRequest!.close();
      await response.drain<void>();
      if (response.statusCode < HttpStatus.ok ||
          response.statusCode >= HttpStatus.multipleChoices) {
        throw HttpException(
          'Sensor debug POST failed with HTTP ${response.statusCode}.',
          uri: request.uri,
        );
      }
    }();

    try {
      await operation.timeout(request.timeout);
    } on TimeoutException catch (error) {
      activeRequest?.abort(error);
      rethrow;
    }
  }
}
