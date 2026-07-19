import 'package:indoor_navigation/application/ports/wifi/wifi_scan_manager.dart';
import 'package:indoor_navigation/application/ports/wifi/wifi_scan_models.dart';
import 'package:indoor_navigation/infrastructure/wifi/wifi_scan_channel_client.dart';
import 'package:indoor_navigation/infrastructure/wifi/wifi_scan_channel_contract.dart';
import 'package:indoor_navigation/infrastructure/wifi/wifi_scan_channel_decoder.dart';

final class AndroidWifiScanManager implements WifiScanManager {
  factory AndroidWifiScanManager() {
    return AndroidWifiScanManager.withClient(FlutterWifiScanChannelClient());
  }

  AndroidWifiScanManager.withClient(this._client);

  final WifiScanChannelClient _client;
  bool _disposed = false;

  @override
  Future<WifiScanAccessState> checkAccess() async {
    _ensureNotDisposed();
    try {
      final raw = await _client.invokeMethod(
        WifiScanChannelContract.checkAccessMethod,
        arguments: WifiScanChannelContract.arguments,
      );
      return WifiScanChannelDecoder.decodeAccess(raw);
    } catch (error) {
      throw _typedFailure(error, operation: 'access check');
    }
  }

  @override
  Future<WifiScanAccessState> requestPermission() async {
    _ensureNotDisposed();
    try {
      final raw = await _client.invokeMethod(
        WifiScanChannelContract.requestPermissionMethod,
        arguments: WifiScanChannelContract.arguments,
      );
      return WifiScanChannelDecoder.decodeAccess(raw);
    } catch (error) {
      throw _typedFailure(error, operation: 'permission request');
    }
  }

  @override
  Future<WifiScanBatch> scan() async {
    _ensureNotDisposed();
    try {
      final raw = await _client.invokeMethod(
        WifiScanChannelContract.scanMethod,
        arguments: WifiScanChannelContract.arguments,
      );
      return WifiScanChannelDecoder.decodeBatch(raw);
    } catch (error) {
      throw _typedFailure(error, operation: 'scan');
    }
  }

  @override
  Future<void> dispose() async {
    if (_disposed) {
      return;
    }
    _disposed = true;
    try {
      final raw = await _client.invokeMethod(
        WifiScanChannelContract.disposeMethod,
        arguments: WifiScanChannelContract.arguments,
      );
      WifiScanChannelDecoder.expectControlResponse(raw);
    } catch (error) {
      throw _typedFailure(error, operation: 'dispose');
    }
  }

  void _ensureNotDisposed() {
    if (_disposed) {
      throw const WifiScanException(
        code: WifiScanErrorCode.disposed,
        message: 'Wi-Fi scan manager is disposed.',
      );
    }
  }
}

WifiScanException _typedFailure(Object error, {required String operation}) {
  if (error is WifiScanException) {
    return error;
  }
  final code = error is WifiScanChannelFailure ? error.code : null;
  return WifiScanException(
    cause: error,
    code: switch (code) {
      'disposed' => WifiScanErrorCode.disposed,
      'locationServicesDisabled' => WifiScanErrorCode.locationServicesDisabled,
      'permissionDenied' => WifiScanErrorCode.permissionDenied,
      'permissionRequestInProgress' =>
        WifiScanErrorCode.permissionRequestInProgress,
      'scanInProgress' => WifiScanErrorCode.scanInProgress,
      'scanThrottled' => WifiScanErrorCode.scanThrottled,
      'unsupported' => WifiScanErrorCode.unsupported,
      'wifiDisabled' => WifiScanErrorCode.wifiDisabled,
      _ => WifiScanErrorCode.scanFailed,
    },
    message: error is WifiScanChannelFailure
        ? error.message
        : 'Wi-Fi scan $operation failed.',
  );
}
