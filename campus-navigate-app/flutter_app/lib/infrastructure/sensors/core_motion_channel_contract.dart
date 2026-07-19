/// Versioned wire contract shared by the Dart Core Motion adapter and the
/// application-owned iOS channel implementation.
abstract final class CoreMotionChannelContract {
  static const int schemaVersion = 1;

  static const String methodChannelName =
      'indoor_navigation/core_motion/methods/v1';
  static const String eventChannelName =
      'indoor_navigation/core_motion/events/v1';

  static const String checkAvailabilityMethod = 'checkAvailability';
  static const String requestPermissionsMethod = 'requestPermissions';
  static const String startMethod = 'start';
  static const String stopMethod = 'stop';
  static const String disposeMethod = 'dispose';

  static const String motionEventKind = 'motion';
  static const String headingEventKind = 'heading';
  static const String errorEventKind = 'error';

  static const String magnetometerHeadingSource = 'magnetometer';
  static const String deviceMotionFallbackHeadingSource =
      'deviceMotionFallback';

  static const String streamFailedErrorCode = 'streamFailed';
  static const String interruptedErrorCode = 'interrupted';
}
