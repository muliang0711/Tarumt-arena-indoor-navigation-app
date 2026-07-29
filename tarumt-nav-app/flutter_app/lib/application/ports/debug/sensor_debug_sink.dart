import 'package:indoor_navigation/domain/sensor_debug/sensor_debug_models.dart';

/// Best-effort output boundary for aggregate sensor diagnostics.
///
/// The `void` methods make delivery fire-and-forget. Implementations must not
/// expose transport completion to callers, and this API intentionally has no
/// method that accepts raw motion samples.
abstract interface class SensorDebugSink {
  void sendSessionStart(SensorDebugSessionStart event);

  void sendBatchLog(SensorDebugBatchLog log);

  void sendSessionStop(SensorDebugSessionStop event);
}
