import 'dart:math';

final class PresenceReconnectPolicy {
  PresenceReconnectPolicy({Random? random}) : _random = random ?? Random();

  final Random _random;

  Duration delayForAttempt(int attempt) {
    final exponent = attempt.clamp(0, 5);
    final baseMs = min(15000, 500 * (1 << exponent));
    final jitter = 0.8 + _random.nextDouble() * 0.4;
    return Duration(milliseconds: min(15000, (baseMs * jitter).round()));
  }
}
