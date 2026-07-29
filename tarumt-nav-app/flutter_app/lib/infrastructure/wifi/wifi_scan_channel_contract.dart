abstract final class WifiScanChannelContract {
  static const int schemaVersion = 3;

  static const String methodChannelName =
      'indoor_navigation/wifi_scan/methods/v3';

  static const String checkAccessMethod = 'checkAccess';
  static const String requestPermissionMethod = 'requestPermission';
  static const String scanMethod = 'scan';
  static const String disposeMethod = 'dispose';

  static Map<String, Object?> get arguments => <String, Object?>{
    'schemaVersion': schemaVersion,
  };

  static Map<String, Object?> scanArguments({
    required bool requestActiveScan,
  }) => <String, Object?>{
    'schemaVersion': schemaVersion,
    'requestActiveScan': requestActiveScan,
  };
}
