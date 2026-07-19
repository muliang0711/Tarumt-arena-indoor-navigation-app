import 'package:indoor_navigation/application/ports/sensors/sensor_device_manager.dart';
import 'package:indoor_navigation/application/ports/sensors/sensor_models.dart';
import 'package:indoor_navigation/application/ports/time/clock.dart';
import 'package:indoor_navigation/infrastructure/sensors/core_motion_sensor_device_manager.dart';

/// Android motion adapter for the normalized application sensor contract.
///
/// The Android runner implements the same versioned platform-channel wire
/// schema as iOS, so parsing, stale-generation suppression, and lifecycle
/// behavior remain identical above the native boundary.
final class AndroidMotionSensorDeviceManager implements SensorDeviceManager {
  factory AndroidMotionSensorDeviceManager({required Clock clock}) {
    return AndroidMotionSensorDeviceManager.withDelegate(
      CoreMotionSensorDeviceManager(clock: clock),
    );
  }

  AndroidMotionSensorDeviceManager.withDelegate(SensorDeviceManager delegate)
    : _delegate = delegate;

  final SensorDeviceManager _delegate;

  @override
  Stream<NormalizedSensorEvent> get events => _delegate.events;

  @override
  Future<SensorAvailability> checkAvailability() {
    return _delegate.checkAvailability();
  }

  @override
  Future<SensorPermissionStatus> requestPermissions() {
    return _delegate.requestPermissions();
  }

  @override
  Future<void> start(SensorSamplingRequest request) {
    return _delegate.start(request);
  }

  @override
  Future<void> stop() => _delegate.stop();

  @override
  Future<void> dispose() => _delegate.dispose();
}
