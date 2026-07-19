/// Selects where the shared Dart positioning pipeline obtains Wi-Fi readings.
enum WifiPositioningSourceMode {
  /// Uses the platform's real nearby Wi-Fi scan implementation.
  native,

  /// Uses readings entered by a tester without touching Wi-Fi hardware.
  manual,

  /// Does not create or run the Wi-Fi positioning pipeline.
  off,
}
