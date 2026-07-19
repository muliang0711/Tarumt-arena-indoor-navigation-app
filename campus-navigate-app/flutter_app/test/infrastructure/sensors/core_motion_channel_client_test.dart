import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/infrastructure/sensors/core_motion_channel_client.dart';
import 'package:indoor_navigation/infrastructure/sensors/core_motion_channel_contract.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const methodChannel = MethodChannel(
    CoreMotionChannelContract.methodChannelName,
  );
  const eventChannel = EventChannel(CoreMotionChannelContract.eventChannelName);

  tearDown(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(methodChannel, null);
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockStreamHandler(eventChannel, null);
  });

  test(
    'default client uses the versioned channel and preserves arguments',
    () async {
      MethodCall? received;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(methodChannel, (call) async {
            received = call;
            return <String, Object?>{'schemaVersion': 1};
          });
      final client = FlutterCoreMotionChannelClient();
      const arguments = <String, Object?>{'schemaVersion': 1, 'generation': 4};

      final result = await client.invokeMethod(
        CoreMotionChannelContract.stopMethod,
        arguments: arguments,
      );

      expect(received?.method, CoreMotionChannelContract.stopMethod);
      expect(received?.arguments, arguments);
      expect(result, <Object?, Object?>{'schemaVersion': 1});
    },
  );

  test(
    'translates Flutter platform failures before they reach the adapter',
    () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(methodChannel, (call) async {
            throw PlatformException(code: 'unavailable', message: 'No motion');
          });
      final client = FlutterCoreMotionChannelClient();

      await expectLater(
        client.invokeMethod(CoreMotionChannelContract.checkAvailabilityMethod),
        throwsA(
          isA<CoreMotionChannelFailure>()
              .having((error) => error.code, 'code', 'unavailable')
              .having((error) => error.message, 'message', 'No motion'),
        ),
      );
    },
  );

  test('default versioned event channel translates stream errors', () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockStreamHandler(
          eventChannel,
          MockStreamHandler.inline(
            onListen: (arguments, events) {
              events.success(<String, Object?>{
                'schemaVersion': 1,
                'kind': 'motion',
              });
              events.error(code: 'streamFailed', message: 'event failed');
              events.endOfStream();
            },
          ),
        );
    final client = FlutterCoreMotionChannelClient();

    await expectLater(
      client.events,
      emitsInOrder(<Object?>[
        isA<Map<Object?, Object?>>(),
        emitsError(
          isA<CoreMotionChannelFailure>()
              .having((error) => error.code, 'code', 'streamFailed')
              .having((error) => error.message, 'message', 'event failed'),
        ),
        emitsDone,
      ]),
    );
  });
}
