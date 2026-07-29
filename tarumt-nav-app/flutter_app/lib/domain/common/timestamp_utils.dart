String createSensorDebugSessionId(int nowMs) {
  final timestamp = DateTime.fromMillisecondsSinceEpoch(nowMs, isUtc: true)
      .toIso8601String()
      .replaceFirst(RegExp(r'\.\d{3}Z$'), 'Z')
      .replaceAll(RegExp('[:.]'), '-');
  return 'step-test-$timestamp';
}
