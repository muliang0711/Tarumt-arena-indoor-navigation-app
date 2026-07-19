import 'dart:collection';

import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';
import 'package:indoor_navigation/infrastructure/wifi/android_wifi_scan_manager.dart';
import 'package:indoor_navigation/infrastructure/wifi/unsupported_wifi_scan_manager.dart';
import 'package:indoor_navigation/infrastructure/wifi/wifi_scan_channel_client.dart';
import 'package:indoor_navigation/infrastructure/wifi/wifi_scan_channel_contract.dart';

void main() {
  test(
    'forwards versioned access, permission, scan, and dispose calls',
    () async {
      final client = _FakeWifiScanChannelClient()
        ..enqueue(WifiScanChannelContract.checkAccessMethod, _accessResponse)
        ..enqueue(
          WifiScanChannelContract.requestPermissionMethod,
          _accessResponse,
        )
        ..enqueue(WifiScanChannelContract.scanMethod, _scanResponse)
        ..enqueue(WifiScanChannelContract.disposeMethod, <String, Object?>{
          'schemaVersion': 1,
        });
      final manager = AndroidWifiScanManager.withClient(client);

      expect((await manager.checkAccess()).canScan, isTrue);
      expect((await manager.requestPermission()).canScan, isTrue);
      expect((await manager.scan()).readings.single.rssi, -55);
      await manager.dispose();
      await manager.dispose();

      expect(
        client.invocations.map((invocation) => invocation.method),
        <String>['checkAccess', 'requestPermission', 'scan', 'dispose'],
      );
      for (final invocation in client.invocations) {
        expect(invocation.arguments, <String, Object?>{'schemaVersion': 1});
      }
      await expectLater(
        manager.checkAccess(),
        throwsA(
          isA<WifiScanException>().having(
            (error) => error.code,
            'code',
            WifiScanErrorCode.disposed,
          ),
        ),
      );
    },
  );

  test('maps every native failure into a stable application code', () async {
    const mappings = <String, WifiScanErrorCode>{
      'disposed': WifiScanErrorCode.disposed,
      'locationServicesDisabled': WifiScanErrorCode.locationServicesDisabled,
      'permissionDenied': WifiScanErrorCode.permissionDenied,
      'permissionRequestInProgress':
          WifiScanErrorCode.permissionRequestInProgress,
      'scanInProgress': WifiScanErrorCode.scanInProgress,
      'scanThrottled': WifiScanErrorCode.scanThrottled,
      'unsupported': WifiScanErrorCode.unsupported,
      'wifiDisabled': WifiScanErrorCode.wifiDisabled,
      'unexpected': WifiScanErrorCode.scanFailed,
    };

    for (final entry in mappings.entries) {
      final client = _FakeWifiScanChannelClient()
        ..enqueue(
          WifiScanChannelContract.scanMethod,
          WifiScanChannelFailure(code: entry.key, message: 'native failure'),
        );
      final manager = AndroidWifiScanManager.withClient(client);

      await expectLater(
        manager.scan(),
        throwsA(
          isA<WifiScanException>()
              .having((error) => error.code, 'code', entry.value)
              .having((error) => error.message, 'message', 'native failure'),
        ),
      );
    }
  });

  test(
    'unsupported platforms report capability without invoking native code',
    () async {
      final manager = UnsupportedWifiScanManager(platformName: 'iOS');

      final access = await manager.checkAccess();
      expect(access.platformSupport, WifiScanPlatformSupport.unsupported);
      expect(access.canScan, isFalse);
      expect(
        await manager.requestPermission(),
        isA<WifiScanAccessState>().having(
          (state) => state.platformSupport,
          'platformSupport',
          WifiScanPlatformSupport.unsupported,
        ),
      );
      await expectLater(
        manager.scan(),
        throwsA(
          isA<WifiScanException>().having(
            (error) => error.code,
            'code',
            WifiScanErrorCode.unsupported,
          ),
        ),
      );
    },
  );
}

final class _Invocation {
  const _Invocation({required this.arguments, required this.method});

  final Map<String, Object?>? arguments;
  final String method;
}

final class _FakeWifiScanChannelClient implements WifiScanChannelClient {
  final List<_Invocation> invocations = <_Invocation>[];
  final Map<String, Queue<Object?>> _outcomes = <String, Queue<Object?>>{};

  void enqueue(String method, Object? outcome) {
    (_outcomes[method] ??= Queue<Object?>()).add(outcome);
  }

  @override
  Future<Object?> invokeMethod(
    String method, {
    Map<String, Object?>? arguments,
  }) async {
    invocations.add(_Invocation(arguments: arguments, method: method));
    final outcome = _outcomes[method]!.removeFirst();
    if (outcome is Exception) throw outcome;
    return outcome;
  }
}

const Map<String, Object?> _accessResponse = <String, Object?>{
  'schemaVersion': 1,
  'platformSupport': 'supported',
  'permission': 'granted',
  'wifiEnabled': true,
  'locationServicesEnabled': true,
};

const Map<String, Object?> _scanResponse = <String, Object?>{
  'schemaVersion': 1,
  'startedAtMs': 100,
  'completedAtMs': 200,
  'readings': <Object?>[
    <String, Object?>{
      'bssid': 'AA:BB:CC:DD:EE:FF',
      'rssi': -55,
      'observedAtMs': 150,
      'frequencyMhz': 2412,
      'ssid': 'Campus',
    },
  ],
};
