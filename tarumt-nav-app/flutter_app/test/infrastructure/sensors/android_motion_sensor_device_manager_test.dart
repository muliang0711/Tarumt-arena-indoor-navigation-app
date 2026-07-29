import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/application/ports/sensors/sensor_models.dart';
import 'package:indoor_navigation/domain/pdr/pdr_models.dart';
import 'package:indoor_navigation/infrastructure/sensors/android_motion_sensor_device_manager.dart';

import '../../support/fakes/fakes.dart';

void main() {
  test(
    'delegates the normalized sensor lifecycle without changing events',
    () async {
      final delegate = FakeSensorDeviceManager();
      final manager = AndroidMotionSensorDeviceManager.withDelegate(delegate);
      final events = <NormalizedSensorEvent>[];
      final subscription = manager.events.listen(events.add);

      expect((await manager.checkAvailability()).isMotionAvailable, isTrue);
      expect(
        await manager.requestPermissions(),
        SensorPermissionStatus.granted,
      );
      await manager.start(
        SensorSamplingRequest(
          headingUpdateIntervalMs: 50,
          motionUpdateIntervalMs: 30,
        ),
      );
      final event = MotionSensorEvent(
        accelerationMetersPerSecondSquared: MotionVector(x: 1, y: 2, z: 3),
        fallbackHeadingDegrees: 45,
        receivedAtMs: 1000,
      );
      delegate.emit(event);
      await Future<void>.delayed(Duration.zero);

      expect(events, [same(event)]);
      await manager.stop();
      await manager.dispose();
      await subscription.cancel();
      expect(delegate.stopCallCount, 1);
      expect(delegate.disposeCallCount, 1);
    },
  );
}
