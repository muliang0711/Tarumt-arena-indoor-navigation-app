import 'package:flutter/services.dart';
import 'package:indoor_navigation/infrastructure/wifi/wifi_scan_channel_contract.dart';

abstract interface class WifiScanChannelClient {
  Future<Object?> invokeMethod(
    String method, {
    Map<String, Object?>? arguments,
  });
}

final class WifiScanChannelFailure implements Exception {
  const WifiScanChannelFailure({required this.code, required this.message});

  final String code;
  final String message;

  @override
  String toString() => 'WifiScanChannelFailure($code): $message';
}

final class FlutterWifiScanChannelClient implements WifiScanChannelClient {
  FlutterWifiScanChannelClient({MethodChannel? methodChannel})
    : _methodChannel =
          methodChannel ??
          const MethodChannel(WifiScanChannelContract.methodChannelName);

  final MethodChannel _methodChannel;

  @override
  Future<Object?> invokeMethod(
    String method, {
    Map<String, Object?>? arguments,
  }) async {
    try {
      return await _methodChannel.invokeMethod<Object?>(method, arguments);
    } on PlatformException catch (error) {
      throw WifiScanChannelFailure(
        code: error.code,
        message: error.message ?? 'Wi-Fi scan channel method failed.',
      );
    } on MissingPluginException catch (error) {
      throw WifiScanChannelFailure(
        code: 'unsupported',
        message: error.message ?? 'Wi-Fi scanning is unavailable.',
      );
    }
  }
}
