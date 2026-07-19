typedef PeriodicTaskCallback = void Function();

/// A cancellable periodic task registration.
abstract interface class PeriodicTaskHandle {
  bool get isCancelled;

  void cancel();
}

/// Registers callbacks that repeat at a fixed interval measured in
/// milliseconds.
///
/// Implementations must reject intervals that are not strictly positive.
abstract interface class PeriodicScheduler {
  PeriodicTaskHandle schedulePeriodic({
    required int intervalMs,
    required PeriodicTaskCallback callback,
  });
}
