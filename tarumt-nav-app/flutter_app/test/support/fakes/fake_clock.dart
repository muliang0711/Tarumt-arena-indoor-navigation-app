import 'package:indoor_navigation/application/ports/time/clock.dart';

/// A manually controlled, nondecreasing clock.
final class FakeClock implements Clock {
  FakeClock({int initialNowMs = 0}) : _nowMs = initialNowMs;

  int _nowMs;

  @override
  int nowMs() => _nowMs;

  void advanceByMs(int elapsedMs) {
    if (elapsedMs < 0) {
      throw ArgumentError.value(
        elapsedMs,
        'elapsedMs',
        'must not move time backwards',
      );
    }
    _nowMs += elapsedMs;
  }

  void advanceToMs(int targetMs) {
    if (targetMs < _nowMs) {
      throw ArgumentError.value(
        targetMs,
        'targetMs',
        'must not move time backwards',
      );
    }
    _nowMs = targetMs;
  }
}
