/// Supplies wall-clock time as milliseconds since the Unix epoch.
///
/// Application code depends on this contract instead of reading the system
/// clock directly so time-dependent behavior can be deterministic in tests.
abstract interface class Clock {
  int nowMs();
}
