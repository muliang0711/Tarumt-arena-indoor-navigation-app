abstract final class WifiScanChannelContract {
  static const int schemaVersion = 1;

  static const String methodChannelName =
      'indoor_navigation/wifi_scan/methods/v1';

  static const String checkAccessMethod = 'checkAccess';
  static const String requestPermissionMethod = 'requestPermission';
  static const String scanMethod = 'scan';
  static const String disposeMethod = 'dispose';

  static Map<String, Object?> get arguments => <String, Object?>{
    'schemaVersion': schemaVersion,
  };
}
