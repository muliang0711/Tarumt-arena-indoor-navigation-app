import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/infrastructure/presence/http/anonymous_session_api.dart';

void main() {
  test('sends display name with the anonymous installation identity', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(() => server.close(force: true));
    Map<String, dynamic>? received;
    final requestHandled = server.first.then((request) async {
      received =
          jsonDecode(await utf8.decoder.bind(request).join())
              as Map<String, dynamic>;
      request.response
        ..statusCode = HttpStatus.created
        ..headers.contentType = ContentType.json
        ..write(
          jsonEncode(<String, String>{
            'access_token': 'token',
            'session_expires_at': '2026-08-03T00:00:00Z',
            'session_id': 'session-1',
            'token_expires_at': '2026-08-03T00:00:00Z',
            'websocket_path': '/v1/presence',
          }),
        );
      await request.response.close();
    });
    final api = AnonymousSessionApi(
      baseUrl: Uri.parse('http://127.0.0.1:${server.port}'),
    );
    addTearDown(api.close);

    await api.create('installation-1', displayName: 'IShowSpeed');
    await requestHandled;

    expect(received, <String, Object>{
      'installation_id': 'installation-1',
      'display_name': 'IShowSpeed',
    });
  });
}
