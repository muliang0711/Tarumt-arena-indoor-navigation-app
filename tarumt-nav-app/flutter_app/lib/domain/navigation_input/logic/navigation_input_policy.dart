import 'package:indoor_navigation/domain/config/app_config.dart';
import 'package:indoor_navigation/domain/navigation/derived_navigation_estimate.dart';
import 'package:indoor_navigation/domain/navigation_input/navigation_input_models.dart';

void assertRawSensorRecordingDisabled([
  NavigationInputPolicy policy = navigationInputPolicy,
]) {
  if (policy.rawSensorRecordingEnabled != false) {
    throw StateError('Raw sensor recording must stay disabled.');
  }
}

void assertTransientRawSensorBatchingAllowed([
  NavigationInputPolicy policy = navigationInputPolicy,
]) {
  if (policy.transientRawSensorBatchingEnabled != true) {
    throw StateError('Transient raw sensor batching must stay enabled.');
  }
}

bool shouldAcceptDerivedEstimate({
  required DerivedNavigationEstimate nextEstimate,
  required DerivedNavigationEstimate? previousEstimate,
  NavigationInputPolicy policy = navigationInputPolicy,
}) {
  assertRawSensorRecordingDisabled(policy);
  if (previousEstimate == null) {
    return true;
  }

  final minimumIntervalMs = 1000 / policy.maxDerivedUpdatesPerSecond;
  return nextEstimate.timestampMs - previousEstimate.timestampMs >=
      minimumIntervalMs;
}
