// ignore_for_file: prefer_initializing_formals

import 'dart:convert';
import 'dart:io';

final class AnonymousSession {
  const AnonymousSession({
    required this.accessToken,
    required this.sessionExpiresAt,
    required this.sessionId,
    required this.tokenExpiresAt,
    required this.webSocketPath,
  });

  final String accessToken;
  final DateTime sessionExpiresAt;
  final String sessionId;
  final DateTime tokenExpiresAt;
  final String webSocketPath;
}

final class AnonymousSessionException implements Exception {
  const AnonymousSessionException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  bool get isAuthenticationFailure => statusCode == 401 || statusCode == 403;

  @override
  String toString() => 'AnonymousSessionException: $message';
}

final class AnonymousSessionApi {
  AnonymousSessionApi({
    required Uri baseUrl,
    HttpClient? httpClient,
    this.timeout = const Duration(seconds: 8),
  }) : _baseUrl = baseUrl,
       _httpClient = httpClient ?? HttpClient();

  final Uri _baseUrl;
  final HttpClient _httpClient;
  final Duration timeout;

  Future<AnonymousSession> create(
    String installationId, {
    String? displayName,
  }) async {
    final endpoint = _baseUrl.resolve('/v1/anonymous-sessions');
    try {
      final request = await _httpClient.postUrl(endpoint).timeout(timeout);
      request.headers.contentType = ContentType.json;
      request.write(
        jsonEncode(<String, String>{
          'installation_id': installationId,
          if (displayName != null && displayName.trim().isNotEmpty)
            'display_name': displayName.trim(),
        }),
      );
      final response = await request.close().timeout(timeout);
      final body = await utf8.decoder.bind(response).join().timeout(timeout);
      if (response.statusCode != HttpStatus.created) {
        throw AnonymousSessionException(
          'session endpoint returned HTTP ${response.statusCode}',
          statusCode: response.statusCode,
        );
      }
      final decoded = jsonDecode(body);
      if (decoded is! Map<String, dynamic>) {
        throw const AnonymousSessionException(
          'session response is not an object',
        );
      }
      return AnonymousSession(
        accessToken: _requiredString(decoded, 'access_token'),
        sessionExpiresAt: DateTime.parse(
          _requiredString(decoded, 'session_expires_at'),
        ).toUtc(),
        sessionId: _requiredString(decoded, 'session_id'),
        tokenExpiresAt: DateTime.parse(
          _requiredString(decoded, 'token_expires_at'),
        ).toUtc(),
        webSocketPath: _requiredString(decoded, 'websocket_path'),
      );
    } on AnonymousSessionException {
      rethrow;
    } on Object catch (error) {
      throw AnonymousSessionException(
        'could not create anonymous session: $error',
      );
    }
  }

  void close() => _httpClient.close(force: true);
}

String _requiredString(Map<String, dynamic> source, String key) {
  final value = source[key];
  if (value is! String || value.trim().isEmpty) {
    throw AnonymousSessionException('session response is missing $key');
  }
  return value;
}
