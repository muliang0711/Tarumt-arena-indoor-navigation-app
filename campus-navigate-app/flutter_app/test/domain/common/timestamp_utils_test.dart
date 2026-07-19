import 'package:flutter_test/flutter_test.dart';
import 'package:indoor_navigation/domain/common/timestamp_utils.dart';

void main() {
  test(
    'creates the same UTC sensor debug session identifier as TypeScript',
    () {
      final timestamp = DateTime.utc(2025, 1, 2, 3, 4, 5, 123);

      expect(
        createSensorDebugSessionId(timestamp.millisecondsSinceEpoch),
        'step-test-2025-01-02T03-04-05Z',
      );
    },
  );
}
