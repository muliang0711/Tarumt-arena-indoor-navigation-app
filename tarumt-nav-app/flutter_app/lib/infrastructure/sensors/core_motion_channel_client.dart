import 'dart:async';

import 'package:flutter/services.dart';
import 'package:indoor_navigation/infrastructure/sensors/core_motion_channel_contract.dart';

/// Pure-Dart-facing seam around Flutter's platform channel objects.
///
/// This is public only so the infrastructure adapter can be tested without a
/// binary messenger. Application code should depend on `SensorDeviceManager`.
abstract interface class CoreMotionChannelClient {
  Stream<Object?> get events;

  Future<Object?> invokeMethod(
    String method, {
    Map<String, Object?>? arguments,
  });
}

final class CoreMotionChannelFailure implements Exception {
  const CoreMotionChannelFailure({required this.code, required this.message});

  final String code;
  final String message;

  @override
  String toString() => 'CoreMotionChannelFailure($code): $message';
}

final class FlutterCoreMotionChannelClient implements CoreMotionChannelClient {
  FlutterCoreMotionChannelClient({
    MethodChannel? methodChannel,
    EventChannel? eventChannel,
  }) : _methodChannel =
           methodChannel ??
           const MethodChannel(CoreMotionChannelContract.methodChannelName),
       _eventChannel =
           eventChannel ??
           const EventChannel(CoreMotionChannelContract.eventChannelName);

  final EventChannel _eventChannel;
  final MethodChannel _methodChannel;

  @override
  Stream<Object?> get events {
    return _eventChannel.receiveBroadcastStream().cast<Object?>().transform(
      StreamTransformer<Object?, Object?>.fromHandlers(
        handleError: (error, stackTrace, sink) {
          sink.addError(_translateFlutterError(error), stackTrace);
        },
      ),
    );
  }

  @override
  Future<Object?> invokeMethod(
    String method, {
    Map<String, Object?>? arguments,
  }) async {
    try {
      return await _methodChannel.invokeMethod<Object?>(method, arguments);
    } on PlatformException catch (error) {
      throw CoreMotionChannelFailure(
        code: error.code,
        message: error.message ?? 'Core Motion channel method failed.',
      );
    } on MissingPluginException catch (error) {
      throw CoreMotionChannelFailure(
        code: 'missingPlugin',
        message: error.message ?? 'Core Motion channel plugin is unavailable.',
      );
    }
  }
}

Object _translateFlutterError(Object error) {
  if (error is PlatformException) {
    return CoreMotionChannelFailure(
      code: error.code,
      message: error.message ?? 'Core Motion event channel failed.',
    );
  }
  if (error is MissingPluginException) {
    return CoreMotionChannelFailure(
      code: 'missingPlugin',
      message: error.message ?? 'Core Motion event channel is unavailable.',
    );
  }
  return error;
}
