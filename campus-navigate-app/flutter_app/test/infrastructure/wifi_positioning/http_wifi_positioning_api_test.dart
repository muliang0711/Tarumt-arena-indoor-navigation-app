import 'dart:async';
import 'dart:collection';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_positioning_api.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';
import 'package:indoor_navigation/infrastructure/wifi_positioning/http_wifi_positioning_api.dart';
import 'package:indoor_navigation/infrastructure/wifi_positioning/wifi_positioning_http_transport.dart';

void main() {
  test('posts JSON to the exact endpoint and accepts nodeId', () async {
    final transport = _FakeTransport()
      ..enqueue(
        const WifiPositioningHttpResponse(
          body: '{"nodeId":"node-12"}',
          statusCode: 200,
        ),
      );
    final delays = <Duration>[];
    final api = HttpWifiPositioningApi(
      baseUrl: 'https://example.test/',
      delay: (duration) async => delays.add(duration),
      transport: transport,
    );

    final response = await api.findClosestNode(_request());

    expect(response.serverNodeId, 'node-12');
    expect(transport.requests, hasLength(1));
    expect(
      transport.requests.single.uri,
      Uri.parse('https://example.test/findClosestNode'),
    );
    expect(transport.requests.single.headers, <String, String>{
      'accept': 'application/json',
      'content-type': 'application/json',
    });
    expect(transport.requests.single.timeout, const Duration(seconds: 15));
    expect(delays, isEmpty);
  });

  test('retries transient status once without exposing request data', () async {
    final transport = _FakeTransport()
      ..enqueue(
        const WifiPositioningHttpResponse(body: 'sleeping', statusCode: 503),
      )
      ..enqueue(
        const WifiPositioningHttpResponse(
          body: '{"nodeId":"node-1"}',
          statusCode: 200,
        ),
      );
    final delays = <Duration>[];
    final api = HttpWifiPositioningApi(
      baseUrl: 'https://example.test',
      delay: (duration) async => delays.add(duration),
      retryDelay: const Duration(milliseconds: 10),
      transport: transport,
    );

    expect((await api.findClosestNode(_request())).serverNodeId, 'node-1');
    expect(transport.requests, hasLength(2));
    expect(delays, [const Duration(milliseconds: 10)]);
  });

  test(
    'retries transport timeout then returns a typed final timeout',
    () async {
      final transport = _FakeTransport()
        ..enqueue(TimeoutException('first'))
        ..enqueue(TimeoutException('second'));
      final api = HttpWifiPositioningApi(
        baseUrl: 'https://example.test',
        delay: (_) async {},
        transport: transport,
      );

      await expectLater(
        api.findClosestNode(_request()),
        throwsA(
          isA<WifiPositioningApiException>()
              .having(
                (error) => error.code,
                'code',
                WifiPositioningApiErrorCode.timeout,
              )
              .having(
                (error) => error.message,
                'message',
                isNot(contains('AA:')),
              ),
        ),
      );
      expect(transport.requests, hasLength(2));
    },
  );

  test(
    'does not retry validation errors or malformed success bodies',
    () async {
      final cases = <({Object response, WifiPositioningApiErrorCode code})>[
        (
          response: const WifiPositioningHttpResponse(
            body: '{"detail":[]}',
            statusCode: 422,
          ),
          code: WifiPositioningApiErrorCode.validationRejected,
        ),
        (
          response: const WifiPositioningHttpResponse(
            body: '{"closestNode":"node-1"}',
            statusCode: 200,
          ),
          code: WifiPositioningApiErrorCode.invalidResponse,
        ),
      ];

      for (final testCase in cases) {
        final transport = _FakeTransport()..enqueue(testCase.response);
        final api = HttpWifiPositioningApi(
          baseUrl: 'https://example.test',
          delay: (_) async {},
          transport: transport,
        );

        await expectLater(
          api.findClosestNode(_request()),
          throwsA(
            isA<WifiPositioningApiException>().having(
              (error) => error.code,
              'code',
              testCase.code,
            ),
          ),
        );
        expect(transport.requests, hasLength(1));
      }
    },
  );

  test('preserves a textual validation detail from the server', () async {
    final transport = _FakeTransport()
      ..enqueue(
        const WifiPositioningHttpResponse(
          body: '{"detail":"The scan does not contain trained access points"}',
          statusCode: 422,
        ),
      );
    final api = HttpWifiPositioningApi(
      baseUrl: 'https://example.test',
      delay: (_) async {},
      transport: transport,
    );

    await expectLater(
      api.findClosestNode(_request()),
      throwsA(
        isA<WifiPositioningApiException>()
            .having(
              (error) => error.code,
              'code',
              WifiPositioningApiErrorCode.validationRejected,
            )
            .having(
              (error) => error.message,
              'message',
              'The scan does not contain trained access points',
            ),
      ),
    );
  });

  test('classifies final server and ordinary HTTP failures', () async {
    for (final testCase in <({int status, WifiPositioningApiErrorCode code})>[
      (status: 500, code: WifiPositioningApiErrorCode.serverFailure),
      (status: 401, code: WifiPositioningApiErrorCode.httpFailure),
    ]) {
      final transport = _FakeTransport();
      for (var index = 0; index < 2; index += 1) {
        transport.enqueue(
          WifiPositioningHttpResponse(body: '', statusCode: testCase.status),
        );
      }
      final api = HttpWifiPositioningApi(
        baseUrl: 'https://example.test',
        delay: (_) async {},
        transport: transport,
      );

      await expectLater(
        api.findClosestNode(_request()),
        throwsA(
          isA<WifiPositioningApiException>()
              .having((error) => error.code, 'code', testCase.code)
              .having(
                (error) => error.statusCode,
                'statusCode',
                testCase.status,
              ),
        ),
      );
      expect(transport.requests, hasLength(testCase.status == 500 ? 2 : 1));
    }
  });
}

WifiPositioningRequest _request() => WifiPositioningRequest(
  checkedServerNodeIds: const ['node-1'],
  readings: <WifiAccessPointReading>[
    WifiAccessPointReading(
      bssid: 'AA:BB:CC:DD:EE:FF',
      frequencyMhz: 2412,
      observedAtMs: 100,
      rssi: -50,
      ssid: null,
    ),
  ],
  timestampMs: 200,
);

final class _FakeTransport implements WifiPositioningHttpTransport {
  final Queue<Object> _outcomes = Queue<Object>();
  final List<WifiPositioningHttpRequest> requests =
      <WifiPositioningHttpRequest>[];

  void enqueue(Object outcome) => _outcomes.add(outcome);

  @override
  Future<WifiPositioningHttpResponse> post(
    WifiPositioningHttpRequest request,
  ) async {
    requests.add(request);
    final outcome = _outcomes.removeFirst();
    if (outcome is Exception) throw outcome;
    return outcome as WifiPositioningHttpResponse;
  }
}
