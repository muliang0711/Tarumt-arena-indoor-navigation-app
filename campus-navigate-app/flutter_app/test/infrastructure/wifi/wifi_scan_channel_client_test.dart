import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/infrastructure/wifi/wifi_scan_channel_client.dart';
import 'package:indoor_navigation/infrastructure/wifi/wifi_scan_channel_contract.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel(WifiScanChannelContract.methodChannelName);

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  test('uses the versioned Wi-Fi scan method channel', () async {
    MethodCall? received;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
          received = call;
          return <String, Object?>{'schemaVersion': 1};
        });
    final client = FlutterWifiScanChannelClient();

    await client.invokeMethod(
      WifiScanChannelContract.disposeMethod,
      arguments: WifiScanChannelContract.arguments,
    );

    expect(received?.method, 'dispose');
    expect(received?.arguments, <String, Object?>{'schemaVersion': 1});
  });

  test('translates native platform failures', () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
          throw PlatformException(
            code: 'wifiDisabled',
            message: 'Enable Wi-Fi',
          );
        });
    final client = FlutterWifiScanChannelClient();

    await expectLater(
      client.invokeMethod(
        WifiScanChannelContract.scanMethod,
        arguments: WifiScanChannelContract.arguments,
      ),
      throwsA(
        isA<WifiScanChannelFailure>()
            .having((error) => error.code, 'code', 'wifiDisabled')
            .having((error) => error.message, 'message', 'Enable Wi-Fi'),
      ),
    );
  });
}
