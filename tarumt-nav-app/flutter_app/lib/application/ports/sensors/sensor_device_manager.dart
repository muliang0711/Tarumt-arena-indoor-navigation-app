import 'package:indoor_navigation/application/ports/sensors/sensor_models.dart';

abstract interface class SensorDeviceManager {
  /// Reports motion and optional heading capability without starting streams.
  Future<SensorAvailability> checkAvailability();

  /// Requests every permission required for the normalized event stream.
  Future<SensorPermissionStatus> requestPermissions();

  /// One ordered, single-subscription stream for both motion and heading.
  ///
  /// A platform adapter owns any raw sensor fan-out and publishes only
  /// normalized immutable events through this boundary. Event order is receive
  /// order and must not be changed using sensor timestamps. A recoverable
  /// `streamFailed` error leaves the run active; an `interrupted` error ends the
  /// active run. The stream itself stays open until [dispose].
  Stream<NormalizedSensorEvent> get events;

  /// Starts a run using the requested platform update intervals.
  ///
  /// Starting while already running replaces the previous run as if [stop]
  /// completed first. Pending events from the previous run must be suppressed.
  /// Implementations surface start, availability, and permission failures as a
  /// [SensorDeviceException].
  Future<void> start(SensorSamplingRequest request);

  /// Idempotently stops the active run and suppresses pending events.
  ///
  /// The event stream remains open so the manager can be started again.
  Future<void> stop();

  /// Idempotently releases the manager and closes [events].
  ///
  /// This is terminal: later stateful operations fail with `disposed`.
  Future<void> dispose();
}
