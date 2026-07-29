import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/infrastructure/wifi_positioning/wifi_positioning_http_transport.dart';

void main() {
  test('Dart IO transport preserves request and response data', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(server.close);
    final received = <String, Object?>{};
    server.listen((request) async {
      received['method'] = request.method;
      received['contentType'] = request.headers.contentType?.mimeType;
      received['accept'] = request.headers.value('accept');
      received['body'] = await utf8.decoder.bind(request).join();
      request.response.statusCode = HttpStatus.ok;
      request.response.write('{"nodeId":"node-1"}');
      await request.response.close();
    });
    final transport = DartIoWifiPositioningHttpTransport();

    final response = await transport.post(
      WifiPositioningHttpRequest(
        body: '{"timestamp":1}',
        headers: const {
          'accept': 'application/json',
          'content-type': 'application/json',
        },
        timeout: const Duration(seconds: 2),
        uri: Uri.parse('http://127.0.0.1:${server.port}/findClosestNode'),
      ),
    );

    expect(response.statusCode, 200);
    expect(response.body, '{"nodeId":"node-1"}');
    expect(received, <String, Object?>{
      'method': 'POST',
      'contentType': 'application/json',
      'accept': 'application/json',
      'body': '{"timestamp":1}',
    });
  });

  test('Dart IO transport sends Unicode JSON as UTF-8 bytes', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(server.close);
    String? receivedBody;
    server.listen((request) async {
      receivedBody = await utf8.decoder.bind(request).join();
      request.response.statusCode = HttpStatus.ok;
      request.response.write('{"nodeId":"node-1"}');
      await request.response.close();
    });
    final transport = DartIoWifiPositioningHttpTransport();
    const body = '{"ssid":"tarc wifi我的天啊 👻"}';

    final response = await transport.post(
      WifiPositioningHttpRequest(
        body: body,
        headers: const {
          'accept': 'application/json',
          'content-type': 'application/json',
        },
        timeout: const Duration(seconds: 2),
        uri: Uri.parse('http://127.0.0.1:${server.port}/findClosestNode'),
      ),
    );

    expect(response.statusCode, HttpStatus.ok);
    expect(receivedBody, body);
  });
}
